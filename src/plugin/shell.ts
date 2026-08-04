import { useLog } from '@/hooks/UseLog'

const logger = useLog({ name: 'plugin:shell' })

// 日志截断长度，避免超长 stdout/stderr 刷屏
const MAX_LOG_LENGTH = 2000

function truncate(text?: string): string | undefined {
  if (text === undefined) return undefined
  if (text.length <= MAX_LOG_LENGTH) return text
  return `${text.slice(0, MAX_LOG_LENGTH)}… (已截断 ${text.length - MAX_LOG_LENGTH} 字符)`
}

export interface CliRunOptions {
  cwd?: string
  timeout?: number
}

export interface CliRunResult {
  stdout?: string
  stderr?: string
  exitCode?: number | null
  signal?: string
  error?: string
}

export interface JsRunResult {
  result?: unknown
  stdout?: string
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
    const result = await window.preload.shellExec.cliRun(command, args, options)
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

/**
 * 包装 window.preload.shellExec.jsRun，打印 JS 沙箱执行前后日志。
 * @param script 要执行的 JavaScript 代码
 * @param args 传递给脚本的参数对象
 */
export async function jsRun(
  script: string,
  args: Record<string, unknown> = {}
): Promise<JsRunResult> {
  logger.debug('执行 JS 沙箱', { script: truncate(script), args })
  const start = performance.now()
  try {
    const result = await window.preload.shellExec.jsRun(script, args)
    const cost = Math.round(performance.now() - start)
    if (result.error) {
      logger.error(`JS 沙箱执行失败 (${cost}ms)`, {
        error: result.error,
        stdout: truncate(result.stdout)
      })
    } else {
      logger.debug(`JS 沙箱执行完成 (${cost}ms)`, {
        result: result.result,
        stdout: truncate(result.stdout)
      })
    }
    return result
  } catch (e) {
    const cost = Math.round(performance.now() - start)
    logger.error(`JS 沙箱执行异常 (${cost}ms)`, e)
    throw e
  }
}
