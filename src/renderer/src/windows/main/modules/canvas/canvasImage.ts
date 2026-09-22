/**
 * 画布图片引用解析（渲染层唯一转换点）：
 * 数据层 imageUrl 存本地绝对路径，渲染/像素处理时在此转成可加载的 href。
 */
export const resolveImageHref = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  if (/^(file|https?|data|blob):/i.test(value)) return value
  return window.preload.net.pathToHref(value)
}

/**
 * 加载图片为可绘制对象：本地图片走事件服务 HTTP（`pathToHref`，带 ACAO:*），
 * 显式 `crossOrigin='anonymous'` 保证画布可读回（生成遮盖叠加位图需要 toBlob）。
 * 失败返回 null（调用方按「无遮盖叠加」降级，绝不抛出）。
 */
export const loadImageElement = (value: string | undefined): Promise<HTMLImageElement | null> => {
  const href = resolveImageHref(value)
  if (!href) return Promise.resolve(null)
  return new Promise((resolve) => {
    const image = new Image()
    // data:/blob: 属同源内容，无需 CORS 头；其余（本地事件服务 / 远程）统一匿名跨域
    if (!/^(data|blob):/i.test(href)) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = href
  })
}
