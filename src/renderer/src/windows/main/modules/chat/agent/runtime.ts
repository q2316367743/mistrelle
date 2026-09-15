import type { Ref } from 'vue'
import type { AiMessageParam } from '@/windows/main/modules/ai'
import type { ChatMessage, ToolFunction } from '@/domain'
import type { AiChatMode } from '@/entity'
import type { ToolPolicyContext } from '@/windows/main/modules/tool/toolPolicy'
import type {
  ChatContext,
  ChatRequestParams,
  ChatStatus,
  ResolvedChatRequestParams
} from '../engine/ChatCommon'
import type { InteractiveBridge } from './interactive'
import type { ToolCall } from './agentTypes'

/**
 * Agent 引擎运行时契约：agentLoop / agentResume 等引擎内部模块只依赖本接口，
 * 不依赖 ToolChat 具体类。ToolChat 是当前的唯一实现（持有响应式状态 + 配置 +
 * 能力实现）；未来其他形态的宿主（如独立运行的 agent 进程）实现同一契约即可复用整条引擎。
 *
 * 成员按「实际被引擎模块读取的成员」收窄——门面上其余成员（closedToolSurface、
 * todos、allowedDirs 等）只经快照对象（ToolSurfaceContext / PromptContext /
 * ToolPolicyContext）进入引擎，不出现在本契约里。
 */
export interface AgentRuntime {
  // —— 响应式状态（引擎读写）——
  readonly messages: Ref<ChatMessage[]>
  readonly status: Ref<ChatStatus>
  /** 本条消息累计的工具调用（loop 入列、beginRequest 清空） */
  readonly toolCalls: Ref<ToolCall[]>
  /** ask / confirm 交互桥：执行器挂起决策、UI 卡片作答 */
  readonly interactive: InteractiveBridge
  /** 本条消息内已装载的工具集合 id（渐进式加载临时态：每轮请求开始清空） */
  readonly loadedCollections: Ref<string[]>
  /** 最近一轮是否因达到工具调用步数上限而结束 */
  readonly hitMaxSteps: Ref<boolean>
  /** 本轮是否触达过工具调用步数上限 */
  readonly reachedMaxSteps: Ref<boolean>
  /** 请求上下文（seq 抢占 + abort 信号 + 回调配置） */
  readonly ctx: ChatContext

  // —— 配置（引擎只读，宿主可写）——
  /** 聊天模式，0 默认 / 1 计划 / 2 完全访问：loop 按模式决定步数上限与工具过滤 */
  mode: AiChatMode
  /** 当前工作空间（resume 重建参数时读取） */
  workspace: string
  /** 是否为子 Agent（loop 触顶提示裁剪） */
  readonly isSubAgent: boolean
  /** 单轮 loop 最大工具迭代步数，缺省用 MAX_AGENT_STEPS */
  readonly maxSteps?: number
  /** 触顶步数后是否执行最后一次无工具收尾调用 */
  readonly finalizeOnMaxSteps: boolean
  /** 最近一次构建请求时的技能目录提示词（token 构成估算读取） */
  lastSkillCatalogPrompt: string

  // —— 能力（宿主实现，引擎调用）——
  /** 是否可发起新请求（空闲 / 已完结状态） */
  canStartRequest(): boolean
  /** 解析模型配置（provider:key → 请求参数） */
  resolveModel(params: ChatRequestParams): Promise<ResolvedChatRequestParams>
  /** 请求侧函数表（第①层基础 + 第②层已装载集合） */
  getFunctions(params: ChatRequestParams): ToolFunction[]
  /** 执行前洋葱解析（含跨 Loop 自动恢复） */
  resolveForExecution(names: string[], base: ToolFunction[]): ToolFunction[]
  /** 组装单次请求的完整 API 消息 */
  buildRequestMessages(
    params: ResolvedChatRequestParams,
    assistantMessageId: string
  ): Promise<AiMessageParam[]>
  /** 组装工具策略上下文（主循环与 resume 共用） */
  buildPolicyContext(signal?: AbortSignal): ToolPolicyContext
  /** 收口收割：非终态工具块统一定格 */
  sweepPendingToolCalls(assistantMessageId?: string): void
}
