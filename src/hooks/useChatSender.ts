import type { Ref } from 'vue'
import type { LocalSkill } from '@/modules/skill'
import type { ChatFileRef } from '@/utils/chatSender'

type TagType = 'skill' | 'file'
type TagData = LocalSkill | ChatFileRef

interface UseChatSenderOptions {
  skills: Ref<LocalSkill[]>
  files: Ref<ChatFileRef[]>
  loading: Ref<boolean>
  onInput?: (value: string) => void
  onSend?: () => void
}

const INLINE_TAG_CLASS = 'l-chat-sender__inline-tag'
const CARET_SPACER = '\u200B'

const isTagNode = (node: Node): node is HTMLElement =>
  node.nodeType === Node.ELEMENT_NODE &&
  ['skill', 'file'].includes((node as HTMLElement).dataset.type || '')

const createTagNode = (type: TagType, data: TagData): HTMLElement => {
  const isSkill = type === 'skill'
  const span = document.createElement('span')
  span.className = isSkill
    ? `t-tag t-tag--primary t-tag--light t-tag--medium ${INLINE_TAG_CLASS}`
    : `t-tag t-tag--success t-tag--light t-tag--medium ${INLINE_TAG_CLASS}`
  span.contentEditable = 'false'
  span.dataset.type = type
  span.dataset.path = data.path
  span.textContent = isSkill ? `/${data.name}` : `@${(data as ChatFileRef).relativePath}`
  span.title = data.path
  return span
}

const createCaretSpacer = () => document.createTextNode(CARET_SPACER)

const stripCaretSpacers = (text: string) => text.replaceAll(CARET_SPACER, '')

const isSpacerTextNode = (node: Node): node is Text =>
  node.nodeType === Node.TEXT_NODE && (node.textContent || '').startsWith(CARET_SPACER)

const ensureTrailingTextNode = (editor: HTMLElement) => {
  const last = editor.lastChild
  if (!last || last.nodeType !== Node.TEXT_NODE) {
    editor.appendChild(document.createTextNode(''))
  }
}

const setSelection = (node: Node, offset: number) => {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

const removeTagNode = (tag: Node) => {
  const next = tag.nextSibling
  tag.parentNode?.removeChild(tag)
  if (next && isSpacerTextNode(next)) next.parentNode?.removeChild(next)
}

const findCommandRange = (editor: HTMLElement, commandText: string): Range | null => {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) textNodes.push(node as Text)

  const totalLength = textNodes.reduce((sum, item) => sum + item.length, 0)
  const commandLength = commandText.length
  if (totalLength < commandLength) return null

  const startOffset = totalLength - commandLength
  const range = document.createRange()
  let currentOffset = 0

  for (const textNode of textNodes) {
    const nodeEnd = currentOffset + textNode.length
    if (startOffset < nodeEnd) {
      range.setStart(textNode, startOffset - currentOffset)
      range.setEnd(textNode, textNode.length)
      return range
    }
    currentOffset = nodeEnd
  }
  return null
}

