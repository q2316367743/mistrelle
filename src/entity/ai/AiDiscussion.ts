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
  | 'manual';

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

export interface AiDiscussionRole {
  id: string
  /**
   * 角色名称
   */
  name: string
  /**
   * 角色描述
   */
  description: string
  /**
   * 角色提示
   */
  prompt: string
  /**
   * 角色索引
   */
  index: number
}

/**
 * AI 讨论组
 */
export interface AiDiscussion extends AiDiscussionItem {
  roles: Array<AiDiscussionRole>
  // 新增字段
  mode: AiDiscussionMode
  /** 最大轮数（mode为RoundsLimit时有效） */
  maxRounds: number
  /** 当前进行到的轮次 */
  currentRound: number
  /** 每轮发言顺序：按角色index顺序 / 随机 / 并行 */
  orderType: AiDiscussionOrderType

  // 总结者角色
  summaryRole?: AiDiscussionRole // 可选，专门的总结者
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
  roles: Array<AiDiscussionRole>
  // 新增字段
  mode: AiDiscussionMode
  /** 最大轮数（mode为RoundsLimit时有效） */
  maxRounds: number
  /** 当前进行到的轮次 */
  currentRound: number
  /** 每轮发言顺序：按角色index顺序 / 随机 / 并行 */
  orderType: AiDiscussionOrderType

  // 总结者角色
  summaryRole?: AiDiscussionRole // 可选，专门的总结者
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

export interface Message {
  id: string
  type: 'user' | 'role'
  /** 用户发言时为 null，角色发言时对应角色 id */
  roleId?: string
  /** 发言内容 */
  content: string
  /** 发言时间 */
  timestamp: number
  /** 所属轮次 */
  round: number
}

export interface AiDiscussionRecord extends BaseEntity {
  // 讨论记录名称，ai 自动总结
  name: string
  messages: Array<Message>
}
