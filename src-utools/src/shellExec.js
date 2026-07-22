const { spawnSync } = require('child_process')
const { runInNewContext } = require('vm')

module.exports = {
  cliRun(command, args = [], options = {}) {
    const { timeout = 30000, cwd } = options
    try {
      const result = spawnSync(command, args, {
        timeout,
        cwd,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024
      })
      return {
        stdout: result.stdout ? result.stdout.trim() : '',
        stderr: result.stderr ? result.stderr.trim() : '',
        exitCode: result.status,
        signal: result.signal
      }
    } catch (err) {
      return { error: err.message }
    }
  },

  jsRun(script, args = {}) {
    const sandbox = { args, result: undefined }
    try {
      runInNewContext(script, sandbox, { timeout: 30000 })
      return { result: sandbox.result }
    } catch (err) {
      return { error: err.message }
    }
  }
}
