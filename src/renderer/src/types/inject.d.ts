interface InjectAiModel {
  id: string
  label: string
  description: string
  icon: string
  cost: number
}

interface InjectAiMessage {
  role: 'system' | 'user' | 'assistant'
  content?: string
  reasoning_content?: string
}

interface InjectAiTool {
  type: 'function'
  function?: {
    name: string
    description: string
    parameters: Record<string, any>
    required?: string[]
  }
}

interface InjectAiOption {
  model?: string
  messages: InjectAiMessage[]
  tools?: InjectAiTool[]
}

interface InjectAiResult<T> extends Promise<T> {
  abort(): void
}

type InjectDbDoc<T extends Record<string, any> = Record<string, any>> = {
  _id: string
  _rev?: string
} & T

interface InjectDbReturn {
  id: string
  rev?: string
  ok?: boolean
  error?: boolean
  name?: string
  message?: string
}

interface InjectFfmpegProgress {
  bitrate: string
  fps: number
  frame: number
  percent?: number
  q: number | string
  size: string
  speed: string
  time: string
}

interface InjectFfmpegPromise extends Promise<void> {
  kill(): void
  quit(): void
}

interface InjectMainPushResult {
  icon?: string
  text: string
  title?: string
}

interface InjectPluginFeature {
  code: string
  explain?: string
  platform?: 'darwin' | 'win32' | 'linux' | Array<'darwin' | 'win32' | 'linux'>
  icon?: string
  cmds: (
    | string
    | {
        type: 'img' | 'files' | 'regex' | 'over' | 'window'
        label: string
      }
  )[]
  mainHide?: boolean
  mainPush?: boolean
}

interface InjectShell {
  openExternal(url: string): void
  openPath(fullPath: string): void
  trashItem(filename: string): Promise<void>
  showItemInFolder(fullPath: string): void
  beep(): void
}

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
  }): string[] | undefined

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
  }): string | undefined
}

interface InjectClipboard {
  copyText(text: string): boolean
  copyFile(file: string | string[]): boolean
  copyImage(img: string | Uint8Array): boolean
  getCopyedFiles(): { isFile: boolean; isDirectory: boolean; name: string; path: string }[]
}

interface InjectOs {
  isDarkColors(): boolean
  isMacOS(): boolean
  isWindows(): boolean
  isLinux(): boolean
  isDev(): boolean
  /**
   * 获取当前登录用户信息。
   * @platform ZTools 不支持，返回 null
   */
  getUser(): { avatar: string; nickname: string; type: string } | null
  getNativeId(): string
  getAppVersion(): string
  getAppName(): string
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
  getFileIcon(filePath: string): string
  getCursorScreenPoint(): { x: number; y: number }
}

interface InjectDisplay {
  getPrimaryDisplay(): {
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
  }

  getAllDisplays(): {
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

  getDisplayNearestPoint(point: { x: number; y: number }): {
    id: number
    bounds: { x: number; y: number; width: number; height: number }
    size: { width: number; height: number }
    workArea: { width: number; height: number }
    workAreaSize: { width: number; height: number }
    scaleFactor: number
    rotation: number
    internal: boolean
  }

  getDisplayMatching(rect: { x: number; y: number; width: number; height: number }): {
    id: number
    bounds: { x: number; y: number; width: number; height: number }
    size: { width: number; height: number }
    workArea: { width: number; height: number }
    workAreaSize: { width: number; height: number }
    scaleFactor: number
    rotation: number
  }

  screenToDipPoint(point: { x: number; y: number }): { x: number; y: number }
  dipToScreenPoint(point: { x: number; y: number }): { x: number; y: number }
  screenToDipRect(rect: { x: number; y: number; width: number; height: number }): {
    x: number
    y: number
    width: number
    height: number
  }
  dipToScreenRect(rect: { x: number; y: number; width: number; height: number }): {
    x: number
    y: number
    width: number
    height: number
  }
  desktopCaptureSources(options: {
    types: string[]
    thumbnailSize?: { width: number; height: number }
    fetchWindowIcons?: boolean
  }): Promise<{
    appIcon: Record<string, any>
    display_id: string
    id: string
    name: string
    thumbnail: Record<string, any>
  }>
}

interface InjectWindow {
  hideMainWindow(isRestorePreWindow?: boolean): boolean
  showMainWindow(): boolean
  setExpendHeight(height: number): boolean
  getWindowType(): 'main' | 'detach' | 'browser'
  hideMainWindowTypeString(str: string): void
  hideMainWindowPasteFile(file: string | string[]): void
  hideMainWindowPasteImage(img: string | Uint8Array): void
  hideMainWindowPasteText(text: string): void
  startDrag(file: string | string[]): void
}

interface InjectBrowser {
  createBrowserWindow(
    url: string,
    options: {
      title?: string
      width?: number
      height?: number
      x?: number
      y?: number
      minWidth?: number
      minHeight?: number
      maxWidth?: number
      maxHeight?: number
      resizable?: boolean
      movable?: boolean
      minimizable?: boolean
      maximizable?: boolean
      closable?: boolean
      alwaysOnTop?: boolean
      fullscreen?: boolean
      fullscreenable?: boolean
      skipTaskbar?: boolean
      frame?: boolean
      transparent?: boolean
      backgroundColor?: string
      hasShadow?: boolean
      titleBarStyle?: 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover'
      thickFrame?: boolean
      vibrancy?: string
      zoomToPageWidth?: boolean
      webPreferences?: {
        preload?: string
        nodeIntegration?: boolean
        contextIsolation?: boolean
        enableRemoteModule?: boolean
      }
    },
    callback?: () => void
  ): {
    id: number
    close(): void
    focus(): void
    blur(): void
    isFocused(): boolean
    isDestroyed(): boolean
    show(): void
    hide(): void
    setSize(width: number, height: number): void
    setPosition(x: number, y: number): void
    reload(): void
    loadURL(url: string): void
    on(event: string, callback: (...args: any[]) => void): void
  }

