/**
 * 额度插件域类型契约（公共域，跨硬件共享）：main / preload / renderer 跨端共享。
 * 额度插件是独立公共能力——内置预置 + 插件目录第三方统一模型，未来更多硬件（不止 ESP32 LCD）
 * 都消费快照；设备侧经 quotaBus（main 内）或 quota:snapshot 推送订阅快照。
 * 约定：每个 type 下方紧跟同名 Options（Array<CommonSelect<type>>）；通道常量在 @common/buddy/quota，
 * window 挂载由渲染层 vite-env.d.ts 声明（仅伙伴窗口独立 preload 注入）。
 * 配置由 main 持有，落盘 ~/.mistrelle/buddy/quota.json（独立于任何设备配置）。
 */
import { CommonSelect } from './CommonSelect'

/** 内置额度插件 id（内置是可关闭的预置形态；未来在线插件列表 + 版本 + 本地更新，接口暂未实现） */
export type BuiltinQuotaPluginId = 'deepseek'

/** 内置额度插件名称映射 */
export const BuiltinQuotaPluginIdOptions: Array<CommonSelect<BuiltinQuotaPluginId>> = [
  { value: 'deepseek', label: 'DeepSeek 余额' }
]

/** 内置插件配置：启用开关 + 插件声明 settings 的键值（键由插件脚本声明；内置同样可关闭） */
export interface BuiltinQuotaPluginConfig {
  enabled: boolean
  settings: Record<string, string>
}

/** 第三方插件（插件目录文件）配置：与内置同构，键为文件名 */
export interface ExternalQuotaPluginConfig {
  enabled: boolean
  settings: Record<string, string>
}

/** 额度配置（落盘结构 ~/.mistrelle/buddy/quota.json，独立公共域不依附任何设备） */
export interface QuotaConfig {
  /** 自动刷新间隔（分钟，1-1440） */
  intervalMinutes: number
  builtin: Partial<Record<BuiltinQuotaPluginId, BuiltinQuotaPluginConfig>>
  /** 第三方插件配置（键 = 插件目录下的文件名；未来在线安装/更新复用此结构扩展 version/source） */
  external: Record<string, ExternalQuotaPluginConfig>
  /** 上次刷新快照（main 刷新后写入并落盘，启动时恢复；渲染层保存配置原样带回即可，main 以内存值为准） */
  lastSnapshot?: QuotaSnapshot | null
}

/** 保存配置结果（失败时 msg 为中文原因，不抛错） */
export interface QuotaSaveResult {
  ok: boolean
  msg?: string
}

/** 插件声明的一个设置项（definePlugin.settings 元素；secret 项 UI 用密码框渲染） */
export interface PluginSettingField {
  key: string
  label: string
  secret?: boolean
  /** 输入框占位提示（如「留空则按当前余额视为满格」） */
  placeholder?: string
}

/** 额度插件描述（UI 列表渲染用；builtin/external 统一模型） */
export interface QuotaPluginDescriptor {
  /** builtin = 应用预置（随版本更新）；external = 插件目录第三方文件 */
  source: 'builtin' | 'external'
  /** 配置键：builtin = 插件 id；external = 文件名 */
  key: string
  /** definePlugin 声明的 id */
  id: string
  name: string
  /** 插件声明的设置项（渲染通用 settings 表单） */
  settings: PluginSettingField[]
  /** 加载失败原因（语法错误/契约不符；有 error 的插件不参与执行） */
  error?: string
}

/** 额度条目（插件 fetch 返回的快照项） */
export interface QuotaItem {
  /** 来源插件键（builtin = id / external = 文件名）；由执行器汇总快照时写入，插件脚本无需返回 */
  pluginKey?: string
  label: string
  value: string
  /** 屏显模板（LCD 心跳协议 type 列：codex=按次额度 / deepseek=剩余价值）；缺省该条目不下发屏幕 */
  screenTemplate?: 'codex' | 'deepseek'
  /** 屏显进度环 0..100；缺省按协议默认 100 */
  screenPct?: number
  /** 屏显核心数值（仅 [0-9.]，≤15 字符，屏上大号字） */
  screenValue?: string
  /** 屏显单位（≤7 字节 UTF-8，如 元 / $） */
  screenUnit?: string
}

/** 额度快照（渲染层展示 / 设备下发 / 串口协议共用；error 非空表示本次刷新有失败项） */
export interface QuotaSnapshot {
  /** items 为全部启用插件的聚合（UI 全量预览）；屏幕类设备按 esp32Lcd 配置 screenQuota 键自行挑选上屏条目 */
  items: QuotaItem[]
  error?: string
  /** 刷新完成时间（ms 时间戳） */
  at: number
}

/** window.preload.quota 契约：额度插件域桥（仅伙伴窗口的独立 preload 注入，主窗口运行时不存在） */
export interface QuotaApi {
  /** 读取整份配置 */
  getConfig(): Promise<QuotaConfig>
  /** 保存整份配置（归一化后落盘；刷新定时器随间隔变化自动重启） */
  saveConfig(config: QuotaConfig): Promise<QuotaSaveResult>
  /** 列出全部额度插件（内置预置 + 插件目录第三方扫描，统一模型） */
  listPlugins(): Promise<QuotaPluginDescriptor[]>
  /** 在系统文件管理器中打开插件目录（不存在则先创建） */
  openPluginsDir(): Promise<void>
  /** 立即执行一次额度刷新（返回快照；同时经快照总线分发给各订阅设备并推送渲染层） */
  runNow(): Promise<QuotaSnapshot>
  /** 读取最近一次快照（无则 null） */
  getLastSnapshot(): Promise<QuotaSnapshot | null>
  /** 订阅额度快照更新推送；返回取消订阅函数 */
  onSnapshot(callback: (snapshot: QuotaSnapshot) => void): () => void
}
