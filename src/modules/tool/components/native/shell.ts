import { ToolFunction } from '@/domain'

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
  }
]
