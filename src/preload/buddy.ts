/**
 * 伙伴窗口独立 preload：只注入伙伴窗口需要的域，不与主窗口共用（主窗口见 index.ts）。
 * 当前依赖：serial（串口只读查询）、trafficLight（红绿灯）、esp32Lcd（圆屏）、
 * keypad（小键盘）、integrations（应用集成）、quota（额度插件公共域）、inject（App 外壳 UseTitlePadding 判平台）。
 * 构建产物 out/preload/buddy.js（electron.vite.config.ts preload 段双入口），由 buddyWindow 挂载。
 */
import { contextBridge } from 'electron'
import { injectApi } from '~/inject'
import { serialApi } from '~/modules/serial/serial'
import { trafficLightApi } from '~/modules/traffic-light/trafficLight'
import { integrationsApi } from '~/modules/integrations/integrations'
import { esp32LcdApi } from '~/modules/esp32-lcd/esp32Lcd'
import { keypadApi } from '~/modules/keypad/keypad'
import { quotaApi } from '~/modules/quota/quota'

const preload = {
  inject: injectApi,
  serial: serialApi,
  trafficLight: trafficLightApi,
  integrations: integrationsApi,
  esp32Lcd: esp32LcdApi,
  keypad: keypadApi,
  quota: quotaApi
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('preload', preload)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.preload = preload
}
