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
  /** 安装/更新后的生效方式说明（重启软件 / 新开会话等，随软件而异） */
  effectHint: string
}

/** ZCode hooks 实际能上报的事件子集（其余 Buddy 事件 ZCode 无对应钩子，不投递） */
export const ZCODE_HOOK_EVENTS: readonly BuddyEventName[] = [
  'session.created',
  'session.compacted',
  'message.updated',
  'tool.execute.before',
  'tool.execute.after',
  'file.edited',
  'session.idle',
  'permission.asked'
]

export const INTEGRATION_REGISTRY: readonly IntegrationItem[] = [
  {
    name: 'opencode',
    label: 'Opencode',
    description:
      'AI 编程 agent。一键安装内置事件插件后，其会话/消息/权限/工具等事件经本地事件服务上报给 mistrelle。',
    devices: '红绿灯（事件→灯态绑定）、ESP32-S3-LCD-1.28（事件→屏幕状态心跳）',
    events: BUDDY_EVENT_NAMES,
    effectHint: '安装 / 更新插件后需重启 Opencode 才能加载生效。'
  },
  {
    name: 'zcode',
    label: 'ZCode',
    description:
      'AI 编程 agent（终端）。一键写入 hooks 配置后，其会话/工具/权限等事件经本地事件服务上报给 mistrelle，工具审批可由 mistrelle 面板/小键盘代答；仅上报 ZCode hooks 覆盖的事件。',
    devices: '红绿灯（事件→灯态绑定）、ESP32-S3-LCD-1.28（事件→屏幕状态心跳）',
    events: ZCODE_HOOK_EVENTS,
    effectHint: '安装 / 更新后新开 zcode 会话即可生效（运行中的会话不热加载）。'
  }
]
