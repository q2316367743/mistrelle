import { ToolFunction } from '@/domain'
import { useSettingSecureStore } from '@/store/setting/SettingSecureStore'

export const shellTools: ToolFunction[] = [
  {
    name: 'cli_run',
    label: 'CLI 执行',
    description:
      '执行指定路径的程序并传入参数，返回标准输出、标准错误和退出码。适用于运行脚本、编译工具等命令行程序。',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的程序路径' },
        args: {
          type: 'array',
          items: { type: 'string', description: '参数' },
          description: '命令行参数列表'
        },
        cwd: { type: 'string', description: '工作目录（可选）' }
      },
      required: ['command']
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { command, args = [], cwd } = params[0] as {
        command: string
        args?: string[]
        cwd?: string
      }
      return window.preload.shellExec.cliRun(command, args, { cwd })
    }
  },
  {
    name: 'js_run',
    label: 'JS 沙箱执行',
    description:
      '在沙箱环境中执行 JavaScript 代码，禁止访问系统资源（require/fs/process 均不可用）。传入 args 对象可在脚本中访问，脚本通过设置 result 变量返回结果。',
    parameters: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: '要执行的 JavaScript 代码（可直接访问 args 对象和 result 变量）'
        },
        args: { type: 'object', description: '传递给脚本的参数对象' }
      },
      required: ['script']
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { script, args = {} } = params[0] as {
        script: string
        args?: Record<string, unknown>
      }
      return window.preload.shellExec.jsRun(script, args)
    }
  },
  {
    name: 'python_run',
    label: 'Python 执行',
    description:
      '执行 Python 代码或脚本文件，使用安全中心配置的 Python 运行时路径。提供 code 时通过 -c 执行，提供 file 时执行脚本文件。',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '要执行的 Python 代码（传入 -c 执行）' },
        file: { type: 'string', description: '要执行的 .py 脚本路径（与 code 二选一）' },
        args: {
          type: 'array',
          items: { type: 'string', description: '参数值' },
          description: '传递给脚本的命令行参数'
        },
        cwd: { type: 'string', description: '工作目录（可选）' }
      }
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { code, file, args = [], cwd } = params[0] as {
        code?: string
        file?: string
        args?: string[]
        cwd?: string
      }
      const { pythonPath } = useSettingSecureStore()
      if (code) {
        return window.preload.shellExec.cliRun(pythonPath, ['-c', code, ...args], { cwd })
      }
      if (file) {
        return window.preload.shellExec.cliRun(pythonPath, [file, ...args], { cwd })
      }
      return { error: '请提供 code 或 file 参数' }
    }
  },
  {
    name: 'node_run',
    label: 'Node.js 执行',
    description:
      '执行 Node.js 代码或脚本文件，使用安全中心配置的 Node.js 运行时路径。提供 code 时通过 -e 执行，提供 file 时执行脚本文件。',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '要执行的 JavaScript 代码（传入 -e 执行）' },
        file: { type: 'string', description: '要执行的 .js 脚本路径（与 code 二选一）' },
        args: {
          type: 'array',
          items: { type: 'string', description: '参数值' },
          description: '传递给脚本的命令行参数'
        },
        cwd: { type: 'string', description: '工作目录（可选）' }
      }
    },
    requireConfirm: true,
    handler: async (...params: unknown[]) => {
      const { code, file, args = [], cwd } = params[0] as {
        code?: string
        file?: string
        args?: string[]
        cwd?: string
      }
      const { nodePath } = useSettingSecureStore()
      if (code) {
        return window.preload.shellExec.cliRun(nodePath, ['-e', code, ...args], { cwd })
      }
      if (file) {
        return window.preload.shellExec.cliRun(nodePath, [file, ...args], { cwd })
      }
      return { error: '请提供 code 或 file 参数' }
    }
  },
  {
    name: 'git_exec',
    label: 'Git 执行',
    description:
      '执行 Git 命令（如 status、log、diff、branch 等），使用安全中心配置的 Git 运行时路径。',
    parameters: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string', description: '参数值' },
          description: 'Git 命令参数，如 ["log", "--oneline", "-5"]'
        },
        cwd: { type: 'string', description: 'Git 仓库路径（可选）' }
      },
      required: ['args']
    },
    requireConfirm: false,
    handler: async (...params: unknown[]) => {
      const { args, cwd } = params[0] as { args: string[]; cwd?: string }
      const { gitPath } = useSettingSecureStore()
      return window.preload.shellExec.cliRun(gitPath, args, { cwd })
    }
  }
]
