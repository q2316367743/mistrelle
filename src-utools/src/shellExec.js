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

let USER_PATH = process.env.PATH || ''

// 异步获取 login shell 的 PATH，避免启动时同步阻塞主线程；cliRun 执行前会先 await
let userPathReady = Promise.resolve()
if (process.platform !== 'win32') {
  const shell = process.env.SHELL || '/bin/zsh'
  userPathReady = new Promise((resolve) => {
    let out = ''
    try {
      const child = spawn(shell, ['-l', '-c', 'echo $PATH'], {
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      child.stdout.on('data', (chunk) => {
        out += chunk
      })
      child.on('error', () => resolve())
      child.on('close', () => {
        if (out.trim()) USER_PATH = out.trim()
        resolve()
      })
    } catch {
      resolve()
    }
  })
}

module.exports = {
  /**
   * 异步执行命令行程序（spawn 非阻塞，sleep 等长任务不会卡住 UI）。
   * stdout/stderr 按 10MB 上限累积，超限即终止子进程并返回错误。
   * error（命令不存在/ENOENT）与 close 双触发只 resolve 一次。
   */
  cliRun(command, args = [], options = {}) {
    const { timeout = 30000, cwd } = options
    return userPathReady.then(
      () =>
        new Promise((resolve) => {
          let stdout = ''
          let stderr = ''
          let overLimit = false
          let settled = false
          const done = (result) => {
            if (settled) return
            settled = true
            resolve(result)
          }
          try {
            const normalizedArgs = Array.isArray(args) ? args.map(String) : []
            const shellCommand = buildShellCommand(command, normalizedArgs)
            const child = spawn(shellCommand, {
              timeout,
              cwd,
              env: { ...process.env, PATH: USER_PATH },
              shell: true,
            })
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
          } catch (err) {
            done({ error: err.message })
          }
        })
    )
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
