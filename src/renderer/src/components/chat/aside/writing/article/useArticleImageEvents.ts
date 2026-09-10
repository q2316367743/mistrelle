import type { ComputedRef, Ref } from 'vue'
import type { ArticleItem, ArticleUpdatePatch } from '@/windows/main/modules/tool/components/article/articleTypes'
import type { ArticleStore } from '@/windows/main/modules/tool/components/article/articleStore'
import { MessageUtil } from '@/utils/modal'

/**
 * 配图 / 风格面板元数据事件写回：封面与插图增删登记。
 * cover / images 为文章级字段（跨版本共享），统一经共享 store 落盘。
 */
export const useArticleImageEvents = (ctx: {
  store: ComputedRef<ArticleStore>
  activeId: Ref<string>
  activeArticle: ComputedRef<ArticleItem | undefined>
}) => {
  const patchArticle = (patch: ArticleUpdatePatch) => {
    if (!ctx.activeArticle.value) return
    ctx.store.value
      .updateArticle(ctx.activeId.value, patch)
      .catch(() => MessageUtil.error('文章信息保存失败'))
  }

  /** 编辑器粘贴 / 拖入的图片自动登记进插图列表（去重；编辑器内为相对 md 目录路径，登记归一为相对 articles/） */
  const handleImageAdded = (rel: string) => {
    const article = ctx.activeArticle.value
    if (!article) return
    const target = `assets/${window.preload.path.basename(rel)}`
    if ((article.images ?? []).includes(target)) return
    patchArticle({ images: [...(article.images ?? []), target] })
  }

  const handleAddImages = (rels: string[]) => {
    const article = ctx.activeArticle.value
    if (!article) return
    const merged = [...(article.images ?? [])]
    for (const rel of rels) if (!merged.includes(rel)) merged.push(rel)
    patchArticle({ images: merged })
  }

  const handleRemoveImage = (rel: string) => {
    const article = ctx.activeArticle.value
    if (!article) return
    patchArticle({ images: (article.images ?? []).filter((img) => img !== rel) })
  }

  const handleCover = (rel: string | undefined) => patchArticle({ cover: rel })

  return { patchArticle, handleImageAdded, handleAddImages, handleRemoveImage, handleCover }
}
