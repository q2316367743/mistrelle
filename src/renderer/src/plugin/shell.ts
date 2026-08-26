import { useLog } from '@/hooks/UseLog'

const logger = useLog({ name: 'plugin:shell' })

// 日志截断长度，避免超长 stdout/stderr 刷屏
const MAX_LOG_LENGTH = 2000
// 与底层 shellExec 默认超时保持一致，用于计算前端兜底守卫时长
const DEFAULT_CLI_TIMEOUT_MS = 30000
// 前端兜底守卫缓冲：比底层超时多出的时间，保证底层先触发精确 kill，前端仅兜底 IPC 挂起
const FRONT_GUARD_GRACE_MS = 5000

/**
 * 为 Promise 增加前端超时兜底：底层 IPC 挂起永不 resolve 时，超时后返回超时错误结果。
 * 返回结构与底层超时错误格式一致，调用方无需区分来源。
 */
function withCliTimeout(promise: Promise<CliRunResult>, timeoutMs: number): Promise<CliRunResult> {
  let timer: number | undefined
  const guard: Promise<CliRunResult> = new Promise((resolve) => {
    timer = window.setTimeout(() => {
      resolve({ error: `命令执行超过 ${timeoutMs}ms 未返回，已强制终止` })
    }, timeoutMs)
  })
  return Promise.race([promise, guard]).finally(() => {
    if (timer !== undefined) window.clearTimeout(timer)
  })
}

function truncate(text?: string): string | undefined {
  if (text === undefined) return undefined
  if (text.length <= MAX_LOG_LENGTH) return text
  return `${text.slice(0, MAX_LOG_LENGTH)}… (已截断 ${text.length - MAX_LOG_LENGTH} 字符)`
}

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

/**
 * 包装 window.preload.shellExec.cliRun，打印命令执行前后日志。
 * @param command 要执行的程序路径
 * @param args 命令行参数列表
 * @param options 运行选项（工作目录 / 超时）
 */
export async function cliRun(
  command: string,
  args: string[] = [],
  options: CliRunOptions = {}
): Promise<CliRunResult> {
  const cmd = [command, ...args].join(' ')
  logger.debug(`执行命令: ${cmd}`, { cwd: options.cwd, timeout: options.timeout })
  const start = performance.now()
  try {
    const execTimeout = options.timeout ?? DEFAULT_CLI_TIMEOUT_MS
    const result = await withCliTimeout(
      window.preload.shellExec.cliRun(command, args, options),
      execTimeout + FRONT_GUARD_GRACE_MS
    )
    const cost = Math.round(performance.now() - start)
    if (result.error) {
      logger.error(`命令失败 (${cost}ms): ${cmd}`, {
        error: result.error,
        stderr: truncate(result.stderr)
      })
    } else {
      logger.debug(`命令完成 (${cost}ms, exitCode=${result.exitCode}): ${cmd}`, {
        stdout: truncate(result.stdout),
        stderr: truncate(result.stderr)
      })
    }
    return result
  } catch (e) {
    const cost = Math.round(performance.now() - start)
    logger.error(`命令异常 (${cost}ms): ${cmd}`, e)
    throw e
  }
}

