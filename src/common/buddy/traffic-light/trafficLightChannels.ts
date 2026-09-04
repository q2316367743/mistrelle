/**
 * 红绿灯（信号灯）IPC 通道常量（main / preload 共用）。
 * 通道命名沿用 'domain:action' 约定；域类型与名称映射在 @common/types/trafficLight，
 * 配置由 main 进程持有，落盘 ~/.mistrelle/buddy/traffic-light.json。
 */

export const TrafficLightChannels = {
  /** 读取整份配置（含 lastPort 与各软件绑定） */
  getConfig: 'trafficLight:getConfig',
  /** 保存单个软件配置（灯态唯一/软件互斥由 main 校验归一） */
  saveSoftwareConfig: 'trafficLight:saveSoftwareConfig',
  /** 记住上次使用的串口（伙伴窗口连接成功后调用） */
  setLastPort: 'trafficLight:setLastPort',
  /** 检查指定软件的事件接入配置是否已安装（与内置模板内容比对） */
  checkPlatform: 'trafficLight:checkPlatform',
  /** 安装/更新指定软件的事件接入配置（覆盖写入其插件目录） */
  installPlatform: 'trafficLight:installPlatform'
} as const
