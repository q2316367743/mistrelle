import type { ComputedRef, Ref } from 'vue'
import type { ArticleItem } from '@/windows/main/modules/tool/components/article/articleTypes'
import type { ArticleStore } from '@/windows/main/modules/tool/components/article/articleStore'
import { MessageUtil } from '@/utils/modal'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { HUMANIZE_ENABLED, requestHumanizeStream } from '@/windows/main/modules/ai/humanize'
import { openHumanizeDepth } from './components/HumanizeDepthDialog'

/** 记住上次选择的深度，下次打开弹窗作为默认（首次为 5） */
let lastHumanizeDepth = 5

/**
 * 版本条动作编排：去 AI 味（选深度 → 立刻建版本 → 流式写入）。
 */
export const useArticleAssist = (ctx: {
  store: ComputedRef<ArticleStore>
  activeId: Ref<string>
  activeArticle: ComputedRef<ArticleItem | undefined>
  content: Ref<string>
  /** 冲刷未落盘编辑，避免原稿被防抖写脏 */
  flushSave?: () => void
  /** 编辑/预览模式（流式期间会强制 preview） */
  mode?: ComputedRef<'edit' | 'preview'>
  switchVersion?: (versionId: string) => void | Promise<void>
  removeVersion?: (versionId: string) => void | Promise<void>
}) => {
  const humanizing = ref(false)
  /** 正在流式生成的版本 id（驱动 chip 高亮与禁止切换） */
  const streamingVersionId = ref<string | null>(null)
  let abortController: AbortController | null = null

  const handleAbortHumanize = (): void => {
    abortController?.abort()
  }

  /** 实际执行流式改写（弹窗确认深度后调用） */
  const runHumanize = async (depth: number): Promise<void> => {
    const article = ctx.activeArticle.value
    if (!article || humanizing.value) return
    const original = ctx.content.value
    lastHumanizeDepth = depth
    ctx.flushSave?.()
    humanizing.value = true
    abortController = new AbortController()
    let versionId: string | null = null
    let streamed = ''

    try {
      const version = await ctx.store.value.createVersion(article.id, {
        source: 'humanize',
        content: ''
      })
      versionId = version.id
      streamingVersionId.value = version.id
      ctx.content.value = ''

      const full = await requestHumanizeStream({
        text: original,
        depth,
        signal: abortController.signal,
        onDelta: (delta) => {
          streamed += delta
          ctx.content.value = streamed
        }
      })

      const finalText = full || streamed
      const filePath = window.preload.path.join(ctx.store.value.root, version.file)
      await window.preload.fs.writeTextFile(filePath, finalText)
      await ctx.store.value.patchVersion(article.id, version.id, {
        words: finalText.replace(/\s+/g, '').length
      })
      ctx.content.value = finalText
      MessageUtil.success('去 AI 味完成，已生成新版本')
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError')
      if (versionId && streamed) {
        const filePath = window.preload.path.join(
          ctx.store.value.root,
          ctx.activeArticle.value?.file ?? ''
        )
        if (filePath && ctx.activeArticle.value) {
          try {
            await window.preload.fs.writeTextFile(filePath, streamed)
            await ctx.store.value.patchVersion(article.id, versionId, {
              words: streamed.replace(/\s+/g, '').length
            })
          } catch {
            // 保留内存内容
          }
        }
        ctx.content.value = streamed
        if (aborted) {
          MessageUtil.warning('已停止，保留当前进度为新版本')
        } else {
          MessageUtil.success('去 AI 味未完成，已保留当前进度')
        }
      } else if (versionId) {
        try {
          await ctx.store.value.removeVersion(article.id, versionId)
          ctx.content.value = original
        } catch {
          ctx.content.value = original
        }
        if (!aborted) MessageUtil.error('去 AI 味失败', e)
        else MessageUtil.info('已取消去 AI 味')
      } else {
        ctx.content.value = original
        if (!aborted) MessageUtil.error('去 AI 味失败', e)
      }
    } finally {
      humanizing.value = false
      streamingVersionId.value = null
      abortController = null
    }
  }

  /** 去 AI 味：先选深度（默认 5），确认后再建版本并流式写入 */
  const handleHumanize = (): void => {
    const article = ctx.activeArticle.value
    const auth = useAuthStore()
    if (!HUMANIZE_ENABLED || !article || humanizing.value) return
    if (auth.status !== 'signed-in') {
      MessageUtil.warning('请先登录后再使用去 AI 味')
      return
    }
    if (!ctx.content.value.trim()) {
      MessageUtil.warning('正文为空，无法去 AI 味')
      return
    }
    openHumanizeDepth({
      defaultDepth: lastHumanizeDepth,
      onConfirm: (depth) => void runHumanize(depth)
    })
  }

  return {
    humanizing,
    streamingVersionId,
    /** 流式改写期间强制预览 */
    editorMode: computed<'edit' | 'preview'>(() =>
      humanizing.value ? 'preview' : (ctx.mode?.value ?? 'preview')
    ),
    handleHumanize,
    handleAbortHumanize,
    onSwitchVersion: (versionId: string) => {
      if (humanizing.value || !ctx.switchVersion) return
      void ctx.switchVersion(versionId)
    },
    onRemoveVersion: (versionId: string) => {
      if (humanizing.value || !ctx.removeVersion) return
      void ctx.removeVersion(versionId)
    },
    /** header / 其它入口在改写中一律吞掉 */
    guardAction: <T extends unknown[]>(fn: (...args: T) => void, ...args: T): void => {
      if (humanizing.value) return
      fn(...args)
    }
  }
}
