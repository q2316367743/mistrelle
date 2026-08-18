/**
 * IPC 通道常量与载荷类型（preload 桥与 main handler 共用，保持两侧契约一致）
 */

// ── shell ──────────────────────────────────────────────────
export const ShellChannels = {
  openExternal: 'shell:openExternal',
  openPath: 'shell:openPath',
  trashItem: 'shell:trashItem',
  showItemInFolder: 'shell:showItemInFolder',
  beep: 'shell:beep'
} as const

// ── dialog ─────────────────────────────────────────────────
export const DialogChannels = {
  open: 'dialog:open',
  save: 'dialog:save'
} as const

export interface DialogOpenOptions {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  filters?: { name: string; extensions: string[] }[]
  properties?: string[]
  message?: string
}

export interface DialogSaveOptions {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  filters?: { name: string; extensions: string[] }[]
  message?: string
  nameFieldLabel?: string
  properties?: string[]
}

// ── clipboard ──────────────────────────────────────────────
export const ClipboardChannels = {
  copyText: 'clipboard:copyText',
  copyFile: 'clipboard:copyFile',
  copyImage: 'clipboard:copyImage',
  getCopyedFiles: 'clipboard:getCopyedFiles'
} as const

// ── os ─────────────────────────────────────────────────────
export const OsChannels = {
  isDarkColors: 'os:isDarkColors',
  isMacOS: 'os:isMacOS',
  isWindows: 'os:isWindows',
  isLinux: 'os:isLinux',
  isDev: 'os:isDev',
  getNativeId: 'os:getNativeId',
  getAppVersion: 'os:getAppVersion',
  getAppName: 'os:getAppName',
  /** 模块级同步初始化依赖（Constant.ts），使用 sendSync */
  getPath: 'os:getPath',
  getFileIcon: 'os:getFileIcon',
  getCursorScreenPoint: 'os:getCursorScreenPoint'
} as const

// ── display ────────────────────────────────────────────────
export const DisplayChannels = {
  getPrimaryDisplay: 'display:getPrimaryDisplay',
  getAllDisplays: 'display:getAllDisplays',
  getDisplayNearestPoint: 'display:getDisplayNearestPoint',
  getDisplayMatching: 'display:getDisplayMatching',
  screenToDipPoint: 'display:screenToDipPoint',
  dipToScreenPoint: 'display:dipToScreenPoint',
  screenToDipRect: 'display:screenToDipRect',
  dipToScreenRect: 'display:dipToScreenRect',
  desktopCaptureSources: 'display:desktopCaptureSources'
} as const

// ── notification ───────────────────────────────────────────
export const NotificationChannels = {
  show: 'notification:show'
} as const

// ── fs ─────────────────────────────────────────────────────
export const FsChannels = {
  readDir: 'fs:readDir',
  writeTextFile: 'fs:writeTextFile',
  readTextFile: 'fs:readTextFile',
  readBinaryFile: 'fs:readBinaryFile',
  existsSync: 'fs:existsSync',
  mkdir: 'fs:mkdir',
  rm: 'fs:rm',
  copyFile: 'fs:copyFile',
  rename: 'fs:rename',
  writeBinaryFile: 'fs:writeBinaryFile',
  stat: 'fs:stat'
} as const

// ── shellExec ──────────────────────────────────────────────
export const ShellExecChannels = {
  cliRun: 'shellExec:cliRun',
  jsRun: 'shellExec:jsRun'
} as const

export interface CliRunOptions {
  cwd?: string
  timeout?: number
  /** 写入子进程 stdin 的内容（写完后自动 end），用于 heredoc 类命令（如 ego-browser nodejs） */
  stdin?: string
}

export interface CliRunResult {
  stdout?: string
  stderr?: string
  exitCode?: number | null
  signal?: string
  error?: string
}

export interface JsRunResult {
  result?: unknown
  stdout?: string
  error?: string
}

// ── font ───────────────────────────────────────────────────
export const FontChannels = {
  listFonts: 'font:listFonts',
  listSystemFonts: 'font:listSystemFonts',
  listLibrary: 'font:listLibrary',
  addFont: 'font:addFont',
  removeFont: 'font:removeFont',
  updateFontMeta: 'font:updateFontMeta',
  parseFontFamilyName: 'font:parseFontFamilyName',
  readFont: 'font:readFont'
} as const

