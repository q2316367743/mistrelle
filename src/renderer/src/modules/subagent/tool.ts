import type { ToolFunction } from '@/domain'
import type { SubAgentType } from './types'

/** spawn_agent 工具名（多处依赖此常量判断工具身份） */
export const SPAWN_AGENT_TOOL_NAME = 'spawn_agent'

/** 各能力类型的说明（用于工具 description，模型据此理解 type 参数） */
const SUB_AGENT_TYPE_DESC: Record<SubAgentType, string> = {
  research: '调研型：只读调研 / 分析（搜索文件、对比方案），返回结构化摘要',
  design: '设计型：用画布创作配图 / 设计稿，导出 PNG 并返回保存路径'
}

/**
 * 创建 spawn_agent 工具实例。
 * 按当前聊天类型裁剪允许的 type 枚举，模型少试错；参数非法时由引擎拦截处再兜底校验。
 * 实际执行在 runSingleTool 中被特殊拦截处理（handler 不被调用）。
 */
export const createSpawnAgentTool = (
  allowedTypes: ReadonlyArray<SubAgentType>
): ToolFunction => {
  const typeList = allowedTypes.map((t) => `${t}：${SUB_AGENT_TYPE_DESC[t]}`).join('；')
  return {
    name: SPAWN_AGENT_TOOL_NAME,
    label: '启动子 Agent',
    description: [
      '启动一个子 Agent 执行独立任务（独立上下文与步数预算），执行完毕后只返回最终摘要，中间过程不占用当前上下文。',
      `可用子 Agent 类型：${typeList}。`,
      '子 Agent 的消息独立持久化，可在聊天记录中查看其完整执行过程。'
    ].join(''),
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description:
            '委托给子 Agent 的任务描述。应当足够清晰完整，包含所需上下文（文件路径、设计尺寸、产物保存路径等），让子 Agent 能独立完成。'
        },
        type: {
          type: 'string',
          description: `子 Agent 类型。可选：${allowedTypes.join(' / ')}；缺省 research。`
        }
      },
      required: ['task']
    },
    risk: 'safe',
    handler: async () => {
      return { error: 'spawn_agent 应由引擎拦截处理，不应直接调用 handler' }
    }
  }
}

/** 默认（全类型）实例：供 defaultTools 展示 / 兜底；AgentChat 运行期会按聊天类型裁剪替换 */
export const spawnAgentTool: ToolFunction = createSpawnAgentTool(['research', 'design'])
