/**
 * 串口通信域通道常量与类型（preload 桥与 main handler 共用）。
 * 通道命名沿用 'domain:action' 约定；本文件只承载 serial 域。
 */
export const SerialChannels = {
  list: 'serial:list',
  open: 'serial:open',
  write: 'serial:write',
  close: 'serial:close',
  getState: 'serial:getState',
  /** 主进程 → 渲染层：收到串口数据（utf8 文本原样推送） */
  data: 'serial:data',
  /** 主进程 → 渲染层：连接意外断开（拔线/驱动错误）；主动 close 不推送 */
  closed: 'serial:closed'
} as const

/** 串口列表项（SerialPort.list() 精简字段） */
export interface SerialPortItem {
  /** 设备路径（macOS 如 /dev/tty.usbmodemXXX，Windows 如 COM3） */
  path: string
  manufacturer?: string
}

/** 当前串口状态快照 */
export interface SerialState {
  /** 当前打开的串口路径；未连接为 null */
  path: string | null
  isOpen: boolean
}
