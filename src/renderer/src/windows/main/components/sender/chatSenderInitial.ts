import type { ThinkingEffort } from '@/domain'
import type { ChatType, DesignScene, WritingScene } from '@/windows/main/modules/chat'

/**
 * LChatSender 初始化参数：由父组件在挂载时一次性提供，
 * 之后仅在对象引用变化（异步水合 / 恢复上次会话配置）时整体应用。
 *
 * 注意：聊天模式（mode）不在此列——它是「随对话实时生效」的状态，走 `v-model:mode` 双向绑定
 * （聊天室由会话持有并实时落盘，新建页为组件内部状态），避免与 initial 形成两个事实源。
 */
export interface ChatSenderInitial {
  input?: string
  model?: string
  thinking?: boolean
  effort?: ThinkingEffort
  agentId?: string
  // 隐私聊天：不注入记忆、不注册记忆工具，会话不进入记忆提取
  privacy?: boolean
  type?: ChatType
  writingScene?: WritingScene
  // 设计子场景（design 类型的渲染引擎 canvas / html，创建后锁定；仅随首条消息透传）
  designScene?: DesignScene
  // 设计风格 id（design 类型创建后锁定；聊天室展示只读标签）
  designStyleId?: string
  workspace?: string
}
