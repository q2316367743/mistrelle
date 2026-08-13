/**
 * PPT 专家模块类型定义。
 * 文件存储：沙盒 outputs/{name}.ppt.json（单一文件持续编辑；一个文件含多个 Slide 页面）。
 * 全程 JSON（SlideNode），渲染进程不涉及任何 xml；仅导出时由主进程转换为 POM XML。
 */

/**
 * SlideNode：与 POM XML 标签一一对应的通用节点（tag 即 XML 标签名），
 * child 为字符串表示文本节点内容（如 <Text>Title</Text>）。
 * 注意：与 preload 的 src/preload/src/channels.ts 形状一致（IPC 契约），修改需同步。
 */
export interface SlideNode {
  tag: string
  attr: Record<string, string>
  child: Array<SlideNode> | string
}

/**
 * PPT 文档 JSON（{name}.ppt.json 文件内容）：
 * slide 每项是一页的根节点数组（对应 <Slide> 内的多个子元素，POM 隐式 VStack 语义）。
 */
export interface PptJsonDoc {
  name: string
  /** 创建时间（Date.now() 毫秒） */
  createdAt: number
  /** 最近修改时间（Date.now() 毫秒） */
  updatedAt: number
  /** 主题令牌表：token 名 → 6 位 hex 颜色（渲染时引用为 $token） */
  theme: Record<string, string>
  slide: SlideNode[][]
}

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
  /** 文档 JSON（渲染 / 编辑的数据源） */
  json: PptJsonDoc
}

/** SVG 渲染状态（自动渲染驱动） */
export type PptRenderState = 'idle' | 'rendering' | 'error'

/** 渲染尺寸：16:9 标准画布（与 ppt_guidelines 一致） */
export const PPT_SLIDE_SIZE = { w: 1280, h: 720 } as const

/** Theme 令牌表：token 名 → 6 位 hex 颜色 */
export type PptTheme = Record<string, string>
