const platform = window.ztools ? 'ZTools' : window.utools ? 'utools' : 'browser'

const api = window.ztools || window.utools

/** 解析目标背景色：hex / rgb() / [r,g,b]，非法或缺省回退纯白 */
const parseTargetColor = (color) => {
  if (Array.isArray(color)) {
    const r = Number(color[0])
    const g = Number(color[1])
    const b = Number(color[2])
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [Math.round(r), Math.round(g), Math.round(b)]
    }
    return [255, 255, 255]
  }
  if (typeof color === 'string') {
    const hex = /^#?([0-9a-fA-F]{6})$/.exec(color.trim())
    if (hex) {
      const n = parseInt(hex[1], 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color.trim())
    if (rgb) {
      return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
    }
  }
  return [255, 255, 255]
}

/** 容差钳制到 0~255，非法回退默认 40 */
const clampTolerance = (t) => {
  const n = Number(t)
  if (!Number.isFinite(n)) return 40
  return Math.max(0, Math.min(255, Math.round(n)))
}

module.exports = {
  getPlatform: () => platform,

  shell: {
    openExternal: (url) => api.shellOpenExternal(url),
    openPath: (fullPath) => api.shellOpenPath(fullPath),
    trashItem: (filename) => api.shellTrashItem(filename),
    showItemInFolder: (fullPath) => api.shellShowItemInFolder(fullPath),
    beep: () => api.shellBeep(),
  },

  dialog: {
    open: (options) => api.showOpenDialog(options),
    save: (options) => api.showSaveDialog(options),
  },

  clipboard: {
    copyText: (text) => api.copyText(text),
    copyFile: (file) => api.copyFile(file),
    copyImage: (img) => api.copyImage(img),
    getCopyedFiles: () => api.getCopyedFiles(),
  },

  os: {
    isDarkColors: () => api.isDarkColors(),
    isMacOS: () => api.isMacOS(),
    isWindows: () => api.isWindows(),
    isLinux: () => api.isLinux(),
    isDev: () => api.isDev(),
    getUser: () => api.getUser(),
    getNativeId: () => api.getNativeId(),
    getAppVersion: () => api.getAppVersion(),
    getAppName: () => api.getAppName(),
    getPath: (name) => api.getPath(name),
    getFileIcon: (filePath) => api.getFileIcon(filePath),
    getCursorScreenPoint: () => api.getCursorScreenPoint(),
  },

  display: {
    getPrimaryDisplay: () => api.getPrimaryDisplay(),
    getAllDisplays: () => api.getAllDisplays(),
    getDisplayNearestPoint: (point) => api.getDisplayNearestPoint(point),
    getDisplayMatching: (rect) => api.getDisplayMatching(rect),
    screenToDipPoint: (point) => api.screenToDipPoint(point),
    dipToScreenPoint: (point) => api.dipToScreenPoint(point),
    screenToDipRect: (rect) => api.screenToDipRect(rect),
    dipToScreenRect: (rect) => api.dipToScreenRect(rect),
    desktopCaptureSources: (options) => api.desktopCaptureSources(options),
  },

  window: {
    hideMainWindow: (isRestorePreWindow) => api.hideMainWindow(isRestorePreWindow),
    showMainWindow: () => api.showMainWindow(),
    setExpendHeight: (height) => api.setExpendHeight(height),
    getWindowType: () => api.getWindowType(),
    hideMainWindowTypeString: (str) => api.hideMainWindowTypeString(str),
    hideMainWindowPasteFile: (file) => api.hideMainWindowPasteFile(file),
    hideMainWindowPasteImage: (img) => api.hideMainWindowPasteImage(img),
    hideMainWindowPasteText: (text) => api.hideMainWindowPasteText(text),
    startDrag: (file) => api.startDrag(file),
  },

  browser: {
    createBrowserWindow: (url, options, callback) => api.createBrowserWindow(url, options, callback),
    sendToParent: (channel, ...params) => api.sendToParent(channel, ...params),
    findInPage: (text, options) => api.findInPage(text, options),
    stopFindInPage: (action) => api.stopFindInPage(action),
  },

  cBrowser: api.ubrowser || api.zBrowser,

  input: {
    setSubInput: (onChange, placeholder, isFocus) => api.setSubInput(onChange, placeholder, isFocus),
    removeSubInput: () => api.removeSubInput(),
    setSubInputValue: (value) => api.setSubInputValue(value),
    subInputFocus: () => api.subInputFocus(),
    subInputSelect: () => api.subInputSelect(),
    subInputBlur: () => api.subInputBlur(),
  },

  simulate: {
    keyboardTap: (key, ...modifier) => api.simulateKeyboardTap(key, ...modifier),
    mouseClick: (x, y) => api.simulateMouseClick(x, y),
    mouseRightClick: (x, y) => api.simulateMouseRightClick(x, y),
    mouseDoubleClick: (x, y) => api.simulateMouseDoubleClick(x, y),
    mouseMove: (x, y) => api.simulateMouseMove(x, y),
  },

  notification: {
    show: (body, featureName) => api.showNotification(body, featureName),
  },

  feature: {
    set: (feature) => api.setFeature(feature),
    remove: (code) => api.removeFeature(code),
    get: (codes) => api.getFeatures(codes),
  },

  purchase: {
    open: (options, callback) => api.openPurchase(options, callback),
    pay: (options, callback) => api.openPayment(options, callback),
    getPayments: () => api.fetchUserPayments(),
    isPurchased: () => api.isPurchasedUser(),
    getServerToken: () => api.fetchUserServerTemporaryToken(),
  },

  redirect: {
    to: (label, payload) => api.redirect(label, payload),
    hotKeySetting: (cmdLabel, autocopy) => api.redirectHotKeySetting(cmdLabel, autocopy),
    aiModelsSetting: () => api.redirectAiModelsSetting(),
  },

  screen: {
    colorPick: (callback) => api.screenColorPick(callback),
    capture: (callback) => api.screenCapture(callback),
  },

  ai: {
    allModels: () => api.allAiModels(),
    chat: (option, streamCallback) => {
      if (streamCallback) {
        return api.ai(option, streamCallback)
      }
      return api.ai(option)
    },
  },

  ffmpeg: {
    run: (args, onProgress) => api.runFFmpeg(args, onProgress),
  },

  // uTools 内置 Sharp 图像处理库；ZTools / browser 环境无此能力时为 undefined，调用方需判空
  sharp: api.sharp && {
    /**
     * 读取图片元信息（宽高 / 格式）
     * @param {string | Uint8Array | ArrayBuffer} input 图片文件路径或二进制数据
     */
    metadata: (input) => api.sharp(input).metadata(),
    /**
     * 裁剪指定区域并输出 PNG 文件
     * @param {string} input 源图片文件路径
     * @param {{left:number, top:number, width:number, height:number}} region 裁剪区域
     * @param {string} output 输出 PNG 文件路径
     */
    crop: (input, region, output) => api.sharp(input).extract(region).png().toFile(output),
    /**
     * 去除图片「从外到内的连续背景色」（flood fill）：从四边边缘像素出发，凡与目标色
     * 在容差内且与边缘连通的像素全部置为透明。默认去纯白背景，color 可自定义任意颜色。
     * @param {string} input 源图片文件路径（png / jpeg / webp 等）
     * @param {{color?: string|number[], tolerance?: number}} [options] 目标色（hex / rgb() / [r,g,b]，默认白）+ 颜色容差 0~255（默认 40）
     * @param {string} output 输出 PNG 文件路径
     * @returns {Promise<{width:number, height:number, removedPixels:number}>}
     */
    removeBackground: async (input, options, output) => {
      const opt = options || {}
      const [cr, cg, cb] = parseTargetColor(opt.color)
      const tolerance = clampTolerance(opt.tolerance)
      const { data, info } = await api
        .sharp(input)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const width = info.width
      const height = info.height
      const total = width * height
      const visited = new Uint8Array(total)
      const queue = new Int32Array(total)
      let head = 0
      let tail = 0
      let removedPixels = 0

      const matchColor = (i) => {
        const o = i * 4
        return (
          Math.abs(data[o] - cr) <= tolerance &&
          Math.abs(data[o + 1] - cg) <= tolerance &&
          Math.abs(data[o + 2] - cb) <= tolerance
        )
      }
      const enqueue = (i) => {
        if (visited[i]) return
        visited[i] = 1
        queue[tail++] = i
      }

      for (let x = 0; x < width; x++) {
        enqueue(x)
        enqueue((height - 1) * width + x)
      }
      for (let y = 0; y < height; y++) {
        enqueue(y * width)
        enqueue(y * width + (width - 1))
      }

      while (head < tail) {
        const i = queue[head++]
        if (!matchColor(i)) continue
        removedPixels++
        data[i * 4 + 3] = 0
        const x = i % width
        const y = (i - x) / width
        if (x > 0) enqueue(i - 1)
        if (x < width - 1) enqueue(i + 1)
        if (y > 0) enqueue(i - width)
        if (y < height - 1) enqueue(i + width)
      }

      await api.sharp(data, { raw: { width, height, channels: 4 } })
        .png()
        .toFile(output)
      return { width, height, removedPixels }
    },
  },

  db: api?.db,
  dbStorage: api?.dbStorage,
  dbCryptoStorage: api?.dbCryptoStorage,
  team: api?.team,

  onPluginEnter: (callback) => api.onPluginEnter(callback),
  onPluginOut: (callback) => api.onPluginOut(callback),
  onPluginDetach: (callback) => api.onPluginDetach(callback),
  onDbPull: (callback) => api.onDbPull(callback),
  onMainPush: (callback, selectCallback) => api.onMainPush(callback, selectCallback),
  outPlugin: (isKill) => api.outPlugin(isKill),
  readCurrentFolderPath: () => api.readCurrentFolderPath(),
  readCurrentBrowserUrl: () => api.readCurrentBrowserUrl(),
}