  sendToParent(channel: string, ...params: any[]): void
  findInPage(
    text: string,
    options?: {
      forward?: boolean
      findNext?: boolean
      matchCase?: boolean
      wordStart?: boolean
      medialCapitalAsWordStart?: boolean
    }
  ): void
  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void
}

interface InjectInput {
  setSubInput(
    onChange: (input: { text: string }) => void,
    placeholder?: string,
    isFocus?: boolean
  ): boolean
  removeSubInput(): boolean
  setSubInputValue(value: string): boolean
  subInputFocus(): boolean
  subInputSelect(): boolean
  subInputBlur(): boolean
}

interface InjectSimulate {
  keyboardTap(
    key: string,
    ...modifier: ('control' | 'ctrl' | 'shift' | 'option' | 'alt' | 'command' | 'super')[]
  ): void
  mouseClick(x?: number, y?: number): void
  mouseRightClick(x?: number, y?: number): void
  mouseDoubleClick(x?: number, y?: number): void
  mouseMove(x: number, y: number): void
}

interface InjectNotification {
  show(body: string, featureName?: string): void
}

interface InjectFeature {
  set(feature: InjectPluginFeature): boolean
  remove(code: string): boolean
  get(codes?: string[]): InjectPluginFeature[]
}

interface InjectPurchase {
  open(
    options: {
      goodsId: string
      outOrderId?: string
      attach?: string
    },
    callback?: () => void
  ): void

  pay(
    options: {
      goodsId: string
      outOrderId?: string
      attach?: string
    },
    callback?: () => void
  ): void

  getPayments(): Promise<
    {
      order_id: string
      total_fee: number
      body: string
      attach: string
      goods_id: string
      out_order_id: string
      paid_at: string
    }[]
  >

