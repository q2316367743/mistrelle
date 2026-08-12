/**
 * IPC handler 统一注册入口（app ready 后调用一次）。
 */
import { registerShellIpc, registerDialogIpc, registerClipboardIpc, registerOsIpc, registerDisplayIpc, registerNotificationIpc } from './electronIpc'
import { registerFsIpc } from './fsIpc'
import { registerNetIpc } from './netIpc'
import { registerShellExecIpc } from './shellExecIpc'
import { registerFontIpc } from './fontIpc'
import { registerDbIpc } from './dbIpc'
import { registerFfmpegIpc } from './ffmpegIpc'
import { registerSharpIpc } from './sharpIpc'

export function registerIpc(): void {
  registerShellIpc()
  registerDialogIpc()
  registerClipboardIpc()
  registerOsIpc()
  registerDisplayIpc()
  registerNotificationIpc()
  registerFsIpc()
  registerNetIpc()
  registerShellExecIpc()
  registerFontIpc()
  registerDbIpc()
  registerFfmpegIpc()
  registerSharpIpc()
}
