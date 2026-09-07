/**
 * 应用集成状态（模块级单例）：外部软件接入配置的三态检测与一键安装。
 * 应用集成页与硬件页（红绿灯/圆屏门控）共用同一份状态，安装后立即重查刷新。
 */
import type { PlatformConfigStatus, PlatformStatus } from '@common/types/integrations'
import type { SoftwareName } from '@common/types/trafficLight'
import { MessageUtil } from '@/utils/modal'
import { INTEGRATION_REGISTRY } from './registry'

/** 各软件接入配置状态（未检测前为空，按未安装展示） */
const statuses = ref<Partial<Record<SoftwareName, PlatformStatus>>>({})

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

export function useIntegrations() {
  if (!initialized) {
    initialized = true
    for (const item of INTEGRATION_REGISTRY) void check(item.name)
  }
  return { statuses, statusOf, check, install }
}
