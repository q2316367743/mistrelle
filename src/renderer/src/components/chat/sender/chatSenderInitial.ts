import type { ThinkingEffort } from '@/domain'
import { AiChatMode } from '@/entity'
import type { ChatType, WritingScene } from '@/windows/main/modules/chat'

/**
 * LChatSender 初始化参数：由父组件在挂载时一次性提供，
 * 之后仅在对象引用变化（异步水合 / 恢复上次会话配置）时整体应用。
 */
export interface ChatSenderInitial {
  input?: string
  model?: string
  thinking?: boolean
  effort?: ThinkingEffort
  agentId?: string
  mode?: AiChatMode
  // 隐私聊天：不注入记忆、不注册记忆工具，会话不进入记忆提取
  privacy?: boolean
  type?: ChatType
  writingScene?: WritingScene
  // 设计风格 id（design 类型创建后锁定；聊天室展示只读标签）
  designStyleId?: string
  workspace?: string
}
