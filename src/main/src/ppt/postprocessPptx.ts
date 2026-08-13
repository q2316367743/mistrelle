/**
 * PPTX 后处理（主进程）：让 PPTX 对「渲染字体 ≠ 测量字体」自适应，使预览 SVG /
 * 导出 PNG / 导出 PPTX 三端展示一致。
 *
 * 背景：@hirokisakabe/pom 用内置 Noto Sans JP 度量文本，把文本框冻结为
 * 「Noto 测宽 + 10px」的绝对坐标；导出 PPTX 不内嵌字体、也不写 autofit。
 * 打开方缺 Noto 时替换字体更宽 → 按 wrap="square" 重排成多行 → 超出冻结框高
 * → 与相邻元素重叠；而 pptx-glimpse 在本机渲染、字体与 Noto 度量一致，所以
 * 预览正常 —— 造成「图片对、PPT 错」的表象。
 *
 * 改写规则（POM 输出结构确定，用可控正则；匹配不到即跳过）：
 *  - 正文文本框（<p:txBody>）：wrap="square" → "none" + 注入
 *    <a:normAutofit/>（溢出自动收缩，与 PowerPoint「Shrink text on overflow」
 *    一致）。POM 输出本就是「每段一行」，禁止软换行后行数恒定，不会出现
 *    「多出来的一行顶到相邻元素」；某行过宽时由渲染端收缩字号适配冻结框。
 *  - 行距保持 spcPts（固定磅值），不做 spcPct 换算：spcPct 是相对字体自然
 *    行高的百分比，导出端无法移植换算，改反而失真（实测 glimpse 对固定
 *    spcPts 也会乘 (1 - lnSpcReduction)，故 normAutofit 的 lnSpcReduction
 *    必须写 0 表示不缩减行距）。
 *  - 表格单元格（<a:txBody>）：rPr 缺 typeface 时补 Noto Sans JP，与正文统一。
 *
 * 该模块在 buildPptx 之后、三路导出之前统一调用，预览 / PNG / PPTX 共用同一
 * 份字节，保证任何渲染器下结构一致。
 */
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'

/** normAutofit 注入片段：100% 字号起步、不缩减行距，溢出时由渲染端自动收缩 */
const NORM_AUTOFIT = '<a:normAutofit fontScale="100000" lnSpcReduction="0"/>'

/** 仅改写 ppt/slides/slideN.xml */
const isSlideXml = (name: string): boolean => /^ppt\/slides\/slide\d+\.xml$/.test(name)

/** 单个 slide XML：正文文本框 wrap=none + normAutofit；表格单元格补 typeface */
const processSlideXml = (xml: string): string => {
  // 正文文本框（<p:txBody>）：禁止软换行 + 溢出自动收缩
  const body = xml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/g, (block) => {
    const wrapNone = block.replace(/<a:bodyPr\b[^>]*?\bwrap="square"/, (m) =>
      m.replace('wrap="square"', 'wrap="none"')
    )
    return wrapNone.replace(
      /(<a:bodyPr\b[^>]*?)\s*\/>/,
      `$1>${NORM_AUTOFIT}</a:bodyPr>`
    )
  })
  // 表格单元格（<a:txBody>）：rPr 缺 typeface 时补齐，与正文统一
  return body.replace(/<a:txBody>[\s\S]*?<\/a:txBody>/g, (block) =>
    block.replace(
      /<a:rPr\b([^>]*)>([\s\S]*?)<\/a:rPr>/g,
      (full, attrs: string, inner: string) =>
        inner.includes('<a:latin')
          ? full
          : `<a:rPr${attrs}><a:latin typeface="Noto Sans JP"/><a:ea typeface="Noto Sans JP"/><a:cs typeface="Noto Sans JP"/>${inner}</a:rPr>`
    )
  )
}

/** 解压 → 改写 slide XML → 重打包（未命中改写时内容不变） */
export const postprocessPptx = (buf: Uint8Array): Uint8Array => {
  const entries = unzipSync(buf)
  for (const name of Object.keys(entries)) {
    if (!isSlideXml(name)) continue
    const xml = strFromU8(entries[name])
    const next = processSlideXml(xml)
    if (next !== xml) entries[name] = strToU8(next)
  }
  return zipSync(entries)
}
