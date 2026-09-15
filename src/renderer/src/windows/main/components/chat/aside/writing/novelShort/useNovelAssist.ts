import type { ComputedRef, Ref } from 'vue'
import { NOVEL_FILES, type NovelFileKey } from '@/windows/main/modules/tool/components/novel/novelTypes'
import type { NovelStore } from '@/windows/main/modules/tool/components/novel/novelStore'
import { MessageUtil } from '@/utils/modal'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { HUMANIZE_ENABLED, requestHumanizeStream } from '@/windows/main/modules/ai/humanize'
import { openHumanizeDepth } from '../components/HumanizeDepthDialog'

/** 记住上次选择的深度，下次打开弹窗作为默认（首次为 5） */
let lastHumanizeDepth = 5

/**
 * 小说侧「去 AI 味」动作编排（与文章侧同源，简化：无版本概念，流式结果直接覆盖当前文件）。
 * 流式过程中实时更新编辑器内容，结束后落盘。
 */
export const useNovelAssist = (ctx: {
  store: ComputedRef<NovelStore>
  activeNovelId: Ref<string>
  activeFile: Ref<NovelFileKey>
  content: Ref<string>
  /** 冲刷未落盘编辑，避免原稿被防抖写脏 */
  flushSave?: () => void | Promise<void>
}) => {
  const humanizing = ref(false)
  let abortController: AbortController | null = null

  const handleAbortHumanize = (): void => {
    abortController?.abort()
  }

  /** 实际执行流式改写（弹窗确认深度后调用） */
  const runHumanize = async (depth: number): Promise<void> => {
    const id = ctx.activeNovelId.value
    if (!id || humanizing.value) return
    const original = ctx.content.value
    lastHumanizeDepth = depth
    await ctx.flushSave?.()
    humanizing.value = true
    abortController = new AbortController()
    let streamed = ''

    try {
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
      await ctx.store.value.writeNovelFile(id, NOVEL_FILES[ctx.activeFile.value], finalText)
      ctx.content.value = finalText
      MessageUtil.success('去 AI 味完成')
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError')
      if (streamed) {
        try {
          await ctx.store.value.writeNovelFile(id, NOVEL_FILES[ctx.activeFile.value], streamed)
          ctx.content.value = streamed
          if (aborted) MessageUtil.warning('已停止，保留当前进度')
          else MessageUtil.success('去 AI 味未完成，已保留当前进度')
        } catch {
          ctx.content.value = streamed
        }
      } else {
        ctx.content.value = original
        if (!aborted) MessageUtil.error('去 AI 味失败', e)
        else MessageUtil.info('已取消去 AI 味')
      }
    } finally {
      humanizing.value = false
      abortController = null
    }
  }

  /** 去 AI 味：先选深度（默认 5），确认后流式改写当前文件 */
  const handleHumanize = (): void => {
    const auth = useAuthStore()
    if (!HUMANIZE_ENABLED || !ctx.activeNovelId.value || humanizing.value) return
    if (auth.status !== 'signed-in') {
      MessageUtil.warning('请先登录后再使用去 AI 味')
      return
    }
    if (!ctx.content.value.trim()) {
      MessageUtil.warning('当前文件为空，无法去 AI 味')
      return
    }
    openHumanizeDepth({
      defaultDepth: lastHumanizeDepth,
      onConfirm: (depth) => void runHumanize(depth)
    })
  }

  return { humanizing, handleHumanize, handleAbortHumanize }
}
