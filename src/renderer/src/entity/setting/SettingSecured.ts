/**
 * 沙箱安全
 * > AI 运行于合隔离沙箱，并配置文件、命令、网络访问策略
 */
interface SettingSecuredSandbox {
  enabled: boolean

  // --------------------------- 文件安全 ---------------------------

  /**
   * 自动放行白名单
   * > 命中路径会按低风险处理并自动放行
   */
  fileWhiteList: string[]
  /**
   * 强制审批黑名单
   * > 命中路径发生编辑行为（写入/删除）时会按高风险处理并强制弹出审批。
   */
  fileBlackList: string[]

  // --------------------------- 命令安全 ---------------------------

  /**
   * 放行名单
   * > 命中后跳过敏感命令检测，并在沙箱文件拦截后自动放行；请谨慎放行 cat、bash 等通用命令。
   */
  commandWhiteList: string[]
  /**
   * 询问名单
   * > 命中后先弹出审批，通过后继续在沙箱中执行。
   */
  commandAskList: string[]

  // --------------------------- 网络安全 ---------------------------

  /**
   * 阻断所有网络访问
   * > 开启后默认阻断网络访问，仅允许域名列表会作为例外放行
   * @default false
   */
  blockAllNetworkAccess: boolean

  /**
   * 允许域名
   * > 开启全部阻止时，这些域名会作为例外放行
   */
  allowDomain: string[]
  /**
   * 拒绝域名
   * > 沙箱内禁止访问的域名黑名单
   */
  rejectDomain: string[]
}

interface SettingSecuredData {
  /**
   * 删除保护
   * > 开启后优先移到废纸篓/回收站，关闭后按系统删除
   */
  deleteProtection: boolean
  /**
   * 批量删除审批，删除多行内容
   * > 需开启删除保护，一次删除达到该数量时需要审批
   */
  bulkDeleteApprovalThreshold: number
}

/**
 * 运行时目录，未设置则使用系统默认路径
 */
interface SettingSecuredRuntime {
  /**
   * ego-browser CLI 可执行文件路径
   * > 该命令默认不在 PATH 中，留空则使用系统默认路径（见 getDefaultEgoBrowserPath）
   */
  egoBrowser: string
}

/**
 * 安全中心
 */
export interface SettingSecure {
  // 沙箱安全
  sandbox: SettingSecuredSandbox
  // 数据安全
  data: SettingSecuredData
  // 运行时目录
  runtime: SettingSecuredRuntime
}

/**
 * 推断 ego-browser CLI 的默认安装路径（该命令默认不在 PATH 中）
 * - macOS：onboarding 注册到 ~/.local/bin/ego-browser
 * - Windows：无官方约定，按 Chromium 系惯例（Chrome/Edge 同款目录结构）猜测
 *   %LOCALAPPDATA%\ego-lite\Application\ego-browser.exe；%LOCALAPPDATA% 由 temp
 *   （位于 AppData\Local 下）目录推导。仅作默认值，用户可在安全中心覆盖
 * - Linux / 其他：无约定，返回空串回退 PATH 查找
 */
export function getDefaultEgoBrowserPath(): string {
  // Electron 迁移：os.isMacOS/isWindows 已异步化，此处为 computed 同步消费，
  // 改用 navigator.platform 做同步平台推断（仅用于默认路径，Chromium 下可靠）
  const platform = navigator.platform
  const { os } = window.preload.inject
  if (platform.includes('Mac')) {
    return window.preload.path.join(os.getPath('home'), '.local', 'bin', 'ego-browser')
  }
  if (platform.includes('Win')) {
    const localAppData = window.preload.path.dirname(os.getPath('temp'))
    return window.preload.path.join(localAppData, 'ego-lite', 'Application', 'ego-browser.exe')
  }
  return ''
}

export function buildSettingSecure(): SettingSecure {
  return {
    sandbox: {
      enabled: true,
      fileWhiteList: [],
      fileBlackList: [
        '~/.ssh/',
        '~/.aws/',
        '~/.npmrc/',
        '~/.docker/config.json',
        '~/.docker/daemon.json',
        '~/.git-credentials',
        '~/.config/gcloud/'
      ],
      commandWhiteList: [],
      commandAskList: [],
      blockAllNetworkAccess: false,
      allowDomain: [],
      rejectDomain: []
    },
    data: {
      deleteProtection: true,
      bulkDeleteApprovalThreshold: 50
    },
    runtime: {
      egoBrowser: ''
    }
  }
}
