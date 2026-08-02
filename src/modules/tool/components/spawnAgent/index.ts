import { ToolFunction } from '@/domain'

/**
 * spawn_agent 工具：主 Agent 通过调用此工具委托子 Agent 执行复杂调研任务。
 *
 * 子 Agent 拥有独立的上下文窗口和独立的步数预算（MAX_AGENT_STEPS），
 * 执行完毕后只返回最终摘要文本，中间过程不占用当前上下文。
 * 子 Agent 消息持久化到 message/sub_{subId}.json，可在聊天界面查看。
 *
 * 权限控制：子 Agent 使用 mode=0（默认模式）+ 禁用交互桥，
 * 由安全中心策略统一裁决——白名单内命令自动放行，
 * 需审批的操作因交互桥禁用而自动拒绝，无需硬编码工具限制。
 *
 * 实际执行逻辑在 SubAgentRunner.ts 中实现，此 handler 不被调用——
 * spawn_agent 在 runSingleTool 中被特殊拦截处理（与 ask 工具同理）。
 */
export const spawnAgentTool: ToolFunction = {
  name: 'spawn_agent',
  label: '启动子 Agent',
  description:
    '启动一个子 Agent 执行复杂调研任务（如：分析代码结构、搜索多个文件、对比方案）。子 Agent 拥有独立的上下文窗口和步数预算，执行完毕后只返回最终摘要，中间过程不占用当前上下文。子 Agent 的工具权限受安全中心策略控制——白名单内命令可用，需审批的操作自动拒绝。子 Agent 消息独立持久化，可在聊天记录中查看其完整执行过程。',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: '委托给子 Agent 的任务描述。应当足够清晰完整，包含所需上下文（文件路径、搜索关键词等），让子 Agent 能独立完成。'
      }
    },
    required: ['task']
  },
  risk: 'safe',
  handler: async () => {
    return { error: 'spawn_agent 应由引擎拦截处理，不应直接调用 handler' }
  }
}
