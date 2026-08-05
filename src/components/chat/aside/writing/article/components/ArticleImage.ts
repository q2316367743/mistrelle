import { mergeAttributes } from '@tiptap/core'
import Image, { type ImageOptions } from '@tiptap/extension-image'
import { resolveArticleImage } from '@/modules/tool/components/article/imageRef'

export interface ArticleImageOptions extends ImageOptions {
  /** md 所在目录（相对路径图片解析基准，随文章切换重挂载注入） */
  baseDir: string
}

/**
 * 文章图片节点：src 属性存储相对路径（源真相，序列化回 markdown 时原样保留 ../assets/xxx.png），
 * 仅渲染时把相对路径解析为 file:// 显示。
 */
export const ArticleImage = Image.extend<ArticleImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      baseDir: ''
    } as ArticleImageOptions
  },
  renderHTML({ HTMLAttributes }) {
    const src = typeof HTMLAttributes.src === 'string' ? HTMLAttributes.src : ''
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, {
        ...HTMLAttributes,
        src: resolveArticleImage(this.options.baseDir, src)
      })
    ]
  }
})
