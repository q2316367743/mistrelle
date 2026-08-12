/**
 * shellExec IPC handler（main 进程）：cliRun / jsRun 迁入 main（子进程执行属特权操作）。
 */
import { ipcMain } from 'electron'
import { cliRun, jsRun } from '$/service/shellExec'
import { ShellExecChannels, type CliRunOptions, type JsRunResult } from '~/channels'

export function registerShellExecIpc(): void {
  ipcMain.handle(
    ShellExecChannels.cliRun,
    (_event, command: string, args: Array<string | number> = [], options: CliRunOptions = {}) =>
      cliRun(command, args, options)
  )

  ipcMain.handle(
    ShellExecChannels.jsRun,
    (_event, script: string, args: Record<string, unknown> = {}): Promise<JsRunResult> =>
      jsRun(script, args)
  )
}