// ── db ─────────────────────────────────────────────────────
export const DbChannels = {
  get: 'db:get',
  put: 'db:put',
  remove: 'db:remove',
  bulkDocs: 'db:bulkDocs',
  allDocs: 'db:allDocs'
} as const

/** 简化后的文档形态：无 _rev / 无附件（utools 兼容层只保留 value 语义） */
export interface DbDoc<T = unknown> {
  _id: string
  value?: T
}

export interface DbPutResult {
  ok: boolean
  id: string
  error?: boolean
  message?: string
}

export interface DbRemoveResult {
  ok: boolean
  id: string
  error?: boolean
  message?: string
}

// ── ffmpeg ─────────────────────────────────────────────────
export const FfmpegChannels = {
  run: 'ffmpeg:run',
  kill: 'ffmpeg:kill',
  quit: 'ffmpeg:quit',
  /** main → renderer 进度推送（webContents.send） */
  progress: 'ffmpeg:progress',
  /** main → renderer 结束推送（webContents.send） */
  done: 'ffmpeg:done'
} as const

export interface FfmpegProgress {
  bitrate?: string
  fps?: number
  frame?: number
  percent?: number
  q?: number | string
  size?: string
  speed?: string
  time?: string
}

export interface FfmpegRunResult {
  id: number
}

export interface FfmpegDonePayload {
  id: number
  exitCode?: number | null
  signal?: string
  error?: string
}

// ── sharp ──────────────────────────────────────────────────
export const SharpChannels = {
  metadata: 'sharp:metadata',
  crop: 'sharp:crop',
  removeBackground: 'sharp:removeBackground',
  colorMap: 'sharp:colorMap'
} as const

export interface SharpRegion {
  left: number
  top: number
  width: number
  height: number
}

export interface SharpMetadata {
  format?: string
  width?: number
  height?: number
  space?: string
  channels?: number
}

export interface SharpCropResult {
  width?: number
  height?: number
}

export interface SharpRemoveBackgroundResult {
  width: number
  height: number
  removedPixels: number
}

export interface SharpColorMapResult {
  width: number
  height: number
  /** 网格列数 / 行数（按宽高比缩放，非强制正方形） */
  cols: number
  rows: number
  /** 全局主色 Top-N，ratio 为该色在非透明格中的占比 */
  palette: Array<{ hex: string; ratio: number }>
  /** 突兀区域 Top-N（按与 8 邻域的最大 LAB ΔE 降序），坐标为原图像素 */
  anomalies: Array<{
    row: number
    col: number
    x: number
    y: number
    width: number
    height: number
    color: string
    deviation: number
  }>
}

// ── ppt ────────────────────────────────────────────────────
/**
 * SlideNode：通用节点（tag 即渲染组件类型），child 为字符串表示文本内容。
 * id 为节点唯一标识（**顶层字段，与 tag 并列**，自动生成）：不进 attr、不参与布局，
 * 服务节点点选引用与 ppt_batch_edit 精准编辑。
 * 注意：与 renderer 的 src/renderer/src/modules/ppt/pptTypes.ts 形状一致，修改需同步。
 */
export interface SlideNode {
  id?: string
  tag: string
  attr: Record<string, string>
  child: Array<SlideNode> | string
}

/**
 * PPT 文档 JSON（存储文件 {name}.ppt.json 的内容）：
 * slide 每项是一页的根节点数组；预览由渲染进程 vueRender 直接渲染。
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

// ── 导出快照（与 renderer pptTypes.ts 同步；坐标为画布 px） ──

export interface PptItemBase {
  x: number
  y: number
  w: number
  h: number
  /** 旋转（度，顺时针，绕中心） */
  rotate?: number
  opacity?: number
  zIndex?: number
  nodeId?: string
}

export interface PptShadowInput {
  type: 'outer' | 'inner'
  color: string
  opacity?: number
  blur?: number
  offset?: number
  angle?: number
}

export interface PptFillInput {
  color?: string
  gradient?: string
  transparency?: number
}

export interface PptStrokeInput {
  color: string
  width: number
  dashType?: string
}

export interface PptTextItem extends PptItemBase {
  kind: 'text'
  text: string
  fontSize: number
  color: string
  fontFamily: string
  bold: boolean
  italic: boolean
  strike: boolean
  underline: boolean
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle'
  lineHeightPx: number
  letterSpacingPx?: number
  subscript?: boolean
  superscript?: boolean
}

