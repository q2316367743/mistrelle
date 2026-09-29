import { ToolFunction } from '@/domain'
import { cliRun } from '@/plugin/shell'
import { useSettingSecureStore } from '@/windows/main/store'

export const egoBrowserTools: ToolFunction[] = [
  {
    name: 'ego_browser_run',
    label: 'ego-browser 执行',
    description: `运行 ego-browser（ego-lite）CLI 命令，用于浏览器自动化（打开页面、点击、填表、截图、提取内容等）。ego-browser 在独立的隔离空间中运行，复用用户登录态，不干扰用户正常浏览器。

第一个参数 subcommand 是子命令（nodejs / import / upgrade / onboarding / help 等）。

- nodejs：执行浏览器自动化脚本。脚本内容通过 script 参数传入（经 stdin 传给 CLI，等价 heredoc 写法），支持多行、无需转义。脚本运行在 Node 运行时中，浏览器侧代码写进 page.evaluate()；API 是 ego-browser 自有的一套（\`taskSpace(nameOrId)\` 创建/复用任务空间、\`task.page(label)\` 取页（新空间自带 p1）、\`page.goto/click/fill/setInputFiles/mouse.click/keyboard.*/screenshot/evaluate/waitForTimeout\`、\`takeOverTaskSpace(spaceId)\` 用户处理完权限弹窗后接回同一空间、\`task.finish({ keep })\` 结束任务），不是 Playwright，勿臆造 locator() / getByRole() 等方法；输出必须用 console.log() 打印。每次调用都是新进程：JS 变量不保留，任务空间与页码标签可凭 spaceId 续用；耗时流程须显式传 timeout（默认 30000ms）。
- import list：列出可导入的浏览器配置。
- upgrade：升级 ego-lite 到最新版本。
- onboarding：运行 CLI 引导。

注意：nodejs 子命令的脚本只能通过 script 参数（stdin）传入，args 仅用于其他子命令。`,
    parameters: {
      type: 'object',
      properties: {
        subcommand: {
          type: 'string',
          description:
            'ego-browser 子命令：nodejs / import / upgrade / onboarding / help 等，如 "nodejs"'
        },
        script: {
          type: 'string',
          description:
            'nodejs 子命令要执行的 JS 脚本（经 stdin 传入，等价 heredoc），可含换行无需转义，如 "const task = await taskSpace(\\"打开示例页\\"); const page = task.page(\\"p1\\"); await page.goto(\\"https://example.com\\"); console.log(await page.title())"'
        },
        args: {
          type: 'array',
          items: { type: 'string', description: '参数值' },
          description: '非 nodejs 子命令后的参数列表，如 ["list"]'
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
      const { subcommand, script, args = [], serverName, cwd, timeout } = params[0] as {
        subcommand: string
        script?: string
        args?: string[]
        serverName?: string
        cwd?: string
        timeout?: number
      }
      // nodejs 子命令的脚本经 stdin 传入（等价 `ego-browser nodejs <<'EOF'` heredoc），args 仅用于其他子命令
      const isNodejs = subcommand === 'nodejs'
      const fullArgs = [
        serverName ? `--ego-server-name=${serverName}` : '',
        subcommand,
        ...(isNodejs ? [] : args)
      ].filter(Boolean)
      const { egoBrowserPath } = useSettingSecureStore()
      return cliRun(egoBrowserPath, fullArgs, { cwd, timeout, stdin: isNodejs ? script : undefined })
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
