/**
 * IPC handler 统一注册入口（app ready 后调用一次）。
 */
import { registerShellIpc, registerDialogIpc, registerClipboardIpc, registerOsIpc, registerDisplayIpc, registerNotificationIpc } from './modules/platform/electronIpc'
import { registerFsIpc } from './modules/platform/fsIpc'
import { registerShellExecIpc } from './modules/shell/shellExecIpc'
import { registerFontIpc } from './modules/font/fontIpc'
import { registerFfmpegIpc } from './modules/ffmpeg/ffmpegIpc'
import { registerSharpIpc } from './modules/sharp/sharpIpc'
import { registerPptIpc } from './modules/ppt/pptIpc'
import { registerBrowserToolIpc } from './modules/browser/browserToolIpc'
import { registerSafeStorageIpc } from './modules/platform/safeStorageIpc'
import { registerDbIpc } from './db/dbIpc'
import { registerImageIpc } from './modules/image/imageIpc'
import { registerTemplateIpc } from './modules/template/templateIpc'
import { registerAuthIpc } from './modules/auth/authIpc'
import { registerRelayIpc } from './modules/relay/relayIpc'
import { registerSerialIpc } from './modules/serial/serialIpc'

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
  registerFfmpegIpc()
  registerSharpIpc()
  registerPptIpc()
  registerBrowserToolIpc()
  registerSafeStorageIpc()
  registerDbIpc()
  registerImageIpc()
  registerTemplateIpc()
  registerAuthIpc()
  registerRelayIpc()
  registerSerialIpc()
}