  isPurchased(): boolean
  getServerToken(): Promise<{ token: string; expiredAt: number }>
}

interface InjectRedirect {
  to(
    label: string | string[],
    payload: string | { type: 'text' | 'img' | 'files'; data: any }
  ): boolean
  hotKeySetting(cmdLabel: string, autocopy?: boolean): void
  aiModelsSetting(): void
}

interface InjectScreen {
  colorPick(callback: (color: { hex: string; rgb: string }) => void): void
  capture(callback: (imgBase64: string) => void): void
}

interface InjectAi {
  allModels(): Promise<InjectAiModel[]>
  chat(
    option: InjectAiOption,
    streamCallback: (chunk: InjectAiMessage) => void
  ): InjectAiResult<void>
  chat(option: InjectAiOption): InjectAiResult<InjectAiMessage>
}

interface InjectFfmpeg {
  run(args: string[], onProgress?: (progress: InjectFfmpegProgress) => void): InjectFfmpegPromise
}

interface InjectSharpRegion {
  left: number
  top: number
  width: number
  height: number
}

interface InjectSharpCropResult {
  width: number
  height: number
  format?: string
  size?: number
}

interface InjectSharpMetadata {
  width?: number
  height?: number
  format?: string
  size?: number
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
}

interface InjectDbPromises {
  put(doc: InjectDbDoc): Promise<InjectDbReturn>
  get<T extends Record<string, any> = Record<string, any>>(
    id: string
  ): Promise<InjectDbDoc<T> | null>
  remove(doc: string | InjectDbDoc): Promise<InjectDbReturn>
  bulkDocs(docs: InjectDbDoc[]): Promise<InjectDbReturn[]>
  allDocs<T extends Record<string, any> = Record<string, any>>(
    key?: string
  ): Promise<InjectDbDoc<T>[]>
  postAttachment(docId: string, attachment: Uint8Array, type: string): Promise<InjectDbReturn>
  getAttachment(docId: string): Promise<Uint8Array | null>
  getAttachmentType(docId: string): Promise<string | null>
  replicateStateFromCloud(): Promise<null | 0 | 1>
}

interface InjectDb {
  put(doc: InjectDbDoc): InjectDbReturn
  get<T extends Record<string, any> = Record<string, any>>(id: string): InjectDbDoc<T> | null
  remove(doc: string | InjectDbDoc): InjectDbReturn
  bulkDocs(docs: InjectDbDoc[]): InjectDbReturn[]
  allDocs<T extends Record<string, any> = Record<string, any>>(key?: string): InjectDbDoc<T>[]
  postAttachment(docId: string, attachment: Uint8Array, type: string): InjectDbReturn
  getAttachment(docId: string): Uint8Array | null
  getAttachmentType(docId: string): string | null
  replicateStateFromCloud(): null | 0 | 1
  promises: InjectDbPromises
}

interface InjectDbStorage {
  setItem(key: string, value: any): void
  getItem<T = any>(key: string): T
  removeItem(key: string): void
}

interface InjectDbCryptoStorage {
  setItem(key: string, value: any): void
  getItem<T = any>(key: string): T
  removeItem(key: string): void
}

interface InjectTeam {
  info(): {
    teamId: string
    teamName: string
    teamLogo: string
    userId: string
    userName: string
    userAvatar: string
  }
  preset<T = any>(key: string): T
  allPresets(): Promise<{ key: string; value: any }[]>
}

interface CookieFilter {
  url?: string
  name?: string
  domain?: string
  path?: string
  secure?: boolean
  session?: boolean
  httpOnly?: boolean
}

/**
 * 浏览器自动化 API（uTools uBrowser / ZTools zBrowser 的兼容层）
 *
 * 链式调用，所有中间方法返回 this，最终通过 run() 执行并返回 Promise
 */
interface InjectCBrowser {
  useragent(userAgent: string): this
  /**
   * 前往指定地址
   * @param url 链接地址，支持 http 或 file 协议
   * @param headers 请求头参数
   * @param timeout 加载超时，默认 60000 ms
   */
  goto(url: string, headers?: { Referer: string; userAgent: string }, timeout?: number): this
  viewport(width: number, height: number): this
  hide(): this
  show(): this
  /** 注入样式 */
  css(css: string): this
  /** 键盘按键 */
  press(key: string, ...modifier: ('ctrl' | 'shift' | 'alt' | 'meta')[]): this
  /**
   * 粘贴
   * @param text 图片 base64 编码字符串时粘贴图片，为空只执行粘贴动作
   */
  paste(text?: string): this
  /**
   * 页面截图
   * @param arg 字符串为 CSS 选择器，对象为截图区域，空为截取整个窗口
   * @param savePath 保存路径，默认临时目录
   */
  screenshot(arg: string | { x: number; y: number; width: number; height: number }, savePath?: string): this
  /** 转为 markdown 文本 */
  markdown(selector?: string): this
  /** 保存为 PDF */
  pdf(options?: { marginsType: 0 | 1 | 2; pageSize: 'A3' | 'A4' | 'A5' | 'Legal' | 'Letter' | 'Tabloid' | { width: number; height: number } }, savePath?: string): this
  /** 模拟设备 */
  device(arg: { size: { width: number; height: number }; useragent: string }): this
  /** 获取 cookie，name 为空时获取当前 url 全部 cookie */
  cookies(name?: string): this
  /** 按条件获取 cookie */
  cookies(filter: CookieFilter): this
  /** 设置单个 cookie */
  setCookies(name: string, value: string): this
  /** 批量设置 cookie */
  setCookies(cookies: { name: string; value: string }[]): this
  /** 删除 cookie */
  removeCookies(name: string): this
  /** 清空 cookie */
  clearCookies(url?: string): this
  /** 打开开发者工具 */
  devTools(mode?: 'right' | 'bottom' | 'undocked' | 'detach'): this
  /** 在目标页面中执行 JS 并获取结果 */
  evaluate<T extends any[]>(func: (...params: T) => any, ...params: T): this
  /** 等待指定毫秒 */
  wait(ms: number): this
  /** 等待元素出现 */
  wait(selector: string, timeout?: number): this
  /** 等待 JS 函数返回 true */
  wait<T extends any[]>(func: (...params: T) => boolean, timeout?: number, ...params: T): this
  /** 当元素存在时执行，直到碰到 end */
  when(selector: string): this
  /** 当 JS 函数返回 true 时执行，直到碰到 end */
  when<T extends any[]>(func: (...params: T) => boolean, ...params: T): this
  /** 配合 when 使用，结束 when 块 */
  end(): this
  /** 单击元素 */
  click(selector: string): this
  /** 元素触发按下鼠标左键 */
  mousedown(selector: string): this
  /** 元素触发释放鼠标左键 */
  mouseup(selector: string): this
  /** 赋值 file input */
  file(selector: string, payload: string | string[] | Uint8Array): this
  /** input/textarea/select 赋值并触发 input/change 事件 */
  value(selector: string, value: string): this
  /** checkbox/radio 选中或取消选中 */
  check(selector: string, checked: boolean): this
  /** 元素获得焦点 */
  focus(selector: string): this
  /** 滚动到元素位置 */
  scroll(selector: string): this
  /** Y 轴滚动 */
  scroll(y: number): this
  /** X 轴和 Y 轴滚动 */
  scroll(x: number, y: number): this
  /** 下载文件 */
  download(url: string, savePath?: string): this
  /** 下载文件（通过函数生成 url） */
  download(func: (...params: any[]) => string, savePath: string | null, ...params: any[]): this
  /**
   * 启动 ubrowser 运行，运行结束后隐藏窗口自动销毁
   * @platform ZTools 部分参数可能不支持
   */
  run<T = any>(options?: {
    show?: boolean
    width?: number
    height?: number
    x?: number
    y?: number
    center?: boolean
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    resizable?: boolean
    movable?: boolean
    minimizable?: boolean
    maximizable?: boolean
    alwaysOnTop?: boolean
    fullscreen?: boolean
    fullscreenable?: boolean
    enableLargerThanScreen?: boolean
    opacity?: number
    frame?: boolean
    closable?: boolean
    focusable?: boolean
    skipTaskbar?: boolean
    backgroundColor?: string
    hasShadow?: boolean
    transparent?: boolean
    titleBarStyle?: string
    thickFrame?: boolean
  }): Promise<T>
  /** 在闲置的 ubrowser 实例上运行 */
  run<T = any>(ubrowserId: number): Promise<T>
}

interface InjectApi {
  getPlatform(): 'ZTools' | 'utools' | 'browser'

