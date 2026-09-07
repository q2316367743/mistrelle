/**
 * 应用集成状态（模块级单例）：外部软件接入配置的三态检测与一键安装。
 * 应用集成页与硬件页（红绿灯/圆屏门控）共用同一份状态，安装后立即重查刷新。
 */
import {
  INTEGRATION_ACTIVITY_LIMIT,
  type IntegrationActivityEntry,
  type PlatformConfigStatus,
  type PlatformStatus
} from '@common/types/integrations'
import type { BuddyEventName } from '@common/types/buddyEvent'
import type { SoftwareName } from '@common/types/trafficLight'
import { MessageUtil } from '@/utils/modal'
import { INTEGRATION_REGISTRY } from './registry'

/** 各软件接入配置状态（未检测前为空，按未安装展示） */
const statuses = ref<Partial<Record<SoftwareName, PlatformStatus>>>({})

/** 调试事件流（纯内存：main 首拉 + 实时推送，新事件在后，超限截断） */
const activity = ref<IntegrationActivityEntry[]>([])

/** 各软件已捕获事件（至少收到一次；独立于缓冲上限，供卡片按事件点亮对照） */
const received = ref<Partial<Record<SoftwareName, BuddyEventName[]>>>({})

let initialized = false

/** 查询指定软件的接入配置状态（与内置模板内容比对） */
async function check(name: SoftwareName): Promise<void> {
  statuses.value[name] = await window.preload.integrations.checkPlatform(name)
}

/** 安装/更新指定软件的接入配置，成功后刷新状态（插件需重启对应软件后加载） */
async function install(name: SoftwareName): Promise<void> {
  const result = await window.preload.integrations.installPlatform(name)
  if (!result.ok) {
    MessageUtil.error(result.msg || '安装失败')
    return
  }
  MessageUtil.success('已安装，重启对应软件后生效')
  await check(name)
}

/** 状态归一（未检测 = 未安装） */
function statusOf(name: SoftwareName): PlatformConfigStatus {
  return statuses.value[name]?.status ?? 'missing'
}

/** 清空全部调试事件流（main 缓冲与已捕获标记一并复位；调用方无需本地清） */
async function clearActivity(): Promise<void> {
  await window.preload.integrations.clearActivity()
}

export function useIntegrations() {
  if (!initialized) {
    initialized = true
    for (const item of INTEGRATION_REGISTRY) void check(item.name)
    // 调试事件流：先拉一次补足窗口懒创建前的事件与已捕获标记，再订阅实时推送
    void window.preload.integrations.getActivity().then((state) => {
      activity.value = state.entries
      received.value = state.received
    })
    window.preload.integrations.onActivity((entry) => {
      activity.value = [...activity.value, entry]
      if (activity.value.length > INTEGRATION_ACTIVITY_LIMIT) {
        activity.value = activity.value.slice(activity.value.length - INTEGRATION_ACTIVITY_LIMIT)
      }
      const platformEvents = received.value[entry.platform]
      if (platformEvents) {
        if (!platformEvents.includes(entry.event)) {
          received.value[entry.platform] = [...platformEvents, entry.event]
        }
      } else {
        received.value[entry.platform] = [entry.event]
      }
    })
  }
  return { statuses, activity, received, clearActivity, statusOf, check, install }
}
