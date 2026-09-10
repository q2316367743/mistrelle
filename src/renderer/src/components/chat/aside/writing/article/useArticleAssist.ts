import type { ComputedRef, Ref } from 'vue'
import type { ArticleItem } from '@/windows/main/modules/tool/components/article/articleTypes'
import type { ArticleStore } from '@/windows/main/modules/tool/components/article/articleStore'
import { MessageUtil } from '@/utils/modal'
import { HUMANIZE_ENABLED, ZHUQUE_ENABLED, requestHumanizeStream, requestZhuqueDetect } from './humanizeApi'

/**
 * 版本条动作编排：去 AI 味（流式 → 新版本）与朱雀检测（结果落当前激活版本）。
 * 接口未接入时按钮禁用；接入后仅需实现 humanizeApi.ts 中的 request 并打开开关。
 */
export const useArticleAssist = (ctx: {
  store: ComputedRef<ArticleStore>
  activeId: Ref<string>
  activeArticle: ComputedRef<ArticleItem | undefined>
  content: Ref<string>
}) => {
  const humanizing = ref(false)
  const detecting = ref(false)

  /** 去 AI 味：当前正文流式改写，完成后登记为新版本并激活（原版本内容不动；每次产生一个新版本） */
  const handleHumanize = async (): Promise<void> => {
    const article = ctx.activeArticle.value
    if (!HUMANIZE_ENABLED || !article || humanizing.value) return
    const original = ctx.content.value
    let streamed = ''
    humanizing.value = true
    try {
      const full = await requestHumanizeStream({
        text: original,
        onDelta: (delta) => {
          streamed += delta
          // 编辑器 watch content 实时跟随渲染
          ctx.content.value = streamed
        }
      })
      await ctx.store.value.createVersion(article.id, { source: 'humanize', content: full })
      ctx.content.value = full
      MessageUtil.success('去 AI 味完成，已生成新版本')
    } catch (e) {
      ctx.content.value = original
      MessageUtil.error('去 AI 味失败', e)
    } finally {
      humanizing.value = false
    }
  }

  /** 朱雀检测：结果写入当前激活版本（跟版本走） */
  const handleDetect = async (): Promise<void> => {
    const article = ctx.activeArticle.value
    const versionId = article?.activeVersionId
    if (!ZHUQUE_ENABLED || !article || !versionId || detecting.value) return
    detecting.value = true
    try {
      const result = await requestZhuqueDetect(ctx.content.value)
      await ctx.store.value.patchVersion(article.id, versionId, { zhuque: result })
      MessageUtil.success('检测完成')
    } catch (e) {
      MessageUtil.error('AI 检测失败', e)
    } finally {
      detecting.value = false
    }
  }

  return { humanizing, detecting, handleHumanize, handleDetect }
}
