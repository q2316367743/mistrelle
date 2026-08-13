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
  getUser: 'os:getUser',
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
 * SlideNode：与 POM XML 标签一一对应的通用节点（tag 即 XML 标签名），
 * 渲染进程全程以此 JSON 形式存储 / 传输，仅在主进程导出时转换为 POM XML。
 * child 为字符串表示文本节点内容（如 <Text>Title</Text>）。
 * id 为节点唯一标识（**顶层字段，与 tag 并列**，自动生成）：不进 attr、不参与 POM 布局，
 * 主进程导出时仅对 POM 接受 id 的根标签代写 XML id 属性（Arrow 的 from/to 据此解析）。
 * 注意：与 renderer 的 src/renderer/src/modules/ppt/pptTypes.ts 形状一致，修改需同步。
 */
export interface SlideNode {
  id?: string
  tag: string
  attr: Record<string, string>
  child: Array<SlideNode> | string
}

/**
 * PPT 文档 JSON（存储文件 {name}.ppt.json 的内容，同时是 IPC 导出载荷）：
 * slide 每项是一页的根节点数组（对应 <Slide> 内的多个子元素）。
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

export const PptChannels = {
  /** PptJsonDoc → 每页 SVG 字符串数组（预览渲染；主进程转 POM XML 后 buildPptx） */
  renderPptxToSvgs: 'ppt:renderPptxToSvgs',
  /** PptJsonDoc → 构建 PPTX 并直接落盘（导出 PPTX；主进程完成，渲染进程不经手字节） */
  exportPptx: 'ppt:exportPptx',
  /** PptJsonDoc → 渲染指定页 PNG 并直接落盘（导出 PNG；单页为文件路径，多页为目录） */
  exportPptxToPngs: 'ppt:exportPptxToPngs'
} as const

export interface PptRenderOptions {
  w: number
  h: number
}

export interface PptExportPptxOptions extends PptRenderOptions {
  /** PPTX 文件保存路径 */
  path: string
}

export interface PptExportPngOptions extends PptRenderOptions {
  /** 单页导出为文件路径；多页导出为目录（每页写 page-{n}.png） */
  path: string
  /** 1 起始页码，缺省导出全部页 */
  slides?: number[]
}
