/** PPT 导出桥类型（对应 preload/src/ppt.ts 的 pptApi）：
 * 预览由渲染进程 vueRender 直接渲染；PPTX 载荷为 DOM 实测快照（PptExportSnapshot），
 * 主进程 PptxGenJS 按绝对坐标构建；PNG 由渲染进程 canvas 绘制后主进程仅落盘。 */
declare interface PptApi {
  /** 快照 → 构建 PPTX 并落盘（主进程完成），返回文件路径 */
  exportPptx(
    snapshot: import('@/modules/ppt/pptTypes').PptExportSnapshot,
    options: { path: string }
  ): Promise<string>
  /** PNG dataURL 列表落盘（单页 targetPath 为文件路径，多页为目录 page-{n}.png），返回文件路径列表 */
  writePngFiles(
    images: string[],
    options: { targetPath: string; pages: number[] }
  ): Promise<string[]>
}
