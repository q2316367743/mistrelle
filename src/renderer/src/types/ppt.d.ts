/** PPT 渲染桥类型（对应 preload/src/ppt.ts 的 pptApi） */
declare interface PptApi {
  /** POM XML → 每页 SVG 字符串数组（预览渲染） */
  renderPptxToSvgs(xml: string, options: { w: number; h: number }): Promise<string[]>
  /** POM XML → PPTX 字节（导出 PPTX） */
  buildPptxBytes(xml: string, options: { w: number; h: number }): Promise<ArrayBuffer>
  /** POM XML → 指定页 PNG 字节（导出 PNG，缺省全部页） */
  renderPptxToPngs(
    xml: string,
    options: { w: number; h: number; slides?: number[] }
  ): Promise<{ page: number; bytes: ArrayBuffer }[]>
}
