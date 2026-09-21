import { mergeAttributes } from '@tiptap/core'
import Image, { type ImageOptions } from '@tiptap/extension-image'
import { resolveArticleImage } from '@/windows/main/modules/tool/components/article/imageRef'

export interface ArticleImageOptions extends ImageOptions {
  /** md 所在目录（相对路径图片解析基准，随文章切换重挂载注入） */
  baseDir: string
  /**
   * 图片展示版本号：解析出的 URL 会带上它（`pathToHref` 自带 `?_t=` 时间戳，
   * 此处再兜一层 `#rev` 保证「重新读取」时 URL 必然变化）。
   * ProseMirror 只在属性变化时重渲染节点，无此字段则同名图片沿用旧 URL / 旧缓存。
   */
  imageRev: number
}

/**
 * 文章图片节点：src 属性存储相对路径（源真相，序列化回 markdown 时原样保留 ../assets/xxx.png），
 * 仅渲染时把相对路径解析为本地资源服务 URL 显示。
 */
export const ArticleImage = Image.extend<ArticleImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      baseDir: '',
      imageRev: 0
    } as ArticleImageOptions
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      /** 展示版本号：写进 DOM 但不参与 markdown 序列化（renderHTML 不要的属性自动排除） */
      imageRev: { default: 0, rendered: false }
    }
  },
  renderHTML({ HTMLAttributes }) {
    const src = typeof HTMLAttributes.src === 'string' ? HTMLAttributes.src : ''
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, {
        ...HTMLAttributes,
        src: resolveArticleImage(this.options.baseDir, src, this.options.imageRev)
      })
    ]
  }
})
