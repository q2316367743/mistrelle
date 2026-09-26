/**
 * IPC handler 统一注册入口（app ready 后调用一次）。
 */
import { registerShellIpc, registerDialogIpc, registerClipboardIpc, registerOsIpc, registerDisplayIpc, registerNotificationIpc } from './modules/platform/electronIpc'
import { registerFsIpc } from './modules/platform/fsIpc'
import { registerShellExecIpc } from './modules/shell/shellExecIpc'
import { registerFontIpc } from './modules/font/fontIpc'
import { registerSharpIpc } from './modules/sharp/sharpIpc'
import { registerOcrIpc } from './modules/ocr/ocrIpc'
import { registerBrowserToolIpc } from './modules/browser/browserToolIpc'
import { registerSafeStorageIpc } from './modules/platform/safeStorageIpc'
import { registerDbIpc } from './db/dbIpc'
import { registerImageIpc } from './modules/image/imageIpc'
import { registerNetworkIpc } from './modules/network/networkIpc'
import { registerGzhIpc } from './modules/gzh/gzhIpc'
import { registerXhsIpc } from './modules/xhs/xhsIpc'
import { registerTemplateIpc } from './modules/template/templateIpc'
import { registerAuthIpc } from './modules/auth/authIpc'
import { registerRelayIpc } from './modules/relay/relayIpc'
import { registerSerialIpc } from './modules/serial/serialIpc'
import { registerTrafficLightIpc } from './buddy/traffic-light/trafficLightIpc'
import { initTrafficLight } from './buddy/traffic-light/TrafficLightService'
import { registerIntegrationsIpc } from './buddy/integrations/integrationsIpc'
import { initIntegrationsActivity } from './buddy/integrations/integrationsActivity'
import { registerPermissionIpc } from './buddy/permission/permissionIpc'
import { initBuddyEventFilter } from './buddy/events/buddyEventFilter'
import { registerEsp32LcdIpc } from './buddy/esp32-lcd/esp32LcdIpc'
import { initEsp32Lcd } from './buddy/esp32-lcd/esp32LcdService'
import { registerKeypadIpc } from './buddy/keypad/keypadIpc'
import { initKeypad } from './buddy/keypad/keypadService'
import { registerQuotaIpc } from './buddy/quota/quotaIpc'
import { initQuota } from './buddy/quota/quotaService'
import { registerUpdaterIpc } from './modules/updater/updaterIpc'

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
  registerOcrIpc()
  registerBrowserToolIpc()
  registerSafeStorageIpc()
  registerDbIpc()
  registerImageIpc()
  registerNetworkIpc()
  registerGzhIpc()
  registerXhsIpc()
  registerTemplateIpc()
  registerAuthIpc()
  registerRelayIpc()
  registerSerialIpc()
  registerTrafficLightIpc()
  registerIntegrationsIpc()
  registerPermissionIpc()
  registerEsp32LcdIpc()
  registerKeypadIpc()
  registerQuotaIpc()
  registerUpdaterIpc()
  // 事件协议层监听器①白名单过滤：原始事件 → 校验后总线（设备域消费）
  void initBuddyEventFilter()
  // 监听器②集成调试事件流：全量采集广播渲染层（纯内存；registerIpc 先于事件服务启动，不漏收）
  void initIntegrationsActivity()
  // 加载红绿灯配置并按 lastPort 自动连接串口（失败静默，伙伴窗口可手动重连）
  void initTrafficLight()
  // ESP32 LCD 同理：加载配置自动连接串口 + 订阅事件/额度快照总线
  void initEsp32Lcd()
  // 小键盘同理：加载配置自动连接串口 + 订阅按键行（解析后驱动系统级模拟按键）
  void initKeypad()
  // 额度插件公共域：加载配置 + 启动刷新定时器（快照经 quotaBus 分发订阅设备）
  initQuota()
}
