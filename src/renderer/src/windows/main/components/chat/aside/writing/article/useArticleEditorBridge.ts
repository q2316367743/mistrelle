import type { Ref } from 'vue'
import type { ArticleImageContext } from './components/articleEditorImages'
import {
  EMPTY_EDITOR_STATE,
  type ArticleBlockType,
  type ArticleEditorCommand,
  type ArticleEditorState
} from './components/articleEditorCommands'
import type {
  ArticleTypeEntry,
  ArticleItem,
  ArticleTypePatch
} from '@/windows/main/modules/tool/components/article/articleTypes'
import type { ImagePromptContext } from '@/windows/main/modules/tool/components/writing/imagePrompt'
import { resolveAssetRel } from '@/windows/main/modules/tool/components/article/imageRef'
import { openImageGen } from '../components/ImageGenDialog'

/** 编辑器实例命令面（ArticleEditor defineExpose） */
export interface ArticleEditorApi {
  insertImage: (rel: string) => void
  getSelection: () => string
  getImageContext: () => ArticleImageContext
  replaceImageAt: (pos: number, rel: string) => void
  runCommand: (cmd: ArticleEditorCommand) => void
  setBlockType: (type: ArticleBlockType) => void
}

interface EditorBridgeOptions {
  /** 编辑器模板 ref（由组件用 useTemplateRef 声明后传入：解构出的 ref 仅作字符串模板 ref 会被 vue-tsc 判未使用） */
  editorRef: Ref<ArticleEditorApi | null>
  activeArticle: Ref<ArticleItem | undefined>
  activeEntry: Ref<ArticleTypeEntry | undefined>
  /** 类型级元信息写回（配图登记） */
  patchType: (patch: ArticleTypePatch) => void
  /** 当前文章 md 所在目录 */
  activeMdDir: Ref<string>
  /** 配图目录 */
  assetsDir: Ref<string>
}

/**
 * 编辑器 ↔ 文章数据层的接线层（从 ArticleAside.vue 抽出，控制外壳行数）。
 * 职责：编辑器命令转发、选区与状态快照持有、图片登记 / 替换 / 删除与 AI 生图语境组装。
 * 生图以**选中文字**为唯一依据（无选中则按钮禁用），刻意不传正文全文。
 */
export const useArticleEditorBridge = (options: EditorBridgeOptions) => {
  const editorRef = options.editorRef
  /** 编辑器当前选中的正文文本（空 = 未选中，插图生图禁用） */
  const selection = ref('')
  /** 编辑器状态快照（工具栏格式 active 态 / 块类型联动） */
  const editorState = ref<ArticleEditorState>(EMPTY_EDITOR_STATE)

  const handleSelectionChange = (text: string): void => {
    selection.value = text
  }

  const handleStateChange = (state: ArticleEditorState): void => {
    editorState.value = state
  }

  // ─── 格式命令 ─────────────────────────────────────────────────────

  const handleCommand = (cmd: ArticleEditorCommand): void => {
    editorRef.value?.runCommand(cmd)
  }

  const handleBlockType = (type: ArticleBlockType): void => {
    editorRef.value?.setBlockType(type)
  }

  // ─── 图片登记与语境 ───────────────────────────────────────────────

  /** 编辑器相对 md 目录的图片引用 → 归一为相对 articles/ 登记进当前类型插图列表（去重） */
  const registerImage = (rel: string): void => {
    const entry = options.activeEntry.value
    if (!entry) return
    const target = `assets/${window.preload.path.basename(rel)}`
    if ((entry.images ?? []).includes(target)) return
    options.patchType({ images: [...(entry.images ?? []), target] })
  }

  const handleImageAdded = (rel: string): void => registerImage(rel)

  /** 图片已从正文彻底移除（编辑器已确认无其它引用）→ 从插图列表摘掉 */
  const handleImageRemoved = (rel: string): void => {
    const entry = options.activeEntry.value
    if (!entry) return
    const target = `assets/${window.preload.path.basename(rel)}`
    const next = (entry.images ?? []).filter((item) => item !== target)
    if (next.length === (entry.images ?? []).length) return
    options.patchType({ images: next })
  }

  const handleInsertImage = (rel: string): void => {
    editorRef.value?.insertImage(rel)
    registerImage(rel)
  }

  /**
   * 插图语境：以**用户选中的文字**为核心（要插图的正是这段内容），另附文章标题 / 摘要 / 提纲作背景。
   * 刻意不传正文全文——会让模型画成泛泛的「全文配图」而非这一段。无选中时按钮本就禁用，不会走到这里。
   */
  const buildImageContext = (): ImagePromptContext => {
    const article = options.activeArticle.value
    return {
      title: article?.title,
      summary: article?.summary,
      outline: article?.outline,
      selection: selection.value || editorRef.value?.getSelection() || undefined
    }
  }

  /** AI 生成插图（工具栏「生图」）：产物落 assets/ 后插入光标处并登记 */
  const handleGenImage = (): void => {
    if (!options.activeEntry.value) return
    openImageGen({
      kind: 'image',
      assetsDir: options.assetsDir.value,
      context: buildImageContext(),
      onSuccess: (absPath) => {
        handleInsertImage(resolveAssetRel(options.activeMdDir.value, absPath))
      }
    })
  }

  /**
   * 图片悬浮框「AI 重新生成」：以**图片所在段落**为语境重画一张，成功后**就地替换**原图
   * （按最初记录的位置寻址，弹窗交互期间选区漂移也不影响目标）。
   */
  const handleImageRegen = (payload: { pos: number; blockText: string }): void => {
    const article = options.activeArticle.value
    openImageGen({
      kind: 'image',
      assetsDir: options.assetsDir.value,
      context: {
        title: article?.title,
        summary: article?.summary,
        outline: article?.outline,
        selection: payload.blockText || undefined
      },
      onSuccess: (absPath) => {
        const rel = resolveAssetRel(options.activeMdDir.value, absPath)
        editorRef.value?.replaceImageAt(payload.pos, rel)
        registerImage(rel)
      }
    })
  }

  return {
    selection,
    editorState,
    handleSelectionChange,
    handleStateChange,
    handleCommand,
    handleBlockType,
    handleImageAdded,
    handleImageRemoved,
    handleInsertImage,
    handleGenImage,
    handleImageRegen
  }
}
