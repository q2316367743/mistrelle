/**
 * window.preload.webUtils 契约：File 对象 → 真实磁盘路径（Electron 32+ 替代 File.path）。
 * 拖入 / 粘贴的磁盘文件命中，剪贴板截图等非磁盘 File 返回空串。
 */
declare interface WebUtilsApi {
  getPathForFile(file: File): string
}
