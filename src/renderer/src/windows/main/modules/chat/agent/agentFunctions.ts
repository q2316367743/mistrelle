import type { Ref } from 'vue'
import type { TodoItem, ToolContent, ToolFunction } from '@/domain'
import type { AiTool } from '@/windows/main/modules/ai'
import type { AiChatMode } from '@/entity'
import type { ChatRequestParams } from '@/windows/main/modules/chat'
import type { ChatType, ChatTypeToolContext } from '@/windows/main/modules/chat/chatType'
import { CHAT_TYPE_CONFIG, SUB_AGENT_TOOL_CONFIG } from '@/global/ChatTypeConfig'
import { getDefaultTools, isShellExecTool, toolMap, toolRegistry } from '@/windows/main/modules/tool'
import { IMAGE_READ_TOOL_NAME } from '@/windows/main/modules/tool/components/native/file'
import { createToolLoadTool } from '@/windows/main/modules/tool/components/collectionLoader'
import { recordMemoryTool } from '@/windows/main/modules/memory'
import { createSpawnAgentTool, SPAWN_AGENT_TOOL_NAME } from '@/windows/main/modules/subagent/tool'
import {
  isSceneToolsOnlyAgent,
  SUB_AGENT_ALLOW,
  type SubAgentType
} from '@/windows/main/modules/subagent/types'
import { useAiAgentStore, useSettingAiStore } from '@/windows/main/store'
import { createTodoTool } from './todo'

/**
 * 函数表构建所需的会话状态快照（ToolChat 持有配置，每次构建时快照传入，
 * 反映最新的聊天类型 / 模式 / 已装载集合等运行时状态）。
 */
export interface ToolSurfaceContext {
  /** 构造时注入的固定函数表（agent / 讨论引擎携带） */
  functions: ToolFunction[]
  isSubAgent: boolean
  privacy: boolean
  /** 当前聊天模式，0 默认 / 1 计划 / 2 完全访问 */
  mode: AiChatMode
  chatType: ChatType
  /** 子 Agent 能力场景（design 型注入画布工具）；主 Agent / research 型缺省 */
  sceneType?: ChatType
  /** 子 Agent 能力类型（「仅场景工具」型据此切换为封闭的专用工具集） */
  subAgentType?: SubAgentType
  /** 场景工具上下文（沙盒 / 工作空间 / 写作场景 / 锚点） */
  typeTools: ChatTypeToolContext
  todos: Ref<TodoItem[]>
  /** 本条消息内已装载的工具集合 id（渐进式加载临时态，不落库） */
  loadedCollections: Ref<string[]>
}

const getUserToolNames = (params: ChatRequestParams): string[] =>
  params.message.content
    .filter((content): content is ToolContent => content.type === 'tool')
    .map((content) => content.data.name)

/** 当前请求的模型是否具备识图能力（optionMap 查询与 ToolChat.resolveModel 同款键） */
const isVisionModelRequest = (params: ChatRequestParams): boolean => {
  const option = useSettingAiStore().optionMap.get(
    `${params.message.provide}:${params.message.model}`
  )
  return option?.support?.includes('image') ?? false
}

/** 按聊天类型 / 子 Agent 能力场景注入场景级工具（design → canvas_*；生图型子 Agent → 专用生图工具集） */
const getTypeTools = (ctx: ToolSurfaceContext): ToolFunction[] => {
  if (ctx.isSubAgent) {
    const dedicated = ctx.subAgentType ? SUB_AGENT_TOOL_CONFIG[ctx.subAgentType] : undefined
    if (dedicated) return dedicated(ctx.typeTools)
    return ctx.sceneType ? CHAT_TYPE_CONFIG[ctx.sceneType].tools(ctx.typeTools) : []
  }
  return CHAT_TYPE_CONFIG[ctx.chatType].tools(ctx.typeTools)
}

/**
 * 第①层基础函数表：常驻默认 + 类型场景 + 显式勾选 + todo + 装载器。
 * 含子 Agent / 隐私聊天 / spawn_agent 裁剪规则；不含渐进式集合工具（第②层负责）。
 *
 * 「仅场景工具」型子 Agent（生图型）走封闭分支：只暴露专用工具集，不并入默认常驻工具
 * （记忆 / todo / ask / shell / 文件 / skill / 装载器）与用户勾选——能力面越窄越可控。
 */
