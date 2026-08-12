import { BaseEntity } from '@/entity'

export type AiDiscussionMode =
  /** 每轮结束后自动进入下一轮 */
  | 'auto'
  /** 每轮结束后手动触发下一轮 */
  | 'manual'
  /** 指定轮数后自动结束 */
  | 'rounds_limit'

export type AiDiscussionOrderType =
  // 顺序
  | 'sequential'
  // 随机
  | 'random'
  // 并行
  | 'parallel'

export type AiDiscussionSummaryTrigger =
  // 每轮之后总结
  | 'after_each_round'
  // 所有轮之后总结
  | 'after_all_rounds'
  // 手动触发
  | 'manual'

/**
 * 每轮结束后的行为（记录级配置）
 */
export type AiDiscussionAfterRound =
  /** 自动进入下一轮 */
  | 'auto'
  /** 等待用户补充后再继续 */
  | 'wait_input'
  /** 自动总结并结束 */
  | 'summarize'

export type AiDiscussionSessionStatus = 'idle' | 'running' | 'stopped' | 'completed'

export type AiDiscussionMessageStatus = 'pending' | 'streaming' | 'complete' | 'stop' | 'error'

export const AiDiscussionModeOptions = [
  { label: '自动推进', value: 'auto' },
  { label: '手动推进', value: 'manual' },
  { label: '限制轮数', value: 'rounds_limit' }
]
export const AiDiscussionOrderTypeOptions = [
  { label: '顺序发言', value: 'sequential' },
  { label: '随机发言', value: 'random' },
  { label: '并行发言', value: 'parallel' }
]
export const AiDiscussionSummaryTriggerOptions = [
  { label: '每轮结束后', value: 'after_each_round' },
  { label: '所有轮结束后', value: 'after_all_rounds' },
  { label: '手动触发', value: 'manual' }
]

/**
 * AI 讨论组列表项
 */
export interface AiDiscussionItem extends BaseEntity {
  /**
   * 讨论组名称
   */
  name: string
  /**
   * 讨论组描述
   */
  description: string
  /**
   * 是否置顶
   */
  top: boolean
}


/**
 * AI 讨论组
 */
export interface AiDiscussion extends AiDiscussionItem {
  /**
   * Agent ID
   * @see AiAgent
   */
  roles: Array<string>
  // 新增字段
  mode: AiDiscussionMode
  /** 最大轮数（mode为RoundsLimit时有效） */
  maxRounds: number
  /** 当前进行到的轮次 */
  currentRound: number
  /** 每轮发言顺序：按角色index顺序 / 随机 / 并行 */
  orderType: AiDiscussionOrderType

  /**
   * 总结者角色
   * @see AiAgent
   */
  summaryRole?: string // 可选，专门的总结者
  // 总结触发条件
  summaryTrigger: AiDiscussionSummaryTrigger
}

export interface AiDiscussionForm {
  /**
   * 讨论组名称
   */
  name: string
  /**
   * 讨论组描述
   */
  description: string
  roles: Array<string>
  // 新增字段
  mode: AiDiscussionMode
  /** 最大轮数（mode为RoundsLimit时有效） */
  maxRounds: number
  /** 当前进行到的轮次 */
  currentRound: number
  /** 每轮发言顺序：按角色index顺序 / 随机 / 并行 */
  orderType: AiDiscussionOrderType

  // 总结者角色
  summaryRole?: string // 可选，专门的总结者
  // 总结触发条件
  summaryTrigger: AiDiscussionSummaryTrigger
}

export function buildAiDiscussionForm(): AiDiscussionForm {
  return {
    name: '',
    description: '',
    roles: [],
    mode: 'auto',
    maxRounds: 10,
    currentRound: 0,
    orderType: 'sequential',
    summaryRole: undefined,
    summaryTrigger: 'after_all_rounds'
  }
}

export interface AiDiscussionMessage {
  id: string
  type: 'user' | 'role' | 'summary'
  /** 用户发言时为 null，角色发言时对应角色 id */
  roleId?: string
  /** 发言内容 */
  content: string
  /** 发言时间 */
  timestamp: number
  /** 所属轮次 */
  round: number
  /** 角色流式输出状态 */
  status?: AiDiscussionMessageStatus
}

/**
 * 单次讨论会话的运行配置。
 * 创建讨论时从讨论组（AiDiscussion）的默认配置派生，之后可在讨论过程中随时调整，
 * 仅作用于当前会话，不影响讨论组的默认值。
 */
export interface AiDiscussionSessionConfig {
  /** 每轮结束后的行为 */
  afterRound: AiDiscussionAfterRound
  /** 总轮数上限，0 表示无限（直到手动停止） */
  maxRounds: number
  /** 发言顺序 */
  orderType: AiDiscussionOrderType
  /** 总结者角色，未配置则不总结 */
  summaryRole?: string
}

/**
 * 依据讨论组的默认配置派生一份会话配置。
 * 讨论组上的 mode / summaryTrigger 等字段在此映射为记录级的 afterRound 语义。
 */
export function buildDiscussionSessionConfig(discussion: AiDiscussion): AiDiscussionSessionConfig {
  const afterRound: AiDiscussionAfterRound =
    discussion.mode === 'manual'
      ? 'wait_input'
      : discussion.summaryTrigger === 'after_each_round'
        ? 'summarize'
        : 'auto'
  return {
    afterRound,
    maxRounds: discussion.mode === 'rounds_limit' ? discussion.maxRounds : 0,
    orderType: discussion.orderType,
    summaryRole: discussion.summaryRole
  }
}

/**
 * 讨论记录索引项。
 * 仅保存最基础的定位与展示信息（名称 + 时间），运行状态、轮数与配置都放在详情中，
 * 这样讨论进行时只需频繁改写详情文件，索引保持稳定。
 */
export interface AiDiscussionRecordItem extends BaseEntity {
  discussionId: string
  name: string
}

export interface AiDiscussionRecord extends BaseEntity {
  discussionId: string
  // 讨论记录名称，ai 自动总结
  name: string
  currentRound: number
  status: AiDiscussionSessionStatus
  /** 本次讨论的会话配置，创建时从讨论组默认值派生，可随时调整 */
  config: AiDiscussionSessionConfig
  messages: Array<AiDiscussionMessage>
}
