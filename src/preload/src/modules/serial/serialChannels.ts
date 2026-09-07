/**
 * 串口通信域通道常量与类型（preload 桥与 main handler 共用）。
 * 连接/写入/断开等操作一律走各业务域 IPC（逻辑集中 main），serial 域只保留
 * 系统级只读查询：设备列表（buddy 各硬件域下拉共用）。
 */
export const SerialChannels = {
  list: 'serial:list'
} as const

/** 串口列表项（SerialPort.list() 精简字段） */
export interface SerialPortItem {
  /** 设备路径（macOS 如 /dev/tty.usbmodemXXX，Windows 如 COM3） */
  path: string
  manufacturer?: string
}
