import { ToolChat } from '@/modules/chat/agent/AgentChat'
import { buildChatSubPath } from '@/modules/chat/service/ChatService'
import { MAX_SUB_AGENT_STEPS } from '@/global/Constant'
import { SUB_AGENT_SCENE } from './policy'
import { persistSubAgent } from './persistence'
import { registerRunningSubAgent, unregisterRunningSubAgent } from './registry'
import { buildSubAgentSystemPrompt } from './prompt'
import { extractFinalSummary } from './summary'
import type { SubAgentOptions, SubAgentResult } from './types'

/**
 * 等待子 Agent 循环结束：轮询 status 直到完成 / 错误 / 停止。
 */
const waitForCompletion = (chat: ToolChat): Promise<'completed' | 'error' | 'stop'> => {
  return new Promise((resolve) => {
    const check = () => {
      const status = chat.status.value
      if (status === 'complete') return resolve('completed')
      if (status === 'error') return resolve('error')
      if (status === 'stop') return resolve('stop')
      setTimeout(check, 200)
    }
    check()
  })
}

/**
 * 启动子 Agent 执行任务。
 *
 * 权限模型：mode=0（默认）+ InteractiveBridge 禁用。
 * - safe 工具（file_read、file_list 等）自动放行
 * - 白名单内 shell 命令自动放行
 * - 需审批的操作（非白名单 shell、写入类工具）因交互桥禁用而自动拒绝
 * - 安全中心黑名单命中的操作同样自动拒绝
 * - design 型子 Agent 额外注入画布场景工具（canvas_*，安全策略已在 canvas 模块注册，sandbox/workspace 可信区内放行）
 *
 * 流程：
 * 1. 使用调用方预生成的 subId，创建独立 ToolChat 实例（按能力类型选择 systemPrompt 与场景工具）
 * 2. 建立 throttledWatch 持久化子 Agent 消息到 message/sub_{subId}.json
 * 3. 发送任务消息，等待循环结束
 * 4. 提取最终摘要，持久化最终状态
 * 5. 注销注册表并销毁子 Agent，返回摘要
 */
export const runSubAgent = async (options: SubAgentOptions): Promise<SubAgentResult> => {
  const {
    subId,
    chatId,
    task,
    sandboxDir,
    workspace,
    model,
    provide,
    reasoningEffort,
    parentSignal,
    subAgentType
  } = options
  const storageKey = buildChatSubPath(chatId, subId)

  // 父 Agent 已终止：直接返回，不启动子 Agent
  if (parentSignal?.aborted) {
    return { subId, summary: '(父 Agent 已终止，子 Agent 未启动)', status: 'error' }
  }

  // 创建子 Agent 引擎实例（mode=0 默认模式，由安全中心策略控制权限）
  const subChat = new ToolChat({
    sandboxDir,
    workspace,
    mode: 0,
    enableSkill: true,
    systemPrompt: buildSubAgentSystemPrompt(workspace, subAgentType),
    // 能力类型 → 场景工具（design → canvas）；research 无场景工具
    sceneType: SUB_AGENT_SCENE[subAgentType ?? 'research'],
    chatId, // 子 Agent 自身的 chatId（虽然子 Agent 不会再 spawn 子 Agent，但保持字段一致）
    isSubAgent: true, // 禁用 spawn_agent 工具 + 不注入子 Agent 使用指导，防止嵌套派发
    maxSteps: MAX_SUB_AGENT_STEPS, // 子 Agent 独立步数预算：复杂任务比主 Agent 需要更多步数才能收尾
    finalizeOnMaxSteps: true // 触顶时执行最后一次无工具收尾调用，强制立即总结，而不是只返回截断提示
  })

  // 禁用交互桥：需审批的操作自动拒绝，不向用户提问
  subChat.interactive.setEnabled(false)

  // 注册到运行中注册表：UI 可实时绑定消息流
  registerRunningSubAgent(subId, subChat)

  // 父 Agent 终止时级联终止子 Agent
  const onParentAbort = () => {
    void subChat.abortChat()
  }
  parentSignal?.addEventListener('abort', onParentAbort)

  // 建立持久化 watcher：子 Agent 消息变化时节流写入 sub_{subId}.json
  // finished 标志 + 回调快照双保险：throttle 的 trailing 定时器在 unWatch 后仍会触发，
  // 而 destroy() 会把 messages 清空——若不拦截，残留写入会用空数组覆盖 finally 中的最终持久化
  let finished = false
  const unWatch = throttledWatch(
    subChat.messages,
    (messages) => {
      if (finished) return
      void persistSubAgent(storageKey, messages)
    },
    { throttle: 1000, deep: true }
  )

  // 发送任务消息并等待完成
  const params = {
    message: {
      content: [{ type: 'text' as const, data: task, time: Date.now() }],
      model,
      provide,
      reasoning_effort: reasoningEffort
    },
    mode: 0 as const,
    workspace
  }

  let status: 'completed' | 'error' | 'stop' = 'error'
  let summary = '(子 Agent 执行失败)'

  try {
    await subChat.sendUserMessage(params)
    status = await waitForCompletion(subChat)
    summary = extractFinalSummary(
      subChat.messages.value,
      subChat.hitMaxSteps.value,
      subChat.reachedMaxSteps.value
    )
  } catch (err) {
    summary = `子 Agent 执行异常：${err instanceof Error ? err.message : String(err)}`
    status = 'error'
  } finally {
    // 移除父 Agent abort 监听，避免残留
    parentSignal?.removeEventListener('abort', onParentAbort)
    // 先置 finished 再 unWatch + destroy：阻止残留 trailing 写入用空数组覆盖最终持久化
    finished = true
    // 最终持久化（确保最后一帧消息写入磁盘）
    unWatch()
    await persistSubAgent(storageKey, subChat.messages.value)
    // 磁盘就绪后再注销注册表，UI 回落快照时能读到最终状态，避免展示到中途的旧快照
    unregisterRunningSubAgent(subId)
    subChat.destroy()
  }

  return { subId, summary, status: status === 'completed' ? 'completed' : 'error' }
}