export const useChatSender = (options: UseChatSenderOptions) => {
  const editorRef = ref<HTMLElement>()
  const inputValue = ref('')
  const selectedSkills = ref<LocalSkill[]>([])
  const selectedFiles = ref<ChatFileRef[]>([])

  const syncFromEditor = () => {
    const editor = editorRef.value
    if (!editor) return

    const skillMap = new Map(options.skills.value.map((item) => [item.path, item]))
    const fileMap = new Map(options.files.value.map((item) => [item.path, item]))
    const skills: LocalSkill[] = []
    const files: ChatFileRef[] = []
    let text = ''

    for (const node of Array.from(editor.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += stripCaretSpacers(node.textContent || '')
      } else if (isTagNode(node)) {
        const type = node.dataset.type as TagType
        const path = node.dataset.path
        if (!path) continue
        if (type === 'skill') {
          const skill = skillMap.get(path)
          if (skill) skills.push(skill)
        } else if (type === 'file') {
          const file = fileMap.get(path)
          if (file) files.push(file)
        }
      }
    }

    inputValue.value = text
    selectedSkills.value = skills
    selectedFiles.value = files
    options.onInput?.(text)
  }

  const setText = (text: string) => {
    const editor = editorRef.value
    if (!editor) return
    editor.innerHTML = ''
    editor.appendChild(document.createTextNode(text))
    ensureTrailingTextNode(editor)
    syncFromEditor()
  }

  const insertTag = (type: TagType, data: TagData, commandText: string) => {
    const editor = editorRef.value
    if (!editor) return

    const range = findCommandRange(editor, commandText)
    if (!range) return

    const keepLeadingSpace = commandText.startsWith(' ')
    range.deleteContents()

    const fragment = document.createDocumentFragment()
    if (keepLeadingSpace) fragment.appendChild(document.createTextNode(' '))
    const tagNode = createTagNode(type, data)
    fragment.appendChild(tagNode)
    const spacer = createCaretSpacer()
    fragment.appendChild(spacer)
    range.insertNode(fragment)
    ensureTrailingTextNode(editor)
    setSelection(spacer, 1)

    syncFromEditor()
  }

  const clearTags = (type?: TagType) => {
    const editor = editorRef.value
    if (!editor) return
    for (const node of Array.from(editor.childNodes)) {
      if (isTagNode(node) && (!type || node.dataset.type === type)) removeTagNode(node)
    }
    ensureTrailingTextNode(editor)
    syncFromEditor()
  }

  const clear = () => setText('')

  const focus = () => editorRef.value?.focus()

  const handleBackspace = (event: KeyboardEvent) => {
    const editor = editorRef.value
    if (!editor) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (!range.collapsed) return

    const container = range.startContainer
    const offset = range.startOffset

    if (isSpacerTextNode(container) && offset <= 1) {
      const prev = container.previousSibling
      if (prev && isTagNode(prev)) {
        event.preventDefault()
        removeTagNode(prev)
        ensureTrailingTextNode(editor)
        syncFromEditor()
        return
      }
    }

    if (container.nodeType === Node.TEXT_NODE && offset === 0) {
      const prev = container.previousSibling
      if (prev && isTagNode(prev)) {
        event.preventDefault()
        removeTagNode(prev)
        ensureTrailingTextNode(editor)
        syncFromEditor()
        return
      }
    }

    if (container === editor) {
      const child = offset > 0 ? editor.childNodes[offset - 1] : editor.childNodes[0]
      if (child && isTagNode(child)) {
        event.preventDefault()
        removeTagNode(child)
        ensureTrailingTextNode(editor)
        syncFromEditor()
        return
      }
      if (child && isSpacerTextNode(child) && child.previousSibling && isTagNode(child.previousSibling)) {
        event.preventDefault()
        removeTagNode(child.previousSibling)
        ensureTrailingTextNode(editor)
        syncFromEditor()
        return
      }
    }

    if (!inputValue.value && (selectedSkills.value.length || selectedFiles.value.length)) {
      event.preventDefault()
      const last = editor.lastChild
      if (last && isTagNode(last)) {
        removeTagNode(last)
      } else if (last?.previousSibling && isTagNode(last.previousSibling)) {
        removeTagNode(last.previousSibling)
      }
      ensureTrailingTextNode(editor)
      syncFromEditor()
    }
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      options.onSend?.()
    } else if (event.key === 'Backspace') {
      handleBackspace(event)
    }
  }

  const handleInput = () => {
    if (!editorRef.value) return
    ensureTrailingTextNode(editorRef.value)
    syncFromEditor()
  }

  const handlePaste = (event: ClipboardEvent) => {
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain') ?? ''
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    syncFromEditor()
  }

  watch(
    options.loading,
    (value) => {
      if (editorRef.value) editorRef.value.contentEditable = value ? 'false' : 'plaintext-only'
    },
    { immediate: true }
  )

  return {
    editorRef,
    inputValue,
    selectedSkills,
    selectedFiles,
    setText,
    insertTag,
    clear,
    clearTags,
    focus,
    handleInput,
    handleKeydown,
    handlePaste
  }
}
