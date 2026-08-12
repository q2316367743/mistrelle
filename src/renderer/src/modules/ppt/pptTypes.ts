/**
 * PPT 专家模块类型定义。
 * 文件存储：沙盒 outputs/{name}.pom.xml（单一文件持续编辑；一个文件含多个 Slide 页面）。
 * POM 结构：<Theme> 顶级元素（全局色板）+ 多个 <Slide>（每页一个）。
 */

/** outputs/ 下的 PPT 文件信息（refreshFiles 扫描产物，id = 文件名） */
export interface PptFileInfo {
  id: string
  name: string
  path: string
  updatedTime: number
}

/** 当前打开的 PPT 文档（current 状态） */
export interface PptCurrentDoc {
  id: string
  name: string
  /** POM XML 全文（渲染 / 编辑的数据源） */
  xml: string
}

/** SVG 渲染状态（自动渲染驱动） */
export type PptRenderState = 'idle' | 'rendering' | 'error'

/** 渲染尺寸：16:9 标准画布（与 ppt_guidelines 一致） */
export const PPT_SLIDE_SIZE = { w: 1280, h: 720 } as const

/** Theme 令牌表：token 名 → 6 位 hex 颜色 */
export type PptTheme = Record<string, string>
