/** PPT 渲染桥类型（对应 preload/src/ppt.ts 的 pptApi） */
declare interface PptApi {
  /** POM XML → 每页 SVG 字符串数组（预览渲染） */
  renderPptxToSvgs(xml: string, options: { w: number; h: number }): Promise<string[]>
  /** POM XML → 构建 PPTX 并落盘（主进程完成），返回文件路径 */
  exportPptx(xml: string, options: { w: number; h: number; path: string }): Promise<string>
  /** POM XML → 渲染指定页 PNG 并落盘（单页为文件路径，多页为目录），返回文件路径列表 */
  exportPptxToPngs(
    xml: string,
    options: { w: number; h: number; path: string; slides?: number[] }
  ): Promise<string[]>
}
