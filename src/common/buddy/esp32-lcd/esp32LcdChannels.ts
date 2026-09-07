/**
 * ESP32-S3-LCD-1.28（圆屏）IPC 通道常量（main / preload 共用）。
 * 通道命名沿用 'domain:action' 约定；域类型在 @common/types/esp32Lcd，
 * 配置由 main 进程持有，落盘 ~/.mistrelle/buddy/esp32-lcd.json。
 * 额度快照属公共 quota 域（quota:* 通道），不在本域。
 */

export const Esp32LcdChannels = {
  /** 读取整份配置 */
  getConfig: 'esp32Lcd:getConfig',
  /** 保存整份配置（main 归一化后落盘） */
  saveConfig: 'esp32Lcd:saveConfig',
  /** 连接串口（成功即记忆 lastPort/baudRate 并广播运行态） */
  connect: 'esp32Lcd:connect',
  /** 断开当前连接 */
  disconnect: 'esp32Lcd:disconnect',
  /** 读取完整运行态（连接 + 最近事件） */
  getState: 'esp32Lcd:getState',
  /** 主进程 → 渲染层：当前 buddy 事件变化 */
  event: 'esp32Lcd:event',
  /** 主进程 → 渲染层：连接运行态变化（连接/断开/意外断开） */
  state: 'esp32Lcd:state'
} as const