export const buildBaseFunctions = (
  ctx: ToolSurfaceContext,
  params: ChatRequestParams
): Map<string, ToolFunction> => {
  const map = new Map<string, ToolFunction>()
  if (isSceneToolsOnlyAgent(ctx.subAgentType)) {
    for (const fn of [...ctx.functions, ...getTypeTools(ctx)]) map.set(fn.name, fn)
    return map
  }
  const agent = params.agentId ? useAiAgentStore().getById(params.agentId) : undefined
  const names = [...(agent?.tools ?? []), ...getUserToolNames(params)]
  const selected = names.map((name) => toolMap[name]).filter((fn): fn is ToolFunction => !!fn)
  for (const fn of [
    // agent 带的工具
    ...ctx.functions,
    // 类型带的工具
    ...getTypeTools(ctx),
    // 用户主动选择的工具
    ...selected,
    // 默认工具（动态：如知乎 key 未配置则不含 zhihu_search）
    ...getDefaultTools(),
    // 待办工具
    createTodoTool(ctx.todos),
    // 渐进式工具加载：模型按 <available_tool_collections> 目录整组装载可选能力集（主/子 Agent 统一）
    createToolLoadTool(ctx.loadedCollections)
  ]) {
    // 子 Agent 不暴露 spawn_agent：防止嵌套派发（子 Agent 的 chatId 是自身 id，再派发路径会错乱）
    if (ctx.isSubAgent && fn.name === SPAWN_AGENT_TOOL_NAME) continue
    // 隐私聊天不暴露记忆工具（用户 # 显式指定也不注入，防止对话内容经工具写入记忆）
    if (ctx.privacy && fn.name === recordMemoryTool.name) continue
    // 非识图模型不下发 image_read（图像传了也看不见，避免诱导无效调用）
    if (fn.name === IMAGE_READ_TOOL_NAME && !isVisionModelRequest(params)) continue
    // 主 Agent：按聊天类型裁剪 spawn_agent 的可用子 Agent 类型（SUB_AGENT_ALLOW 能力矩阵），减少模型试错
    if (!ctx.isSubAgent && fn.name === SPAWN_AGENT_TOOL_NAME) {
      map.set(fn.name, createSpawnAgentTool(SUB_AGENT_ALLOW[ctx.chatType]))
      continue
    }
    map.set(fn.name, fn)
  }
  return map
}

/**
 * 第②层「已装载」：本条消息内已装载集合的工具整组并入（洋葱查找之已载入层）。
 * 显式选择过的名字不覆盖；请求侧 schema 下发与执行期解析共用。
 * 「仅场景工具」型子 Agent 不参与渐进式加载（无装载器工具，能力面封闭）。
 */
export const applyLoadedCollections = (
  ctx: ToolSurfaceContext,
  map: Map<string, ToolFunction>
): void => {
  if (isSceneToolsOnlyAgent(ctx.subAgentType)) return
  if (ctx.loadedCollections.value.length === 0) return
  const loaded = new Set(ctx.loadedCollections.value)
  for (const entry of Object.values(toolRegistry)) {
    if (!loaded.has(entry.groupId) || map.has(entry.fn.name)) continue
    map.set(entry.fn.name, entry.fn)
  }
}

/**
 * 请求侧函数表 = 第①层基础 + 第②层已装载。未装载的可选集合不下发 schema（保持轻量）；
 * 模型凭历史记忆调用未装载工具时由 resolveForExecution 在执行期兜底恢复。
 */
export const getToolFunctions = (
  ctx: ToolSurfaceContext,
  params: ChatRequestParams
): ToolFunction[] => {
  const map = buildBaseFunctions(ctx, params)
  applyLoadedCollections(ctx, map)
  return Array.from(map.values())
}

/**
 * 执行前洋葱解析：① 基础表 → ② 已装载集合 → ③ 全局注册表 toolRegistry 兜底。
 * 第③层命中即静默装载其所属集合并并入——跨 Loop 自动恢复的载体：
 * Loop 结束已装载状态被清空，模型凭历史记忆直呼工具名时由此自动复装并放行本次调用，
 * 后续轮次该组 schema 常驻。有装载发生时按计划模式过滤后返回新表，无变化原样返回 base。
 *
 * 「仅场景工具」型子 Agent（生图型）关闭第②③层：能力面以注入的专用工具集为限，
 * 模型凭历史记忆直呼未注入工具（如 file_write）时不予兜底恢复，直接返回"未找到工具"。
 */
export const resolveForExecution = (
  ctx: ToolSurfaceContext,
  names: string[],
  base: ToolFunction[]
): ToolFunction[] => {
  if (isSceneToolsOnlyAgent(ctx.subAgentType)) return base
  const map = new Map(base.map((fn) => [fn.name, fn]))
  applyLoadedCollections(ctx, map)
  let changed = false
  for (const name of names) {
    if (map.has(name)) continue
    const entry = toolRegistry[name]
    if (!entry) continue
    if (!ctx.loadedCollections.value.includes(entry.groupId)) {
      ctx.loadedCollections.value = [...ctx.loadedCollections.value, entry.groupId]
    }
    map.set(name, entry.fn)
    changed = true
  }
  return changed ? filterToolsByMode(ctx.mode, Array.from(map.values())) : base
}

export const buildAiTools = (functions: ToolFunction[]): AiTool[] =>
  functions.map((fn) => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters
    }
  }))

/**
 * 按当前聊天模式过滤暴露给模型的工具，作为模型层兜底：
 * - 1 计划模式：仅暴露只读 / 分析类（safe）与执行类（shell）工具，写入 / 修改类物理隐藏
 * - 0 默认 / 2 完全访问：原样返回
 */
export const filterToolsByMode = (mode: AiChatMode, functions: ToolFunction[]): ToolFunction[] => {
  if (mode === 1) {
    return functions.filter((fn) => fn.risk === 'safe' || isShellExecTool(fn))
  }
  return functions
}
