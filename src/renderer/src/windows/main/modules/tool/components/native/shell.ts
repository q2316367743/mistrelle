import { ToolFunction } from '@/domain'
import { cliRun } from '@/plugin/shell'

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
    risk: 'sensitive',
    handler: async (...params: unknown[]) => {
      const {
        command,
        args = [],
        cwd
      } = params[0] as {
        command: string
        args?: string[]
        cwd?: string
      }
      return cliRun(command, args, { cwd })
    }
  }
]
