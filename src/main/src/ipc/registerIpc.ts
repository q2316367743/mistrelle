/**
 * IPC handler 统一注册入口（app ready 后调用一次）。
 */
import { registerShellIpc, registerDialogIpc, registerClipboardIpc, registerOsIpc, registerDisplayIpc, registerNotificationIpc } from './electronIpc'
import { registerFsIpc } from './fsIpc'
import { registerShellExecIpc } from './shellExecIpc'
import { registerFontIpc } from './fontIpc'
import { registerFfmpegIpc } from './ffmpegIpc'
import { registerSharpIpc } from './sharpIpc'
import { registerPptIpc } from './pptIpc'
import { registerBrowserToolIpc } from './browserToolIpc'
import { registerSafeStorageIpc } from './safeStorageIpc'
import { registerDbIpc } from './dbIpc'
import { registerImageIpc } from './imageIpc'
import { registerTemplateIpc } from './templateIpc'
import { registerAuthIpc } from './authIpc'
import { registerRelayIpc } from './relayIpc'

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
}
