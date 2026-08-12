import { ToolFunction } from '@/domain'
import { cliRun } from '@/plugin/shell'
import { useSettingSecureStore } from '@/store'

export const egoBrowserTools: ToolFunction[] = [
  {
    name: 'ego_browser_run',
    label: 'ego-browser 执行',
    description: `运行 ego-browser（ego-lite）CLI 命令，用于浏览器自动化（打开页面、点击、填表、截图、提取内容等）。ego-browser 在独立的隔离空间中运行，复用用户登录态，不干扰用户正常浏览器。

第一个参数 subcommand 是子命令（nodejs / import / upgrade / onboarding / help 等），后续 args 原样透传。

常用示例：
- nodejs -e "代码"：在嵌入的 Node 运行时中执行脚本（内置 snapshotText / click / fillInput / captureScreenshot 等助手）。脚本可直接包含换行，无需转义。
- import list：列出可导入的浏览器配置。
- upgrade：升级 ego-lite 到最新版本。
- onboarding：运行 CLI 引导。

注意：子命令只允许 nodejs / import / upgrade / onboarding / help / --version；nodejs 只能通过 -e 传代码（底层执行不支持 stdin heredoc）。`,
    parameters: {
      type: 'object',
      properties: {
        subcommand: {
          type: 'string',
          description:
            'ego-browser 子命令：nodejs / import / upgrade / onboarding / help 等，如 "nodejs"'
        },
        args: {
          type: 'array',
          items: { type: 'string', description: '参数值' },
          description:
            '子命令后的参数列表，如 ["-e", "await openOrReuseTab(\\"https://example.com\\"); cliLog(await snapshotText())"]'
        },
        serverName: {
          type: 'string',
          description: '可选的 --ego-server-name=<name> 全局参数，连接指定命名的浏览器服务'
        },
        cwd: { type: 'string', description: '工作目录（可选）' },
        timeout: { type: 'number', description: '超时毫秒数（可选，默认 30000）' }
      },
      required: ['subcommand']
    },
    risk: 'safe',
    handler: async (...params: unknown[]) => {
      const { subcommand, args = [], serverName, cwd, timeout } = params[0] as {
        subcommand: string
        args?: string[]
        serverName?: string
        cwd?: string
        timeout?: number
      }
      const fullArgs = [
        serverName ? `--ego-server-name=${serverName}` : '',
        subcommand,
        ...args
      ].filter(Boolean)
      const { egoBrowserPath } = useSettingSecureStore()
      return cliRun(egoBrowserPath, fullArgs, { cwd, timeout })
    }
  },
  {
    name: 'ego_browser_exist',
    label: 'ego-browser 环境检查',
    description:
      '只读检查 ego-browser 是否已安装且可用，返回其版本号。在开始 ego-browser 自动化前可先调用，环境不可用时及时改用其他浏览器方案。',
    parameters: {
      type: 'object',
      properties: {}
    },
    risk: 'safe',
    handler: async () => {
      const { egoBrowserPath } = useSettingSecureStore()
      const res = await cliRun(egoBrowserPath, ['--version'])
      if (res.error) {
        return { installed: false, error: res.error, stderr: res.stderr }
      }
      return { installed: true, version: res.stdout?.trim() ?? null, exitCode: res.exitCode }
    }
  }
]
