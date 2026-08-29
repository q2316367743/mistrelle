/**
 * 工作条域 IPC 通道常量与载荷类型。
 * 消费方：独立 preload 入口 src/preload/toolbar.ts（薄桥）+ 主进程 src/main/src/ipc/toolbarIpc.ts。
 */

/** 工作条条目类型：应用程序 / 内置应用（网页快开、拓展插件预留） */
export type ToolbarItemType = 'app' | 'builtin'

export interface ToolbarItem {
  type: ToolbarItemType
  /** 展示名 */
  name: string
  /** app：应用启动路径；builtin：内置功能标识（当前仅 'ai'） */
  target: string
  /** 内置应用自带图标 dataURL；应用为空串，经 mistrelle://icon/<target> 协议加载 */
  icon: string
}

export const ToolbarChannels = {
  /** 获取条目列表（内置应用 + 已安装应用；应用项不携带图标，主进程进程内缓存） */
  getItems: 'toolbar:item:list',
  /** 激活条目，载荷为 ToolbarItem，按类型分发 */
  activate: 'toolbar:item:activate',
  /** 隐藏工作条窗口 */
  hide: 'toolbar:hide'
} as const
