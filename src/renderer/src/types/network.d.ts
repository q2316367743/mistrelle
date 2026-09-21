/**
 * 网络域类型（window.preload.network）：网络设置读写桥。
 * 契约集中在 @common/types/networkSetting（main / preload / 渲染层三方共用）。
 */
import type { SettingNetwork } from '@common/types/networkSetting'

declare interface NetworkApi {
  /** 读取网络设置（main 侧归一化，缺失字段回退默认值） */
  getSetting: () => Promise<SettingNetwork>
  /** 保存网络设置（main 全量覆写落盘，返回归一化结果） */
  saveSetting: (setting: SettingNetwork) => Promise<SettingNetwork>
}
