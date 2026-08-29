/**
 * shellExec IPC handler（main 进程）：cliRun 迁入 main（子进程执行属特权操作）。
 */
import { ipcMain } from 'electron'
import { cliRun } from '$/service/shellExec'
import { ShellExecChannels, type CliRunOptions } from '~/ipc/channels'

export function registerShellExecIpc(): void {
  ipcMain.handle(
    ShellExecChannels.cliRun,
    (_event, command: string, args: Array<string | number> = [], options: CliRunOptions = {}) =>
      cliRun(command, args, options)
  )
}
