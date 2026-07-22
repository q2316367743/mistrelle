const { spawnSync } = require('child_process')
const { runInNewContext } = require('vm')

const shellQuote = (value) => {
  const text = String(value)
  return `'${text.replace(/'/g, `'"'"'`)}'`
}

const buildShellCommand = (command, args) => {
  if (args.length === 0) return command
  return [command, ...args.map(shellQuote)].join(' ')
}

let USER_PATH = process.env.PATH || ''
if (process.platform !== 'win32') {
  const shell = process.env.SHELL || '/bin/zsh'
  try {
    const r = spawnSync(shell, ['-l', '-c', 'echo $PATH'], { encoding: 'utf-8', timeout: 5000 })
    if (r.stdout?.trim()) USER_PATH = r.stdout.trim()
  } catch {}
}

module.exports = {
  cliRun(command, args = [], options = {}) {
    const { timeout = 30000, cwd } = options
    try {
      const normalizedArgs = Array.isArray(args) ? args.map(String) : []
      const shellCommand = buildShellCommand(command, normalizedArgs)
      const result = spawnSync(shellCommand, {
        timeout,
        cwd,
        env: { ...process.env, PATH: USER_PATH },
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        shell: true,
      })
      return {
        stdout: result.stdout ? result.stdout.trim() : '',
        stderr: result.stderr ? result.stderr.trim() : '',
        exitCode: result.status,
        signal: result.signal,
        error: result.error ? result.error.message : undefined,
      }
    } catch (err) {
      return { error: err.message }
    }
  },

  jsRun(script, args = {}) {
    const logs = []
    const sandbox = {
      args,
      result: undefined,
      console: {
        log: (...items) => logs.push(items.map(String).join(' ')),
        error: (...items) => logs.push(items.map(String).join(' ')),
      },
    }
    try {
      runInNewContext(script, sandbox, { timeout: 30000 })
      return { result: sandbox.result ?? null, stdout: logs.join('\n') }
    } catch (err) {
      return { result: sandbox.result ?? null, stdout: logs.join('\n'), error: err.message }
    }
  },
}
