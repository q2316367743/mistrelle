/**
 * 图片源解析：attr.src 允许 base64 data URI 或沙盒本地绝对路径（schema 禁止 http）。
 * 本地路径经 preload fs 读为 data URL（渲染进程 <img> 无法直接加载本地绝对路径）。
 * 维护 pending 计数：离屏快照服务等待全部图片解析完成后再测量。
 */

let pendingSrc = 0
const waiters: Array<() => void> = []

const beginPending = (): void => {
  pendingSrc += 1
}
const endPending = (): void => {
  pendingSrc -= 1
  if (pendingSrc <= 0) {
    pendingSrc = 0
    waiters.splice(0).forEach((notify) => notify())
  }
}

/** 等待全部本地图片解析完成（离屏快照前调用；带超时兜底） */
export const waitSrcResolved = (timeoutMs = 4000): Promise<void> =>
  new Promise((resolve) => {
    if (pendingSrc === 0) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      const index = waiters.indexOf(notify)
      if (index >= 0) waiters.splice(index, 1)
      resolve()
    }, timeoutMs)
    const notify = (): void => {
      clearTimeout(timer)
      resolve()
    }
    waiters.push(notify)
  })

/** 按扩展名推断 mime（缺省 png） */
const mimeOf = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'webp' || ext === 'gif' || ext === 'png') return `image/${ext}`
  return 'image/png'
}

/**
 * 解析 attr.src 为可显示的 URL：data: 原样返回；本地路径读文件转 data URL；
 * 失败返回空串（组件渲染空占位）。异步期间返回 undefined（组件按加载态处理）。
 */
export const resolveSrc = (src: string | undefined): Promise<string> => {
  if (!src) return Promise.resolve('')
  if (src.startsWith('data:')) return Promise.resolve(src)
  if (/^https?:/.test(src)) return Promise.resolve('') // schema 禁止 http
  beginPending()
  return window.preload.fs
    .readBinaryFile(src)
    .then((buffer) => {
      const bytes = new Uint8Array(buffer)
      let binary = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      return `data:${mimeOf(src)};base64,${btoa(binary)}`
    })
    .catch(() => '')
    .finally(endPending)
}
