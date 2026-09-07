/**
 * 串口通信域（main 进程）：serialport 原生模块的薄封装。
 * 按 path 管理多个已开端口（buddy 各硬件域各自独立连接，域服务自行编排），模块不感知业务；
 * 意外断开经 onPortClosed 回调通知订阅方（各域服务据此维护自己的连接运行态并推送渲染层），
 * 不直接面向渲染层——渲染层一律走各业务域 IPC。
 */
import { SerialPort } from 'serialport'

/** 默认波特率：与 Arduino 端 Serial.begin(9600) 一致 */
const DEFAULT_BAUD_RATE = 9600

/** 串口列表项（SerialPort.list() 精简字段） */
export interface SerialPortItem {
  /** 设备路径（macOS 如 /dev/tty.usbmodemXXX，Windows 如 COM3） */
  path: string
  manufacturer?: string
}

/** 单个已开端口状态 */
export interface SerialPortState {
  path: string
  baudRate: number
}

/** 当前所有已开端口快照（域服务判定自身连接运行态用） */
export interface SerialState {
  ports: SerialPortState[]
}

/** 已开端口表（path → 端口实例 + 波特率） */
const opened = new Map<string, { port: SerialPort; baudRate: number }>()

/** 意外断开回调注册表（域服务 init 时订阅，按 path 自行判断是否与自己相关） */
const closeListeners = new Set<(path: string) => void>()

/** 订阅端口意外断开（主动 close 不触发；域服务生命周期与应用相同，无退订场景） */
export function onPortClosed(listener: (path: string) => void): void {
  closeListeners.add(listener)
}

/** 串口列表（精简字段） */
export async function listPorts(): Promise<SerialPortItem[]> {
  const infos = await SerialPort.list()
  return infos.map((info) => ({
    path: info.path,
    manufacturer: info.manufacturer || undefined
  }))
}

/** 当前所有已开端口快照 */
export function getState(): SerialState {
  const ports: SerialPortState[] = []
  for (const [path, item] of opened) {
    if (item.port.isOpen) ports.push({ path, baudRate: item.baudRate })
  }
  return { ports }
}

/**
 * 打开串口（同 path 重复打开先关旧的，多端口并存互不影响）。Arduino 在 open 时会复位，
 * 复位约需 400ms，写入指令前无需特判（指令为状态量，丢了可重发）。
 */
export async function openPort(path: string, baudRate: number = DEFAULT_BAUD_RATE): Promise<void> {
  await closePort(path)
  const next = new SerialPort({ path, baudRate, autoOpen: false })
  await new Promise<void>((resolve, reject) => {
    next.open((err) => (err ? reject(err) : resolve()))
  })

  next.on('close', () => {
    // 主动 close 已提前删表（表内已不是 next），此处只处理意外断开
    const current = opened.get(path)
    if (current?.port === next) {
      opened.delete(path)
      for (const listener of closeListeners) listener(path)
    }
  })
  next.on('error', (err) => {
    console.error('[serial] 端口错误', err.message)
  })

  opened.set(path, { port: next, baudRate })
}

/** 写入文本（utf8）；该端口未连接时抛错由调用方处理 */
export async function writePort(path: string, data: string): Promise<void> {
  const current = opened.get(path)
  if (!current || !current.port.isOpen) throw new Error(`串口未连接：${path}`)
  await new Promise<void>((resolve, reject) => {
    current.port.write(data, 'utf8', (err) => (err ? reject(err) : resolve()))
  })
}

/** 关闭指定串口（幂等）；提前删表使 close 事件回调不触发意外断开通知 */
export async function closePort(path: string): Promise<void> {
  const current = opened.get(path)
  if (!current) return
  opened.delete(path)
  if (!current.port.isOpen) return
  await new Promise<void>((resolve) => current.port.close(() => resolve()))
}
