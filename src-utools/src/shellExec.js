const { spawn } = require('child_process')
const { Worker } = require('node:worker_threads')
const { runInNewContext } = require('node:vm')

const shellQuote = (value) => {
  const text = String(value)
  return `'${text.replace(/'/g, `'"'"'`)}'`
}

const buildShellCommand = (command, args) => {
  if (args.length === 0) return command
  return [command, ...args.map(shellQuote)].join(' ')
}

// 输出累积上限，防止 yes 类命令导致内存膨胀（原 spawnSync maxBuffer: 10MB 语义）
const MAX_OUTPUT_LENGTH = 10 * 1024 * 1024
// login shell 的 PATH 获取兜底超时：挂起时强制 kill 并放弃，保证不阻塞任何调用
const LOGIN_PATH_TIMEOUT_MS = 2500
// exit 后等待 close 的宽限期：后台孙进程占住管道时 close 不触发，超时即强制返回
const CLOSE_GRACE_MS = 2500

let USER_PATH = process.env.PATH || ''

/**
 * 异步获取 login shell 的 PATH（best-effort，fire-and-forget）。
 * 不返回 Promise 也不被任何调用 await，获取失败 / 挂起均不影响命令执行；
 * 手动兜底计时器保证即使 close 永不触发也能结束。
 */
function fetchLoginPath() {
  const shell = process.env.SHELL || '/bin/zsh'
  const child = spawn(shell, ['-l', '-c', 'echo $PATH'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  let out = ''
  let settled = false
  let timer
  const finish = () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    if (out.trim()) USER_PATH = out.trim()
  }
  // 手动超时兜底，不依赖 spawn 的 timeout 选项（旧版 Node 会静默忽略）
  timer = setTimeout(() => {
    child.kill()
    finish()
  }, LOGIN_PATH_TIMEOUT_MS)
  child.stdout.on('data', (chunk) => {
    out += chunk
  })
  child.on('error', finish)
  child.on('close', finish)
}

if (process.platform !== 'win32') {
  fetchLoginPath()
}

module.exports = {
  /**
   * 异步执行命令行程序（spawn 非阻塞，sleep 等长任务不会卡住 UI）。
   * stdout/stderr 按 10MB 上限累积，超限即终止子进程并返回错误。
   * 超时与 close 兜底均由手动计时器保证，任何情况下 Promise 必会 resolve：
   * - error（命令不存在/ENOENT）与 close 双触发只 resolve 一次
   * - 手动超时计时器：到期 kill 子进程并返回超时错误
   * - exit 后宽限期：后台孙进程占住管道导致 close 不触发时，用已累积输出强制返回
   */
  cliRun(command, args = [], options = {}) {
    const { timeout = 30000, cwd } = options
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let overLimit = false
      let settled = false
      let timeoutTimer = null
      let exitGraceTimer = null
      const cleanup = () => {
        if (timeoutTimer) clearTimeout(timeoutTimer)
        if (exitGraceTimer) clearTimeout(exitGraceTimer)
      }
      const done = (result) => {
        if (settled) return
        settled = true
        cleanup()
        resolve(result)
      }
      try {
        const normalizedArgs = Array.isArray(args) ? args.map(String) : []
        const shellCommand = buildShellCommand(command, normalizedArgs)
        const child = spawn(shellCommand, {
          cwd,
          env: { ...process.env, PATH: USER_PATH },
          shell: true,
        })
        // 手动超时兜底，不依赖 spawn 的 timeout 选项（旧版 Node 会静默忽略）
        timeoutTimer = setTimeout(() => {
          child.kill()
          done({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: null,
            error: `命令执行超过 ${timeout}ms，已终止`,
          })
        }, timeout)
        child.stdout.on('data', (chunk) => {
          stdout += chunk
          if (stdout.length >= MAX_OUTPUT_LENGTH) {
            overLimit = true
            stdout = stdout.slice(0, MAX_OUTPUT_LENGTH)
            child.kill()
          }
        })
        child.stderr.on('data', (chunk) => {
          stderr += chunk
          if (stderr.length >= MAX_OUTPUT_LENGTH) {
            overLimit = true
            stderr = stderr.slice(0, MAX_OUTPUT_LENGTH)
            child.kill()
          }
        })
        child.on('error', (err) =>
          done({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: null, error: err.message })
        )
        child.on('close', (code, signal) => {
          if (overLimit) {
            done({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: null,
              error: `输出超过 ${MAX_OUTPUT_LENGTH} 字节上限，已终止命令`,
            })
            return
          }
          done({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code, signal: signal ?? undefined })
        })
        // exit 已触发但 close 未到（孙进程占住管道），宽限期后按 exit 结果强制返回
        child.on('exit', (code, signal) => {
          exitGraceTimer = setTimeout(() => {
            if (overLimit) {
              done({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: null,
                error: `输出超过 ${MAX_OUTPUT_LENGTH} 字节上限，已终止命令`,
              })
              return
            }
            done({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code, signal: signal ?? undefined })
          }, CLOSE_GRACE_MS)
        })
      } catch (err) {
        done({ error: err.message })
      }
    })
  },

  /**
   * 在 worker 线程中执行 JS 沙箱，彻底移出主线程，死循环等场景不再卡 UI。
   * 双保险超时：worker 内 vm timeout + 主线程 terminate 兜底。
   */
  jsRun(script, args = {}) {
    const timeout = 30000
    return new Promise((resolve) => {
      const workerCode = `
        const { parentPort, workerData } = require('node:worker_threads')
        const { runInNewContext } = require('node:vm')
        const logs = []
        const sandbox = {
          args: workerData.args,
          result: undefined,
          console: {
            log: (...items) => logs.push(items.map(String).join(' ')),
            error: (...items) => logs.push(items.map(String).join(' ')),
          },
        }
        try {
          runInNewContext(workerData.script, sandbox, { timeout: workerData.timeout })
          parentPort.postMessage({ result: sandbox.result ?? null, stdout: logs.join('\\n') })
        } catch (err) {
          parentPort.postMessage({ result: sandbox.result ?? null, stdout: logs.join('\\n'), error: err.message })
        }
      `
      let worker
      try {
        worker = new Worker(workerCode, { eval: true, workerData: { script, args, timeout } })
      } catch (err) {
        resolve({ result: null, stdout: '', error: err.message })
        return
      }
      // 兜底：worker 内脚本极端阻塞（vm timeout 无法中断）时强制终止
      const killer = setTimeout(() => {
        worker.terminate()
        resolve({ result: null, stdout: '', error: `脚本执行超过 ${timeout}ms，已强制终止` })
      }, timeout)
      worker.once('message', (msg) => {
        clearTimeout(killer)
        resolve(msg)
      })
      worker.once('error', (err) => {
        clearTimeout(killer)
        resolve({ result: null, stdout: '', error: err.message })
      })
    })
  },
}
