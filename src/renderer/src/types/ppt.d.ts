/** PPT 渲染桥类型（对应 preload/src/ppt.ts 的 pptApi；json → POM XML 由主进程完成） */
declare interface PptApi {
  /** PptJsonDoc → 每页 SVG 字符串数组（预览渲染） */
  renderPptxToSvgs(
    json: import('@/modules/ppt/pptTypes').PptJsonDoc,
    options: { w: number; h: number }
  ): Promise<string[]>
  /** PptJsonDoc → 构建 PPTX 并落盘（主进程完成），返回文件路径 */
  exportPptx(
    json: import('@/modules/ppt/pptTypes').PptJsonDoc,
    options: { w: number; h: number; path: string }
  ): Promise<string>
  /** PptJsonDoc → 渲染指定页 PNG 并落盘（单页为文件路径，多页为目录），返回文件路径列表 */
  exportPptxToPngs(
    json: import('@/modules/ppt/pptTypes').PptJsonDoc,
    options: { w: number; h: number; path: string; slides?: number[] }
  ): Promise<string[]>
}
