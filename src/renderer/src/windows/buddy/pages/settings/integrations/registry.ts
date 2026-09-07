/**
 * 应用集成登记表：决定应用集成页的卡片与顺序（对齐 hardware/traffic-light SOFTWARE_REGISTRY 模式）。
 * 新增集成 = SOFTWARE_NAMES 加成员 + resources/plugins/<软件>/ 放模板 + main 侧 adapter + 此处登记。
 */
import type { BuddyEventName } from '@common/types/buddyEvent'
import { BUDDY_EVENT_NAMES } from '@common/types/buddyEvent'
import type { SoftwareName } from '@common/types/trafficLight'

export interface IntegrationItem {
  name: SoftwareName
  label: string
  /** 一句话说明该软件与 mistrelle 的协作方式 */
  description: string
  /** 集成后事件可驱动的 buddy 设备 */
  devices: string
  /** 该软件接入插件支持上报的事件全集（卡片按 BUDDY_EVENT_GROUPS 分组展示） */
  events: readonly BuddyEventName[]
}

export const INTEGRATION_REGISTRY: readonly IntegrationItem[] = [
  {
    name: 'opencode',
    label: 'Opencode',
    description:
      'AI 编程 agent。一键安装内置事件插件后，其会话/消息/权限/工具等事件经本地事件服务上报给 mistrelle。',
    devices: '红绿灯（事件→灯态绑定）、ESP32-S3-LCD-1.28（事件→屏幕状态心跳）',
    events: BUDDY_EVENT_NAMES
  }
]
