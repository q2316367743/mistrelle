/**
 * window.preload.serial 契约：串口通信桥。
 * 与 main 的 SerialService（模块级单例）/ serialIpc.ts 对应；修改需与 preload 侧同步。
 */

/** 串口列表项（SerialPort.list() 精简字段） */
declare interface SerialPortItem {
  /** 设备路径（macOS 如 /dev/tty.usbmodemXXX，Windows 如 COM3） */
  path: string
  manufacturer?: string
}

/** 当前串口状态快照 */
declare interface SerialState {
  /** 当前打开的串口路径；未连接为 null */
  path: string | null
  isOpen: boolean
}

declare interface SerialApi {
  /** 串口设备列表 */
  list(): Promise<SerialPortItem[]>
  /** 打开串口（已开则先关旧的）；默认 9600 与 Arduino 端一致 */
  open(path: string, baudRate?: number): Promise<void>
  /** 写入文本（utf8）；未连接时 reject */
  write(data: string): Promise<void>
  /** 关闭串口（幂等） */
  close(): Promise<void>
  /** 当前连接状态快照 */
  getState(): Promise<SerialState>
  /** 订阅串口数据推送（utf8 文本原样）；返回取消订阅函数 */
  onData(callback: (chunk: string) => void): () => void
  /** 订阅连接意外断开推送；返回取消订阅函数 */
  onClosed(callback: () => void): () => void
}
