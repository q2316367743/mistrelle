/**
 * shell 域 IPC 契约：cliRun 通道与载荷/结果类型。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
// ── shellExec ──────────────────────────────────────────────
export const ShellExecChannels = {
  cliRun: 'shellExec:cliRun'
} as const

export interface CliRunOptions {
  cwd?: string
  timeout?: number
  /** 写入子进程 stdin 的内容（写完后自动 end），用于 heredoc 类命令（如 ego-browser nodejs） */
  stdin?: string
}

export interface CliRunResult {
  stdout?: string
  stderr?: string
  exitCode?: number | null
  signal?: string
  error?: string
}