export interface PptRectItem extends PptItemBase {
  kind: 'rect'
  fill?: PptFillInput
  radius?: number
  stroke?: PptStrokeInput
  shadow?: PptShadowInput
}

export interface PptEllipseItem extends PptItemBase {
  kind: 'ellipse'
  fill?: PptFillInput
  stroke?: PptStrokeInput
  shadow?: PptShadowInput
}

export interface PptShapeItem extends PptItemBase {
  kind: 'shape'
  shapeType: string
  fill?: PptFillInput
  stroke?: PptStrokeInput
  shadow?: PptShadowInput
}

export interface PptImageItem extends PptItemBase {
  kind: 'image'
  src: string
  sizing?: 'contain' | 'cover'
}

export interface PptLineItem extends PptItemBase {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  width: number
  dashType?: string
  beginArrow?: string
  endArrow?: string
  nodeId?: string
}

export interface PptChartSeries {
  name: string
  labels: string[]
  values: number[]
}

export interface PptChartItem extends PptItemBase {
  kind: 'chart'
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'doughnut' | 'radar'
  data: PptChartSeries[]
  chartColors?: string[]
  title?: string
  showTitle?: boolean
  showLegend?: boolean
  sparkline?: boolean
  radarStyle?: string
}

export type PptExportItem =
  | PptTextItem
  | PptRectItem
  | PptEllipseItem
  | PptShapeItem
  | PptImageItem
  | PptLineItem
  | PptChartItem

export interface PptExportSlide {
  items: PptExportItem[]
}

export interface PptExportSnapshot {
  w: number
  h: number
  slides: PptExportSlide[]
}

export const PptChannels = {
  /** PptExportSnapshot → 构建 PPTX 并直接落盘（导出 PPTX；主进程 PptxGenJS 按绝对坐标摆放） */
  exportPptx: 'ppt:exportPptx',
  /** PNG dataURL 列表落盘（渲染进程 canvas 绘制；单页为文件路径，多页为目录 page-{n}.png） */
  writePngFiles: 'ppt:writePngFiles'
} as const

export interface PptExportPptxOptions {
  /** PPTX 文件保存路径 */
  path: string
}

export interface PptWritePngFilesOptions {
  /** 单页导出为文件路径；多页导出为目录（每页写 page-{n}.png） */
  targetPath: string
  /** 各图对应的 1 起始页码 */
  pages: number[]
}

// ── browserTool ────────────────────────────────────────────
export const BrowserToolChannels = {
  /** 执行浏览器工具（browser_fetch / browser_actions）：main 内直接创建隐藏窗口执行 */
  run: 'browserTool:run'
} as const

/** browser_fetch 载荷：隐藏窗口导航 + 等待渲染 + 提取内容 */
export interface BrowserToolFetchPayload {
  kind: 'fetch'
  /** 目标 URL */
  url: string
  /** 等待 JS 渲染的毫秒数（默认 3000） */
  waitMs?: number
  /** 输出格式：markdown（默认）/ text / html */
  mode?: 'markdown' | 'text' | 'html'
  /** CSS 选择器：只提取匹配元素（未命中抛错），省略则提取整页 */
  selector?: string
}

/** browser_actions 的单步操作（type + 类型相关字段，与工具 schema 一致） */
export interface BrowserToolActionStep {
  /** 操作类型：goto/click/value/evaluate/wait/screenshot/press/paste/scroll/cookies/getHtml/getText/getTitle/hide/show/viewport/useragent/css */
  type: string
  [key: string]: unknown
}

/** browser_actions 载荷：步骤数组 + 窗口配置 */
export interface BrowserToolActionsPayload {
  kind: 'actions'
  steps: BrowserToolActionStep[]
  /** 窗口配置（show: true 时显示窗口） */
  options?: {
    show?: boolean
    width?: number
    height?: number
    [key: string]: unknown
  }
}

export type BrowserToolPayload = BrowserToolFetchPayload | BrowserToolActionsPayload

/** browserTool 运行结果（main BrowserToolRunner → preload） */
export interface BrowserToolResult {
  /** 收集的返回值列表（每个 evaluate 类步骤可能产生一个值） */
  data: unknown[]
  /** 是否出错 */
  error?: boolean
  /** 错误消息 */
  message?: string
}

// ── safeStorage ────────────────────────────────────────────
export const SafeStorageChannels = {
  encrypt: 'safeStorage:encrypt',
  decrypt: 'safeStorage:decrypt'
} as const
