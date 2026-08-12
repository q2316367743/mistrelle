// ==========================================
//  专家（Agent）管理工具：供内置「专家创建助手」通过 tool call 增 / 改 / 查专家
//  全部标记 internal：仅注册供该 agent 调用，不对外展示、不可分配给其他 agent
// ==========================================

import { ToolFunction, ToolProperty } from '@/domain'
import { AiAgent, AiAgentForm, buildAiAgentForm } from '@/entity/ai'
import { useAiAgentStore } from '@/store'
// 说明：与 @/modules/tool/index.ts 存在模块环依赖，但这些导出仅在 handler 运行时访问（模块均已加载完成），安全
import { toolMap, toolGroups, defaultTools } from '@/modules/tool'

/** create/update 共用的表单入参（不含 name 的必填约束，由各工具自行声明 required） */
const FORM_PROPERTIES: Record<string, ToolProperty> = {
  name: { type: 'string', description: '专家名称' },
  description: { type: 'string', description: '一句话描述该专家擅长的领域' },
  identity: { type: 'string', description: '身份：定义专家是谁、角色定位与能力边界' },
  personality: { type: 'string', description: '性格：语气风格与行为准则' },
  aboutMe: { type: 'string', description: '关于我：需要专家记住的用户信息' },
  tools: {
    type: 'array',
    description: '启用的工具名列表（必须是系统已注册的工具名，非法名称会被拒绝）',
    items: { type: 'string', description: '工具名' }
  },
  model: { type: 'string', description: '默认使用的模型 id，留空表示跟随全局' },
  placeholder: { type: 'string', description: '聊天输入框占位文案' },
  think: { type: 'boolean', description: '是否启用深度思考' },
  category: { type: 'string', description: '分类（可选值见 AI_AGENT_CATEGORIES）' }
}

/** 模型可能传入的表单字段（全部可选，具体必填由 parameters.required 声明） */
type AgentFormArgs = Partial<AiAgentForm>

/** 校验工具名合法性；返回非法名列表（空数组即全部合法） */
const validateTools = (tools?: string[]): string[] => {
  return (tools ?? []).filter((name) => !toolMap[name])
}

const invalidToolsError = (invalid: string[]) => ({
  error: `以下工具名未注册：${invalid.join('、')}。请先调用 list_tools 查询可选工具，只从其返回的工具名中选择。`
})

/** 从 AiAgent 实体中提取纯表单字段，避免 id/top 等状态字段混入 put */
const toForm = (agent: AiAgent): AiAgentForm => ({
  name: agent.name,
  description: agent.description,
  identity: agent.identity,
  personality: agent.personality,
  aboutMe: agent.aboutMe,
  tools: agent.tools,
  model: agent.model,
  placeholder: agent.placeholder,
  think: agent.think,
  category: agent.category
})

/** 专家概要信息（列表用，避免 identity 等长文本撑爆上下文） */
const toSummary = (agent: AiAgent) => ({
  id: agent.id,
  name: agent.name,
  description: agent.description,
  builtin: !!agent.builtin,
  tools: agent.tools,
  model: agent.model || '(跟随全局)',
  think: agent.think,
  category: agent.category
})

export const agentTools: ToolFunction[] = [
  {
    name: 'list_tools',
    label: '查询可选工具列表',
    description:
      '列出系统中全部可分配给专家的工具（按分组，含工具名、用途说明、风险级别），以及每次对话默认常驻、无需在 tools 中声明的基础工具。为专家挑选 tools 字段前必须先调用此工具，只能从返回的工具名中选择。',
    parameters: { type: 'object', properties: {} },
    risk: 'safe',
    internal: true,
    handler: async () => {
      return {
        // 可分配工具：专家 tools 字段的合法取值来源
        groups: toolGroups.map((g) => ({
          group: g.group,
          tools: g.tools.map((t) => ({
            name: t.name,
            label: t.label,
            description: t.description,
            risk: t.risk
          }))
        })),
        // 常驻工具：每次对话自动注入（shell/文件/http/skill 等），不要写进 tools 字段
        builtinDefaults: defaultTools.map((t) => ({ name: t.name, label: t.label })),
        note: '专家的 tools 字段只需填写 groups 中的工具名；builtinDefaults 为对话常驻工具，无需声明。'
      }
    }
  },
  {
    name: 'list_agents',
    label: '查询专家列表',
    description:
      '列出系统中全部 AI 专家（Agent）的概要信息（id、名称、描述、工具、是否内置）。创建新专家前可先查询，避免重复；修改专家前用于定位目标 id。',
    parameters: { type: 'object', properties: {} },
    risk: 'safe',
    internal: true,
    handler: async () => {
      return { agents: useAiAgentStore().all.map(toSummary) }
    }
  },
  {
    name: 'get_agent',
    label: '查询专家详情',
    description:
      '按 id 查询某个专家的完整配置（含身份、性格等全文）。修改专家前必须先调用此工具获取当前配置，再基于现状产出修改。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '专家 id（可通过 list_agents 获取）' }
      },
      required: ['id']
    },
    risk: 'safe',
    internal: true,
    handler: async (...params: unknown[]) => {
      const { id } = params[0] as { id: string }
      const agent = useAiAgentStore().getById(id)
      if (!agent) return { error: `未找到 id 为 "${id}" 的专家` }
      return { ...toForm(agent), id: agent.id, builtin: !!agent.builtin }
    }
  },
  {
    name: 'create_agent',
    label: '创建专家',
    description:
      '创建一个新的 AI 专家（Agent）并立即保存。需提供名称，其余字段可选；tools 必须是系统已注册的工具名。创建成功后返回新专家的 id。',
    parameters: {
      type: 'object',
      properties: FORM_PROPERTIES,
      required: ['name']
    },
    risk: 'sensitive',
    internal: true,
    handler: async (...params: unknown[]) => {
      const args = params[0] as AgentFormArgs
      const name = args.name?.trim()
      if (!name) return { error: '专家名称（name）不能为空' }
      const invalid = validateTools(args.tools)
      if (invalid.length > 0) return invalidToolsError(invalid)
      const form: AiAgentForm = { ...buildAiAgentForm(), ...args, name }
      const id = await useAiAgentStore().put(form)
      return { id, name, message: '专家创建成功，已出现在「专家」列表中' }
    }
  },
  {
    name: 'update_agent',
    label: '修改专家',
    description:
      '按 id 修改已有专家的配置并立即保存。仅需传入要变更的字段，未传字段保持原值；内置专家（builtin）只读，不可修改。建议先调用 get_agent 获取当前配置。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '要修改的专家 id（可通过 list_agents 获取）' },
        ...FORM_PROPERTIES
      },
      required: ['id']
    },
    risk: 'sensitive',
    internal: true,
    handler: async (...params: unknown[]) => {
      const { id, ...rest } = params[0] as { id: string } & AgentFormArgs
      const store = useAiAgentStore()
      const old = store.getById(id)
      if (!old) return { error: `未找到 id 为 "${id}" 的专家` }
      if (old.builtin) return { error: '内置专家只读，不允许修改' }
      const invalid = validateTools(rest.tools)
      if (invalid.length > 0) return invalidToolsError(invalid)
      // 仅覆盖显式传入的字段，undefined 不参与合并
      const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
      const form: AiAgentForm = { ...toForm(old), ...patch }
      if (!form.name.trim()) return { error: '专家名称（name）不能为空' }
      await store.put(form, id)
      return { id, name: form.name, message: '专家修改成功' }
    }
  }
]
