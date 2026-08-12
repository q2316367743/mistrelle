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
  removeBackground: 'sharp:removeBackground'
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
