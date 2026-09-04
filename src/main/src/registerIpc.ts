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
  // 加载红绿灯配置并按 lastPort 自动连接串口（失败静默，伙伴窗口可手动重连）
  void initTrafficLight()
}
