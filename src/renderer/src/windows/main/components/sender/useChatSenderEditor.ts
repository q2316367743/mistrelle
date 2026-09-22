import { useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import { mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Ref } from 'vue'
import type { SkillItem, ToolItem, UserMessageContent } from '@/domain'
import type { ChatFileRef } from '@/utils/chatSender'
import type { LocalSkill } from '@/windows/main/modules/skill'
import type { CanvasNodeRef } from '@/windows/main/components/design/canvasNodeBridge'
import type { HtmlElementRef } from '@/windows/main/components/design/htmlElementBridge'
import {
  buildFileSuggestion,
  buildSkillSuggestion,
  buildToolSuggestion,
  fileMentionPluginKey,
  skillMentionPluginKey,
  toolMentionPluginKey,
  type ToolSuggestionItem
} from './mentionSuggestion'
import { serializeEditorContent } from './chatSenderContent'

/** 编辑器内通过提及标签引用的上下文集合 */
export interface MentionState {
  skills: SkillItem[]
  files: ChatFileRef[]
  tools: ToolItem[]
  canvas: CanvasNodeRef[]
  htmlElements: HtmlElementRef[]
}

export interface ChatSenderEditorOptions {
  /** 初始内容（父组件水合时由 setText 覆盖） */
  content?: string
  /** 初始可编辑态（加载中的会话禁止输入；后续变化由 setEditable 同步） */
  editable?: boolean
  /** 沙盒目录：拖入 / 粘贴的非磁盘文件落盘兜底用（运行时读取最新值） */
  sandboxDir: () => string
  /** 工作空间根目录：@ 提及按路径下钻用 */
  workspace: Readonly<Ref<string>>
  /** 可见文件列表：@ 提及兜底候选 */
  files: Readonly<Ref<ChatFileRef[]>>
  /** 回车提交（未处于提及选择态时） */
  onSubmit: () => void
}

const emptyMentionState = (): MentionState => ({
  skills: [],
  files: [],
  tools: [],
  canvas: [],
  htmlElements: []
})

/**
 * 聊天发送栏的富文本编辑器逻辑：tipTap 实例、提及标签（技能 / 工具 / 文件 / 画布节点 / 设计稿元素）、
 * 拖拽与粘贴插入、内容序列化。抽离出来是为了让 LChatSender.vue 只保留版式与状态编排。
 */
export const useChatSenderEditor = (options: ChatSenderEditorOptions) => {
  const inputValue = ref('')
  const mentionState = ref<MentionState>(emptyMentionState())

  const extractMentions = (editor: Editor): MentionState => {
    const result: MentionState = emptyMentionState()
    editor.state.doc.descendants((node: PMNode) => {
      if (node.type.name === 'skillMention') {
        result.skills.push({ path: node.attrs.id, name: node.attrs.label })
      } else if (node.type.name === 'fileMention') {
        const label = node.attrs.label as string
        result.files.push({
          path: node.attrs.id,
          name: label.split('/').pop() || label,
          relativePath: label
        })
      } else if (node.type.name === 'toolMention') {
        result.tools.push({ name: node.attrs.id, label: node.attrs.label })
      } else if (node.type.name === 'canvasMention') {
        result.canvas.push({
          version: Number(node.attrs.version ?? 0),
          nodeId: String(node.attrs.nodeId ?? ''),
          label: String(node.attrs.label ?? '') || undefined
        })
      } else if (node.type.name === 'htmlElementMention') {
        result.htmlElements.push({
          version: Number(node.attrs.version ?? 0),
          path: String(node.attrs.path ?? ''),
          label: String(node.attrs.label ?? '')
        })
      }
    })
    return result
  }

  const SkillMention = Mention.extend({ name: 'skillMention' }).configure({
    // 退格一次即整体删除标签，避免残留触发字符（默认 false 会把节点替换成 "/"）
    deleteTriggerWithBackspace: true,
    suggestion: buildSkillSuggestion(),
    renderHTML: ({ options: mentionOptions, node }) => [
      'span',
      mergeAttributes(mentionOptions.HTMLAttributes, {
        class: 'l-chat-sender__inline-tag t-tag t-tag--primary t-tag--light t-tag--medium',
        'data-type': 'skill',
        contenteditable: 'false'
      }),
      `${node.attrs.label}`
    ]
  })

  const FileMention = Mention.extend({ name: 'fileMention' }).configure({
    // 退格一次即整体删除标签，避免残留触发字符（默认 false 会把节点替换成 "@"）
    deleteTriggerWithBackspace: true,
    suggestion: buildFileSuggestion(options.files, { workspace: options.workspace }),
    renderHTML: ({ options: mentionOptions, node }) => [
      'span',
      mergeAttributes(mentionOptions.HTMLAttributes, {
        class: 'l-chat-sender__inline-tag t-tag t-tag--success t-tag--light t-tag--medium',
        'data-type': 'file',
        contenteditable: 'false'
      }),
      `${node.attrs.label}`
    ]
  })

  const ToolMention = Mention.extend({ name: 'toolMention' }).configure({
    deleteTriggerWithBackspace: true,
    suggestion: buildToolSuggestion(),
    renderHTML: ({ options: mentionOptions, node }) => [
      'span',
      mergeAttributes(mentionOptions.HTMLAttributes, {
        class: 'l-chat-sender__inline-tag t-tag t-tag--warning t-tag--light t-tag--medium',
        'data-type': 'tool',
        contenteditable: 'false'
      }),
      `${node.attrs.label}`
    ]
  })

  /** 画布节点引用标签：双击侧边栏画布节点程序化插入（无触发字符，不挂 suggestion 插件） */
  const CanvasMention = TiptapNode.create({
    name: 'canvasMention',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: false,
    addAttributes: () => ({
      version: { default: 0 },
      nodeId: { default: '' },
      label: { default: '' }
    }),
    parseHTML: () => [{ tag: 'span[data-type="canvas"]' }],
    renderHTML: ({ node }) => [
      'span',
      mergeAttributes({
        class: 'l-chat-sender__inline-tag t-tag t-tag--default t-tag--light t-tag--medium',
        'data-type': 'canvas',
        contenteditable: 'false'
      }),
      `画布(canvas-${node.attrs.version})节点(${node.attrs.label || node.attrs.nodeId})`
    ]
  })

  /** HTML 设计稿元素引用标签：双击预览元素程序化插入（attrs.label 存完整描述链，显示截断） */
  const HtmlElementMention = TiptapNode.create({
    name: 'htmlElementMention',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: false,
    addAttributes: () => ({
      version: { default: 0 },
      path: { default: '' },
      label: { default: '' }
    }),
    parseHTML: () => [{ tag: 'span[data-type="html-element"]' }],
    renderHTML: ({ node }) => {
      const label = String(node.attrs.label ?? '')
      const brief = label.split(' > ').pop() || label
      return [
        'span',
        mergeAttributes({
          class: 'l-chat-sender__inline-tag t-tag t-tag--default t-tag--light t-tag--medium',
          'data-type': 'html-element',
          title: label,
          contenteditable: 'false'
        }),
        `设计稿(html-${node.attrs.version})元素(${brief})`
      ]
    }
  })

  // 直接读取 suggestion 插件内部的 active 状态，作为回车是否让位给选中的权威判断，
  // 避免依赖易失同步的外部标志（曾导致弹层可见时回车误触发发送）。
  const isSuggestionActive = (ed?: Editor | null): boolean => {
    if (!ed) return false
    return [skillMentionPluginKey, fileMentionPluginKey, toolMentionPluginKey].some(
      (key) => key.getState(ed.state)?.active
    )
  }

  const insertFile = (file: ChatFileRef) => {
    editor.value
      ?.chain()
      .focus()
      .insertContent([
        { type: 'fileMention', attrs: { id: file.path, label: file.relativePath } },
        { type: 'text', text: ' ' }
      ])
      .run()
  }

  const insertFileByPath = (filePath: string) => {
    const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'file'
    insertFile({ name, path: filePath, relativePath: name })
  }

  const resolveFilePath = async (file: File): Promise<string | null> => {
    // Electron 32+ 已移除 File.path，经 webUtils.getPathForFile 还原磁盘路径（拖入 / 粘贴的磁盘文件）
    try {
      const diskPath = window.preload.webUtils.getPathForFile(file)
      if (diskPath) return diskPath
    } catch {
      // 非磁盘 File（如剪贴板截图）会抛错，走下方案兜底
    }
    const sandboxDir = options.sandboxDir()
    if (!sandboxDir) return null
    const arrayBuffer = await file.arrayBuffer()
    const tmpDir = window.preload.path.join(sandboxDir, 'tmp')
    if (!window.preload.fs.existsSync(tmpDir)) {
      await window.preload.fs.mkdir(tmpDir, true)
    }
    const fileName = `${Date.now()}_${file.name || 'unnamed'}`
    const filePath = window.preload.path.join(tmpDir, fileName)
    await window.preload.fs.writeBinaryFile(filePath, arrayBuffer)
    return filePath
  }

  const pasteImage = async (item: DataTransferItem) => {
    const file = item.getAsFile()
    if (!file) return
    const filePath = await resolveFilePath(file)
    if (filePath) insertFileByPath(filePath)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false
      }),
      SkillMention,
      FileMention,
      ToolMention,
      CanvasMention,
      HtmlElementMention
    ],
    content: options.content || '',
    editable: options.editable ?? true,
    editorProps: {
      attributes: { class: 'l-chat-sender__pm' },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          // 任一 suggestion 弹层激活时，交由 suggestion 插件处理选中，禁止发送消息
          if (isSuggestionActive(editor.value)) return false
          options.onSubmit()
          return true
        }
        return false
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        const file = files[0]
        resolveFilePath(file).then((filePath) => {
          if (filePath) insertFileByPath(filePath)
        })
        return true
      },
      handlePaste: (_view, event) => {
        const data = event.clipboardData
        if (!data) return false

        for (let i = 0; i < data.items.length; i++) {
          if (data.items[i].type.startsWith('image/')) {
            pasteImage(data.items[i])
            event.preventDefault()
            return true
          }
        }

        if (data.files.length > 0) {
          const file = data.files[0]
          resolveFilePath(file).then((filePath) => {
            if (filePath) insertFileByPath(filePath)
          })
          event.preventDefault()
          return true
        }

        const uriList = data.getData('text/uri-list')
        if (uriList) {
          const match = uriList.match(/^file:\/\/(.+)/m)
          if (match) {
            insertFileByPath(decodeURIComponent(match[1].trim()))
            event.preventDefault()
            return true
          }
        }

        const plainText = data.getData('text/plain')
        // 复制文件后粘贴：部分平台 clipboardData 不会带上文件条目（只剩文件名纯文本），
        // 先读主进程文件剪贴板，命中则插入文件引用，否则才回退纯文本插入
        event.preventDefault()
        const insertPlainFallback = (): void => {
          if (plainText) editor.value?.chain().focus().insertContent(plainText).run()
        }
        void window.preload.inject.clipboard
          .getCopyedFiles()
          .then((copied) => {
            if (copied.length > 0) {
              for (const c of copied) insertFileByPath(c.path)
            } else {
              insertPlainFallback()
            }
          })
          .catch(insertPlainFallback)
        return true
      }
    },
    onUpdate: ({ editor: ed }) => {
      inputValue.value = ed.getText()
      mentionState.value = extractMentions(ed)
    }
  })

  /** 当前输入是否可发送：有正文或任意提及标签 */
  const canSend = computed(() =>
    Boolean(
      inputValue.value.trim() ||
      mentionState.value.skills.length ||
      mentionState.value.files.length ||
      mentionState.value.tools.length ||
      mentionState.value.canvas.length ||
      mentionState.value.htmlElements.length
    )
  )

  /** 占位文案显隐：输入框完全为空时展示 */
  const showPlaceholder = computed(
    () =>
      !inputValue.value &&
      !mentionState.value.skills.length &&
      !mentionState.value.files.length &&
      !mentionState.value.tools.length &&
      !mentionState.value.canvas.length &&
      !mentionState.value.htmlElements.length
  )

  /** 编辑器内容按结构化片段序列化（文本 / 技能 / 附件 / 工具 / 画布 / 设计稿元素） */
  const getContents = (): UserMessageContent[] => {
    const ed = editor.value
    return ed ? serializeEditorContent(ed) : []
  }

  const focusEditor = () => editor.value?.commands.focus()

  const setText = (value: string) => editor.value?.commands.setContent(value || '')

  /** 编辑器可编辑态（加载中禁止输入） */
  const setEditable = (value: boolean) => editor.value?.setEditable(value)

  const insertSkill = (skill: LocalSkill) => {
    editor.value
      ?.chain()
      .focus()
      .insertContent([
        { type: 'skillMention', attrs: { id: skill.path, label: skill.name } },
        { type: 'text', text: ' ' }
      ])
      .run()
  }

  const insertTool = (tool: ToolSuggestionItem) => {
    editor.value
      ?.chain()
      .focus()
      .insertContent([
        { type: 'toolMention', attrs: { id: tool.id, label: tool.label } },
        { type: 'text', text: ' ' }
      ])
      .run()
  }

  const clearEditor = () => {
    editor.value?.commands.clearContent(true)
    inputValue.value = ''
    mentionState.value = emptyMentionState()
  }

  /** 画布侧边栏双击节点后注入：在输入框插入 canvasMention 标签 */
  const addCanvasNode = (ref: CanvasNodeRef) => {
    editor.value
      ?.chain()
      .focus()
      .insertContent([
        {
          type: 'canvasMention',
          attrs: { version: ref.version, nodeId: ref.nodeId, label: ref.label ?? '' }
        },
        { type: 'text', text: ' ' }
      ])
      .run()
  }

  /** 设计稿预览双击元素后注入：在输入框插入 htmlElementMention 标签 */
  const addHtmlElementNode = (ref: HtmlElementRef) => {
    editor.value
      ?.chain()
      .focus()
      .insertContent([
        {
          type: 'htmlElementMention',
          attrs: { version: ref.version, path: ref.path, label: ref.label }
        },
        { type: 'text', text: ' ' }
      ])
      .run()
  }

  onBeforeUnmount(() => editor.value?.destroy())

  return {
    editor,
    inputValue,
    mentionState,
    canSend,
    showPlaceholder,
    getContents,
    focusEditor,
    setText,
    setEditable,
    insertSkill,
    insertTool,
    insertFile,
    insertFileByPath,
    resolveFilePath,
    clearEditor,
    addCanvasNode,
    addHtmlElementNode
  }
}
