/**
 * window.preload.serial 契约：串口设备只读查询。
 * 连接/写入/断开等操作在各业务域桥（trafficLight/esp32Lcd）；修改需与 preload 侧同步。
 */

/** 串口列表项（SerialPort.list() 精简字段） */
declare interface SerialPortItem {
  /** 设备路径（macOS 如 /dev/tty.usbmodemXXX，Windows 如 COM3） */
  path: string
  manufacturer?: string
}

declare interface SerialApi {
  /** 串口设备列表 */
  list(): Promise<SerialPortItem[]>
}
