/**
 * window.preload.inject 契约（Electron 迁移版）。
 *
 * 与原 utools 版本的差异：
 * - 删除平台专有能力：window / browser / input / simulate / feature / purchase / redirect / screen / ai / team
 * - 删除事件钩子：onPluginEnter / onPluginOut / onPluginDetach / onDbPull / onMainPush / outPlugin /
 *   readCurrentFolderPath / readCurrentBrowserUrl
 * - 除 os.getPath（Constant.ts 模块级同步初始化依赖）外，全部方法异步（Promise）
 * - db 简化：无 _rev 冲突检测、无附件（postAttachment / getAttachment / getAttachmentType 已删除）
 * - runBrowser 为浏览器工具统一入口（browser_fetch / browser_actions 共用，主进程内执行）
 */

// ── shell ──────────────────────────────────────────────────

interface InjectShell {
  openExternal(url: string): void
  openPath(fullPath: string): Promise<void>
  trashItem(filename: string): Promise<void>
  showItemInFolder(fullPath: string): void
  beep(): void
}

// ── dialog ─────────────────────────────────────────────────

interface InjectDialog {
  open(options?: {
    title?: string
    defaultPath?: string
    buttonLabel?: string
    filters?: { name: string; extensions: string[] }[]
    properties?: Array<
      | 'openFile'
      | 'openDirectory'
      | 'multiSelections'
      | 'showHiddenFiles'
      | 'createDirectory'
      | 'promptToCreate'
      | 'noResolveAliases'
      | 'treatPackageAsDirectory'
      | 'dontAddToRecent'
    >
    message?: string
    securityScopedBookmarks?: boolean
  }): Promise<string[] | undefined>

  save(options?: {
    title?: string
    defaultPath?: string
    buttonLabel?: string
    filters?: { name: string; extensions: string[] }[]
    message?: string
    nameFieldLabel?: string
    showsTagField?: string
    properties?: Array<
      | 'showHiddenFiles'
      | 'createDirectory'
      | 'treatPackageAsDirectory'
      | 'showOverwriteConfirmation'
      | 'dontAddToRecent'
    >
    securityScopedBookmarks?: boolean
  }): Promise<string | undefined>
}

// ── clipboard ──────────────────────────────────────────────

interface InjectClipboard {
  copyText(text: string): Promise<boolean>
  copyFile(file: string | string[]): Promise<boolean>
  copyImage(img: string | Uint8Array): Promise<boolean>
  getCopyedFiles(): Promise<{ isFile: boolean; isDirectory: boolean; name: string; path: string }[]>
}

// ── os ─────────────────────────────────────────────────────

interface InjectOs {
  isDarkColors(): Promise<boolean>
  isMacOS(): boolean
  isWindows(): boolean
  isLinux(): boolean
  isDev(): Promise<boolean>
  getNativeId(): Promise<string | null>
  getAppVersion(): Promise<string>
  getAppName(): Promise<string>
  /**
   * 唯一同步方法（sendSync）：Constant.ts 在模块级同步初始化中依赖。
   */
  getPath(
    name:
      | 'home'
      | 'appData'
      | 'userData'
      | 'cache'
      | 'temp'
      | 'exe'
      | 'module'
      | 'desktop'
      | 'documents'
      | 'downloads'
      | 'music'
      | 'pictures'
      | 'videos'
      | 'logs'
      | 'pepperFlashSystemPlugin'
  ): string
  getFileIcon(filePath: string): Promise<string>
  getCursorScreenPoint(): Promise<{ x: number; y: number }>
}

// ── display ────────────────────────────────────────────────

interface InjectDisplay {
  getPrimaryDisplay(): Promise<{
    id: number
    internal: boolean
    monochrome: boolean
    rotation: number
    scaleFactor: number
    touchSupport: 'available' | 'unavailable' | 'unknown'
    accelerometerSupport: 'available' | 'unavailable' | 'unknown'
    colorDepth: number
    colorSpace: string
    depthPerComponent: number
    size: { width: number; height: number }
    workArea: { width: number; height: number }
    workAreaSize: { width: number; height: number }
    bounds: { x: number; y: number; width: number; height: number }
  }>

  getAllDisplays(): Promise<
    {
      id: number
      internal: boolean
      monochrome: boolean
      rotation: number
      scaleFactor: number
      touchSupport: 'available' | 'unavailable' | 'unknown'
      accelerometerSupport: 'available' | 'unavailable' | 'unknown'
      colorDepth: number
      colorSpace: string
      depthPerComponent: number
      size: { width: number; height: number }
      workArea: { width: number; height: number }
      workAreaSize: { width: number; height: number }
      bounds: { x: number; y: number; width: number; height: number }
    }[]
  >

  getDisplayNearestPoint(point: { x: number; y: number }): Promise<{
    id: number
    bounds: { x: number; y: number; width: number; height: number }
    size: { width: number; height: number }
    workArea: { x: number; y: number; width: number; height: number }
    workAreaSize: { x: number; y: number; width: number; height: number }
    scaleFactor: number
    rotation: number
    internal: boolean
  }>

