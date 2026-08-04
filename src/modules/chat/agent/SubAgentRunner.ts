import type { AiChatContent } from '@/entity/ai'
import type { ChatMessage, TextContent } from '@/domain'
import { ToolChat } from './AgentChat'
import { aiChatContentGet, aiChatContentSet, buildChatMainPath, buildChatSubPath } from '@/modules/chat/service/ChatService'
import { MAX_SUB_AGENT_STEPS } from '@/global/Constant'

export interface SubAgentOptions {
  /** 子 Agent ID（由调用方预生成并先行标记到主 Agent 消息，UI 运行中即可切换） */
  subId: string
  /** 主 Agent 的聊天 ID（用于构建子 Agent 文件路径） */
  chatId: string
  /** 任务描述 */
  task: string
  /** 沙盒目录（继承自主 Agent） */
  sandboxDir: string
  /** 工作空间（继承自主 Agent） */
  workspace: string
  /** 模型 ID */
  model: string
  /** 模型提供商 */
  provide: string
  /** 推理强度 */
  reasoningEffort?: 'high' | 'max'
  /** 主 Agent 的 AbortSignal：主 Agent 终止时级联终止子 Agent */
  parentSignal?: AbortSignal
}

export interface SubAgentResult {
  subId: string
  summary: string
  status: 'completed' | 'error'
}

// ─── 运行中子 Agent 注册表 ─────────────────────────────────────────
// 供 UI 实时绑定运行中子 Agent 的 messages ref（streaming 效果），
// 完成后注销，UI 回落到磁盘快照。shallowRef 避免对 ToolChat 深度代理
// （ref 属性会被 reactive 自动解包，导致无法拿到 Ref 类型）。

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

/**
 * 子 Agent 系统提示词：告知其角色定位与输出要求。
 * 工具权限不在此处限制——由安全中心策略 + 交互桥禁用统一控制。
 */
const buildSubAgentSystemPrompt = (workspace: string): string => {
  const parts: string[] = [
    '你是一个子 Agent，被主 Agent 委托执行调研任务。',
    '',
    '## 工作要求',
    '- 充分使用工具收集信息，不要凭空猜测。',
    '- 可以使用 shell 命令（如 grep、find、git log）提高调研效率，但写入类操作会被安全策略拦截。',
    '- 任务完成后，在最后一条消息中用结构化的文本总结你的发现和分析结果。',
    '- 摘要应包含：关键发现、数据/代码结构分析、建议（如有）。',
    '- 摘要长度控制在 2000 字以内，聚焦核心信息。'
  ]
  if (workspace) {
    parts.push('', `## 工作空间`, `当前工作空间：${workspace}`, '用户消息中引用的文件路径为绝对路径，可直接读取。')
  }
  return parts.join('\n')
}

/**
 * 从消息列表末尾向前查找最后一条 assistant 消息的文本内容作为摘要。
 * 子 Agent 触顶（hitMaxSteps）未正常收尾时，返回明确的未完成标记，而不是把过程叙述当摘要返回给主 Agent。
 * 触顶但收尾成功（reachedMaxSteps 为 true）时，在摘要末尾追加触顶备注，提示结论可能未完全覆盖。
 */
const extractFinalSummary = (messages: ChatMessage[], hitMaxSteps: boolean, reachedMaxSteps: boolean): string => {
  if (hitMaxSteps) {
    return `[子 Agent 已连续执行 ${MAX_SUB_AGENT_STEPS} 步仍未完成调研，未输出最终摘要。主 Agent 可基于其中间结果自行收尾，或缩小任务范围后重新派发。]`
  }
  let summary = '(子 Agent 未产生有效文本输出)'
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant' || !msg.content) continue
    const texts = msg.content
      .filter((c): c is TextContent => c.type === 'text' || c.type === 'markdown')
      .map((c) => c.data)
      .join('')
    if (texts.trim()) {
      summary = texts.trim()
      break
    }
  }
  if (summary === '(子 Agent 未产生有效文本输出)') return summary
  return reachedMaxSteps
    ? `${summary}\n\n> 注：本次调研已达到步数上限，结论由子 Agent 即时总结，可能未完全覆盖。`
    : summary
}

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
 * 持久化子 Agent 消息到 sub_{subId}.json，复用 AiChatContent 结构。
 */
const persistSubAgent = async (storageKey: string, messages: ChatMessage[]): Promise<void> => {
  const content: AiChatContent = {
    updatedTime: Date.now(),
    draft: undefined,
    agentId: '',
    workspace: '',
    mode: 0,
    messages: toRaw(messages)
  }
  await aiChatContentSet(storageKey, content)
}

/**
 * 启动子 Agent 执行调研任务。
 *
 * 权限模型：mode=0（默认）+ InteractiveBridge 禁用。
 * - safe 工具（file_read、file_list 等）自动放行
 * - 白名单内 shell 命令自动放行
 * - 需审批的操作（非白名单 shell、写入类工具）因交互桥禁用而自动拒绝
 * - 安全中心黑名单命中的操作同样自动拒绝
 *
 * 流程：
 * 1. 使用调用方预生成的 subId，创建独立 ToolChat 实例
 * 2. 建立 throttledWatch 持久化子 Agent 消息到 message/sub_{subId}.json
 * 3. 发送任务消息，等待循环结束
 * 4. 提取最终摘要，持久化最终状态
 * 5. 销毁子 Agent，返回摘要
 */
export const runSubAgent = async (options: SubAgentOptions): Promise<SubAgentResult> => {
  const { subId, chatId, task, sandboxDir, workspace, model, provide, reasoningEffort, parentSignal } = options
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
    systemPrompt: buildSubAgentSystemPrompt(workspace),
    chatId, // 子 Agent 自身的 chatId（虽然子 Agent 不会再 spawn 子 Agent，但保持字段一致）
    isSubAgent: true, // 禁用 spawn_agent 工具 + 不注入子 Agent 使用指导，防止嵌套派发
    maxSteps: MAX_SUB_AGENT_STEPS, // 子 Agent 独立步数预算：复杂调研比主 Agent 需要更多步数才能收尾
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
    summary = extractFinalSummary(subChat.messages.value, subChat.hitMaxSteps.value, subChat.reachedMaxSteps.value)
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

/**
 * 读取单个子 Agent 的完整消息内容（供 UI 展示子 Agent 执行过程）。
 */
export const readSubAgentContent = async (chatId: string, subId: string): Promise<ChatMessage[] | undefined> => {
  const path = buildChatSubPath(chatId, subId)
  const content = await aiChatContentGet(path)
  return content?.messages
}

/**
 * 读取主 Agent 消息文件（供 UI 加载主聊天记录）。
 */
export const readMainContent = async (chatId: string): Promise<AiChatContent | undefined> => {
  return aiChatContentGet(buildChatMainPath(chatId))
}
