/**
 * 工作条独立 preload（window.workbar）契约，实现位于主进程 toolbarIpc。
 * 全局名不用 window.toolbar：与 DOM 遗留属性 BarProp 冲突。
 */

/** 工作条条目类型：应用程序 / 内置应用（网页快开、拓展插件预留） */
type ToolbarItemType = 'app' | 'builtin'

declare interface ToolbarItem {
  type: ToolbarItemType
  /** 展示名 */
  name: string
  /** app：应用启动路径；builtin：内置功能标识（当前仅 'ai'） */
  target: string
  /** 内置应用自带图标 dataURL；应用为空串，经 mistrelle://icon/<target> 协议加载 */
  icon: string
}

declare interface ToolbarApi {
  /** 获取条目列表（内置应用 + 已安装应用；应用项不携带图标，主进程进程内缓存） */
  getItems(): Promise<ToolbarItem[]>
  /** 激活条目（应用启动 / 内置功能分发）；返回空串成功，否则为错误信息 */
  activate(item: ToolbarItem): Promise<string>
  /** 隐藏工作条窗口 */
  hide(): Promise<void>
}