  shell: InjectShell
  dialog: InjectDialog
  clipboard: InjectClipboard
  os: InjectOs
  display: InjectDisplay
  window: InjectWindow
  browser: InjectBrowser
  cBrowser: InjectCBrowser
  input: InjectInput
  simulate: InjectSimulate
  notification: InjectNotification
  feature: InjectFeature
  purchase: InjectPurchase
  redirect: InjectRedirect
  screen: InjectScreen
  ai: InjectAi
  ffmpeg: InjectFfmpeg
  /** uTools 内置 Sharp；ZTools / browser 环境可能缺失（undefined） */
  sharp?: InjectSharp
  db: InjectDb
  dbStorage: InjectDbStorage
  dbCryptoStorage: InjectDbCryptoStorage
  team: InjectTeam

  onPluginEnter<T = any, L = any>(
    callback: (action: {
      code: string
      type: string
      payload: T
      option: L
      from?: 'main' | 'panel' | 'hotkey' | 'redirect'
    }) => void
  ): void

  onPluginOut(callback: (processExit: boolean) => void): void
  onPluginDetach(callback: () => void): void

  onDbPull<T extends Record<string, any> = Record<string, any>>(
    callback: (docs: InjectDbDoc<T>[]) => void
  ): void

  onMainPush<T = any>(
    callback: (action: {
      code: string
      type: string
      payload: T
    }) => InjectMainPushResult[] | Promise<InjectMainPushResult[]>,
    selectCallback: (action: {
      code: string
      type: string
      payload: any
      option: InjectMainPushResult
    }) => void
  ): void

  outPlugin(isKill?: boolean): boolean
  readCurrentFolderPath(): Promise<string>
  readCurrentBrowserUrl(): Promise<string>
}
