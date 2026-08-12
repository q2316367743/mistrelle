/**
 * PPT 专家模块类型定义。
 * 文件存储：沙盒 outputs/slides-{version}.pom.xml（版本化，正则 ^slides-(\d+)\.pom\.xml$）。
 */

/** outputs/ 下的版本文件信息（refreshFiles 扫描产物） */
export interface PptFileInfo {
  version: number
  name: string
  path: string
  updatedTime: number
}

/** 当前打开的 PPT 文档（current 状态） */
export interface PptCurrentDoc {
  version: number
  name: string
  /** POM XML 全文（渲染 / 编辑的数据源） */
  xml: string
}

/** SVG 渲染状态（自动渲染驱动） */
export type PptRenderState = 'idle' | 'rendering' | 'error'

/**
 * ppt_batch_edit 的批量操作（slide 粒度，同批校验、任一失败整体回滚）：
 * - add：插入新页（at 缺省追加到末尾）
 * - update：替换指定页
 * - remove：删除页
 * - move：调整页序
 * - rewrite：全量重写（兜底）
 */
export type PptBatchOp =
  | { op: 'add'; at?: number; xml: string }
  | { op: 'update'; index: number; xml: string }
  | { op: 'remove'; index: number }
  | { op: 'move'; from: number; to: number }
  | { op: 'rewrite'; xml: string }

/** 渲染尺寸：16:9 标准画布（与 ppt_guidelines 一致） */
export const PPT_SLIDE_SIZE = { w: 1280, h: 720 } as const
