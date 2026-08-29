/**
 * shellExec 桥（preload）：原 src-utools/src/shellExec.js 的 IPC 化。
 * 实现迁入 main（service/shellExec.ts + shellExecIpc.ts），签名不变。
 */
import { ipcRenderer } from 'electron'
import { ShellExecChannels, type CliRunOptions, type CliRunResult } from './channels'

export const shellExecApi = {
  /**
   * 异步执行命令行程序（spawn 非阻塞）。stdout/stderr 按 10MB 上限累积，超限即终止。
   * 超时（默认 30s）与 close 兜底保证任何情况下 Promise 必会 resolve。
   */
  cliRun: (
    command: string,
    args: Array<string | number> = [],
    options: CliRunOptions = {}
  ): Promise<CliRunResult> => ipcRenderer.invoke(ShellExecChannels.cliRun, command, args, options)
}
