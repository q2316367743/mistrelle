import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import axios from 'axios'
import { injectApi } from '~/inject'
import { fsApi } from '~/fs'
import { pathApi } from '~/path'
import { netApi } from '~/net'
import { iconvApi } from '~/iconv'
import { cryptoApi } from '~/crypto'
import { zipApi } from '~/zip'
import { shellExecApi } from '~/shellExec'
import { fontApi } from '~/font'
import { pptApi } from '~/ppt'

// 组装 window.preload（形状与原 src-utools/preload.js 一致：9 模块 + axios 实例）
// axios 强制 Node http 适配器：绕开渲染进程 XHR 的 CORS 限制（原 utools 环境同样依赖此行为）
const preload = {
  net: netApi,
  inject: injectApi,
  fs: fsApi,
  path: pathApi,
  iconv: iconvApi,
  crypto: cryptoApi,
  zip: zipApi,
  shellExec: shellExecApi,
  font: fontApi,
  ppt: pptApi,
  axios: axios.create({ adapter: axios.getAdapter('http') })
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('preload', preload)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.preload = preload
}
