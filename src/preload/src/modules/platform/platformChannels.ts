/**
 * platform 域 IPC 契约：shell/dialog/clipboard/os/display/notification 六组通道常量与载荷类型。
 * preload 桥与 main handler 共用，保持两侧契约一致。
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
  copyImageByPath: 'clipboard:copyImageByPath',
  getCopyedFiles: 'clipboard:getCopyedFiles'
} as const

// ── os ─────────────────────────────────────────────────────
export const OsChannels = {
  isDarkColors: 'os:isDarkColors',
  isDev: 'os:isDev',
  getNativeId: 'os:getNativeId',
  getAppVersion: 'os:getAppVersion',
  getAppName: 'os:getAppName',
  /** 模块级同步初始化依赖（Constant.ts），使用 sendSync */
  getPath: 'os:getPath',
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