  getDisplayMatching(rect: { x: number; y: number; width: number; height: number }): Promise<{
    id: number
    bounds: { x: number; y: number; width: number; height: number }
    size: { width: number; height: number }
    workArea: { x: number; y: number; width: number; height: number }
    workAreaSize: { x: number; y: number; width: number; height: number }
    scaleFactor: number
    rotation: number
  }>

  screenToDipPoint(point: { x: number; y: number }): Promise<{ x: number; y: number }>
  dipToScreenPoint(point: { x: number; y: number }): Promise<{ x: number; y: number }>
  screenToDipRect(rect: { x: number; y: number; width: number; height: number }): Promise<{
    x: number
    y: number
    width: number
    height: number
  }>
  dipToScreenRect(rect: { x: number; y: number; width: number; height: number }): Promise<{
    x: number
    y: number
    width: number
    height: number
  }>
  desktopCaptureSources(options: {
    types: string[]
    thumbnailSize?: { width: number; height: number }
    fetchWindowIcons?: boolean
  }): Promise<
    {
      appIcon?: string
      display_id: string
      id: string
      name: string
      thumbnail: string
    }[]
  >
}

// ── notification ───────────────────────────────────────────

interface InjectNotification {
  show(body: string, featureName?: string): void
}

// ── ffmpeg ─────────────────────────────────────────────────

interface InjectFfmpegProgress {
  bitrate?: string
  fps?: number
  frame?: number
  percent?: number
  q?: number | string
  size?: string
  speed?: string
  time?: string
}

interface InjectFfmpegPromise extends Promise<void> {
  /** 强制终止进程 */
  kill(): void
  /** 优雅退出（向 stdin 发送 q） */
  quit(): void
}

interface InjectFfmpeg {
  run(args: string[], onProgress?: (progress: InjectFfmpegProgress) => void): InjectFfmpegPromise
}

// ── sharp ──────────────────────────────────────────────────

interface InjectSharpRegion {
  left: number
  top: number
  width: number
  height: number
}

interface InjectSharpCropResult {
  width?: number
  height?: number
}

interface InjectSharpMetadata {
  width?: number
  height?: number
  format?: string
  space?: string
  channels?: number
}

interface InjectSharpRemoveBackgroundOptions {
  /** 要去除的背景色：hex（#ffffff）/ rgb() / [r,g,b]，默认纯白 */
  color?: string | [number, number, number]
  /** 颜色容差 0~255，默认 40 */
  tolerance?: number
}

interface InjectSharpRemoveBackgroundResult {
  width: number
  height: number
  /** 被置为透明的像素数（0 表示未匹配到背景色） */
  removedPixels: number
}

interface InjectSharpColorMapResult {
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

interface InjectSharp {
  /** 读取图片元信息（宽高 / 格式） */
  metadata(input: string | Uint8Array | ArrayBuffer): Promise<InjectSharpMetadata>
  /** 裁剪指定区域并输出 PNG 文件，返回裁剪后宽高 */
  crop(input: string, region: InjectSharpRegion, output: string): Promise<InjectSharpCropResult>
  /**
   * 去除图片「从外到内的连续背景色」（flood fill）：从四边边缘像素出发，
   * 与目标色在容差内且与边缘连通的像素全部置为透明，输出 PNG。
   */
  removeBackground(
    input: string,
    options: InjectSharpRemoveBackgroundOptions,
    output: string
  ): Promise<InjectSharpRemoveBackgroundResult>
  /**
   * 颜色分布分析：按宽高比缩放为 gridSize 长边网格，返回全局主色 palette 与
   * 突兀区域 anomalies（每格与 8 邻域的 LAB ΔE 最大色差 Top-N）。
   */
  colorMap(input: string, gridSize: number, top: number): Promise<InjectSharpColorMapResult>
}

// ── browserTool（浏览器工具） ────────────────────────────────

/** runBrowser 载荷：browser_fetch（隐藏窗口抓取网页内容） */
interface InjectRunBrowserFetchPayload {
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
interface InjectRunBrowserActionStep {
  type: string
  [key: string]: unknown
}

/** runBrowser 载荷：browser_actions（自动化操作步骤） */
interface InjectRunBrowserActionsPayload {
  kind: 'actions'
  steps: InjectRunBrowserActionStep[]
  /** 窗口配置（show: true 时显示窗口） */
  options?: {
    show?: boolean
    width?: number
    height?: number
    [key: string]: unknown
  }
}

type InjectRunBrowserPayload = InjectRunBrowserFetchPayload | InjectRunBrowserActionsPayload

// ── 汇总 ───────────────────────────────────────────────────

interface InjectApi {

  shell: InjectShell
  dialog: InjectDialog
  clipboard: InjectClipboard
  os: InjectOs
  display: InjectDisplay
  notification: InjectNotification

  /**
   * 浏览器工具统一入口（browser_fetch / browser_actions 共用，主进程内执行）。
   * resolve 最后一个数据项（fetch 为提取内容，actions 为最后一个 evaluate 类结果），出错时 reject。
   */
  runBrowser(payload: InjectRunBrowserPayload): Promise<unknown>

  ffmpeg: InjectFfmpeg
  sharp: InjectSharp
}
