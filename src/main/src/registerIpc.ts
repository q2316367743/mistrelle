/**
 * IPC handler 统一注册入口（app ready 后调用一次）。
 */
import { registerShellIpc, registerDialogIpc, registerClipboardIpc, registerOsIpc, registerDisplayIpc, registerNotificationIpc } from './modules/platform/electronIpc'
import { registerFsIpc } from './modules/platform/fsIpc'
import { registerShellExecIpc } from './modules/shell/shellExecIpc'
import { registerFontIpc } from './modules/font/fontIpc'
import { registerSharpIpc } from './modules/sharp/sharpIpc'
import { registerBrowserToolIpc } from './modules/browser/browserToolIpc'
import { registerSafeStorageIpc } from './modules/platform/safeStorageIpc'
import { registerDbIpc } from './db/dbIpc'
import { registerImageIpc } from './modules/image/imageIpc'
import { registerTemplateIpc } from './modules/template/templateIpc'
import { registerAuthIpc } from './modules/auth/authIpc'
import { registerRelayIpc } from './modules/relay/relayIpc'
import { registerSerialIpc } from './modules/serial/serialIpc'
import { registerTrafficLightIpc } from './buddy/traffic-light/trafficLightIpc'
import { initTrafficLight } from './buddy/traffic-light/TrafficLightService'
import { registerEsp32LcdIpc } from './buddy/esp32-lcd/esp32LcdIpc'
import { initEsp32Lcd } from './buddy/esp32-lcd/esp32LcdService'
import { registerQuotaIpc } from './buddy/quota/quotaIpc'
import { initQuota } from './buddy/quota/quotaService'

export function registerIpc(): void {
  registerShellIpc()
  registerDialogIpc()
  registerClipboardIpc()
  registerOsIpc()
  registerDisplayIpc()
  registerNotificationIpc()
  registerFsIpc()
  registerShellExecIpc()
  registerFontIpc()
  registerSharpIpc()
  registerBrowserToolIpc()
  registerSafeStorageIpc()
  registerDbIpc()
  registerImageIpc()
  registerTemplateIpc()
  registerAuthIpc()
  registerRelayIpc()
  registerSerialIpc()
  registerTrafficLightIpc()
  registerEsp32LcdIpc()
  registerQuotaIpc()
  // 加载红绿灯配置并按 lastPort 自动连接串口（失败静默，伙伴窗口可手动重连）
  void initTrafficLight()
  // ESP32 LCD 同理：加载配置自动连接串口 + 订阅事件/额度快照总线
  void initEsp32Lcd()
  // 额度插件公共域：加载配置 + 启动刷新定时器（快照经 quotaBus 分发订阅设备）
  initQuota()
}
