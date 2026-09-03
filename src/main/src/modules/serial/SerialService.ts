/**
 * 串口通信域（main 进程）：serialport 原生模块的薄封装。
 * 同一时间只持有一个打开的串口（模块级单例），意外断开时广播渲染层；
 * 渲染层主动 close 不广播（渲染层自己已同步状态）。
 */
import { BrowserWindow } from 'electron'
import { SerialPort } from 'serialport'
import { SerialChannels, type SerialPortItem, type SerialState } from '~/modules/serial/serialChannels'

/** 默认波特率：与 Arduino 端 Serial.begin(9600) 一致 */
const DEFAULT_BAUD_RATE = 9600

let port: SerialPort | null = null
let openedPath: string | null = null

function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

/** 串口列表（精简字段） */
export async function listPorts(): Promise<SerialPortItem[]> {
  const infos = await SerialPort.list()
  return infos.map((info) => ({
    path: info.path,
    manufacturer: info.manufacturer || undefined
  }))
}

/** 当前串口状态快照（渲染层 getState 与页面初始化共用） */
export function getState(): SerialState {
  return { path: openedPath, isOpen: !!port?.isOpen }
}

/**
 * 打开串口（已开则先关旧的）。Arduino 在 open 时会复位，
 * 复位约需 400ms，写入指令前页面无需特判（指令为状态量，丢了可重发）。
 */
export async function openPort(path: string, baudRate: number = DEFAULT_BAUD_RATE): Promise<void> {
  await closePort()
  const next = new SerialPort({ path, baudRate, autoOpen: false })
  await new Promise<void>((resolve, reject) => {
    next.open((err) => (err ? reject(err) : resolve()))
  })

  next.on('close', () => {
    // 主动 close 已提前清引用（port !== next），此处只处理意外断开
    if (port === next) {
      port = null
      openedPath = null
      broadcast(SerialChannels.closed)
    }
  })
  next.on('error', (err) => {
    console.error('[serial] 端口错误', err.message)
  })
  next.on('data', (chunk: Buffer) => {
    broadcast(SerialChannels.data, chunk.toString('utf8'))
  })

  port = next
  openedPath = path
}

/** 写入文本（utf8）；未连接时抛错由渲染层提示 */
export async function writePort(data: string): Promise<void> {
  const current = port
  if (!current || !current.isOpen) throw new Error('串口未连接')
  await new Promise<void>((resolve, reject) => {
    current.write(data, 'utf8', (err) => (err ? reject(err) : resolve()))
  })
}

/** 关闭串口（幂等）；提前清引用使 close 事件回调不广播 */
export async function closePort(): Promise<void> {
  const current = port
  if (!current) return
  port = null
  openedPath = null
  if (!current.isOpen) return
  await new Promise<void>((resolve) => current.close(() => resolve()))
}
