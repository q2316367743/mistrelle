import { shallowRef } from 'vue'
import type { Ref } from 'vue'
import type { ChatMessage } from '@/domain'
import type { ToolChat } from '@/modules/chat/agent/AgentChat'

/**
 * 运行中子 Agent 注册表。
 * 供 UI 实时绑定运行中子 Agent 的 messages ref（streaming 效果），
 * 完成后注销，UI 回落到磁盘快照。
 * 使用 shallowRef 避免对 ToolChat 深度代理（ref 属性会被 reactive 自动解包，导致无法拿到 Ref 类型）。
 */
const runningSubAgents = shallowRef(new Map<string, ToolChat>())

/** 注册运行中的子 Agent（创建后、发送任务前调用） */
export const registerRunningSubAgent = (subId: string, chat: ToolChat): void => {
  const next = new Map(runningSubAgents.value)
  next.set(subId, chat)
  runningSubAgents.value = next
}

/** 注销运行中的子 Agent（完成后调用，UI 回落磁盘快照） */
export const unregisterRunningSubAgent = (subId: string): void => {
  if (!runningSubAgents.value.has(subId)) return
  const next = new Map(runningSubAgents.value)
  next.delete(subId)
  runningSubAgents.value = next
}

/**
 * 获取运行中的子 Agent 的 messages ref；不存在（已完成 / 未启动）返回 undefined。
 * 读取时依赖 shallowRef 的 .value，computed 中调用可响应注册 / 注销变化。
 */
export const getRunningSubAgentMessages = (subId: string): Ref<ChatMessage[]> | undefined => {
  return runningSubAgents.value.get(subId)?.messages
}
