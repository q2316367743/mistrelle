import type { Ref } from 'vue'
import type { AttachmentContent, ChatMessage, TodoItem } from '@/domain'
import type { AiImageBlock, AiMessageParam } from '@/windows/main/modules/ai'
import type { AiChatMode } from '@/entity'
import type { ResolvedChatRequestParams } from '@/windows/main/modules/chat'
import type { SceneContext, SceneDefinition } from '@/windows/main/modules/chat/scenes'
import { isSceneToolsOnlyAgent, type SubAgentType } from '@/windows/main/modules/subagent/types'
import { localSkillList, buildSkillCatalogPrompt } from '@/windows/main/modules/skill'
import { buildAiAgentPrompt } from '@/entity/ai'
import { buildMemoryPrompt, buildMemoryToolPrompt } from '@/windows/main/modules/memory'
import { buildPersonalizePrompt } from '@/windows/main/modules/personalize'
import { useAiAgentStore, useSettingSkillStore } from '@/windows/main/store'
import { buildToolCatalogPrompt } from '@/windows/main/modules/tool/components/collectionLoader'
import { toAgentRequestMessages } from './agentContext'
import { buildToolCallCompactPlan } from './agentContextCompact'
import { collectToolCallVisionBlocks, collectVisionBlocks } from './visionBlocks'
import { buildTodoPrompt } from './todo'

/**
 * 提示词构建所需的会话状态快照（ToolChat 持有配置，每次请求构建时快照传入）。
 * 稳定段（类型 / 场景 / 工作空间）与动态段（待办 / 消息）的依赖均在此显式声明。
 */
export interface PromptContext {
  messages: Ref<ChatMessage[]>
  systemPrompt: string
  isSubAgent: boolean
  /** 子 Agent 能力类型（「仅场景工具」型据此裁剪 skill 目录 / 工具集合目录 / todo 指导） */
  subAgentType?: SubAgentType
  /** 显式封闭工具面（design_draw 等内部 Agent）：与「仅场景工具」型同款提示词裁剪 */
  closedToolSurface?: boolean
  privacy: boolean
  mode: AiChatMode
  /** 当前场景定义（叶子场景：提示词工厂 / 剔除名单 / 个性化作用域） */
  scene: SceneDefinition
  /** 锚点修改模式的锚点节点 id 集合（空 = 非锚点模式） */
  anchorNodeIds: string[]
  sandboxDir: string
  workspace: string
  /** 场景上下文（提示词工厂按场景动态组装时使用，含设计风格提示词） */
  typeTools: SceneContext
  todos: Ref<TodoItem[]>
  /**
   * 工作空间设定文件缓存盒（可变）：调用方构建前放入实例持有的缓存，
   * workspaceSettings 贡献者原地回写新缓存，构建后由调用方存回实例
   */
  settingsCache: WorkspaceSettingsCache | null
}

/** 工作空间设定文件缓存（键为 workspace 路径，避免 agent 循环每轮重复读盘） */
export interface WorkspaceSettingsCache {
  path: string
  content: string
}

export interface BuiltRequestMessages {
  apiMessages: AiMessageParam[]
  /** 本轮 skill 目录提示词（调用方存为最近值，供完成时 token 构成估算） */
  skillCatalogPrompt: string
}

const buildWorkspacePromptBody = (sandboxDir: string, workspace: string): string => {
  const parts: string[] = ['## 文件系统']
  if (sandboxDir) {
    parts.push(`- 沙盒目录：${sandboxDir}/outputs/：你的产出文件（无工作空间时的默认输出位置）`)
  }
  if (workspace) {
    parts.push(`- 用户工作空间：${workspace}`)
    parts.push(`  最终交付物优先写入工作空间。`)
  } else {
    parts.push(`- 用户工作空间：（无）`)
  }
  parts.push(`用户消息中引用的文件路径为绝对路径，可直接读取。`)
  return parts.join('\n')
}

/**
 * 读取工作空间下的设定文件（AGENTS.md / CLAUDE.md）并组装为提示词段落。
 * 设定文件包含项目约束与开发约定，需在系统提示词中告知模型遵循；
 * 使用缓存避免 agent 循环中重复读取磁盘。
 */
const buildWorkspaceSettingsPromptBody = async (
  workspace: string,
  cache: WorkspaceSettingsCache | null
): Promise<{ prompt: string; cache: WorkspaceSettingsCache | null }> => {
  if (!workspace) return { prompt: '', cache }
  if (cache && cache.path === workspace) return { prompt: cache.content, cache }
  const settingFiles = ['AGENTS.md', 'CLAUDE.md']
  const sections: string[] = []
  for (const fileName of settingFiles) {
    const filePath = window.preload.path.join(workspace, fileName)
    if (!window.preload.fs.existsSync(filePath)) continue
    try {
      const content = await window.preload.fs.readTextFile(filePath)
      if (content.trim()) sections.push(`### ${fileName}\n\n${content.trim()}`)
    } catch {
      // 读取失败（权限/编码）不阻断对话，跳过该设定文件
      continue
    }
  }
  const prompt = sections.length
    ? `## 工作空间设定文件\n\n以下是工作空间（${workspace}）下的设定文件内容，请严格遵循其中的约束与开发约定：\n\n${sections.join('\n\n')}`
    : ''
  return { prompt, cache: { path: workspace, content: prompt } }
}

const buildReferenceContextBody = (
  messages: ChatMessage[],
  attachedImageUrls: Set<string> = new Set()
): string => {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUserMessage || lastUserMessage.role !== 'user') return ''
  const contents = lastUserMessage.content
  const attachments = contents
    .filter((content): content is AttachmentContent => content.type === 'attachment')
    .flatMap((content) => content.data)
  if (attachments.length === 0) return ''
  const parts = attachments.map((item) => {
    // 已转为图像块随请求发送的图片加标注，避免模型再用工具重复读取
    const attached =
      item.url !== undefined && attachedImageUrls.has(item.url) ? '（已作为图片附于本消息）' : ''
    return `## File: ${item.name ?? item.url}${attached}\n路径：${item.url}\n`
  })
  return `\n\n---\n以下是用户在输入框中引用的上下文，请结合这些内容回答：\n\n${parts.join('\n---\n')}`
}

/**
 * 子 Agent 使用指导：告知主 Agent 何时应派发子 Agent，避免其惯性自己读大量文件撑爆上下文。
 * 仅主 Agent 注入（子 Agent 不注入，且其 spawn_agent 工具已被过滤）。
 * 内容稳定，写入稳定 system 前缀不影响缓存命中。
 */
const buildSubAgentGuidancePrompt = (): string =>
  [
    '## 子 Agent 使用指导',
    '你可以通过 spawn_agent 工具将复杂调研任务派发给子 Agent。子 Agent 拥有独立的上下文窗口和步数预算，',
    '执行完毕后只返回最终摘要，中间过程不占用你的上下文，能显著节省你的 token 与步数。',
    '',
    '适合派发：',
    '- 需要读取 3 个以上文件或大规模代码搜索的任务',
    '- 独立子问题的调研（可与你的其他工作推进解耦）',
    '- 会产生大量中间结果但最终只需要结论的任务',
    '',
    '不适合派发：',
    '- 单文件快速查看、单步工具调用',
    '- 需要用户交互确认的任务（子 Agent 无法向用户提问）',
    '- 需要写入 / 修改文件的任务（子 Agent 仅只读，写入会被安全策略拦截）',
    '',
    '派发时 task 必须自包含（含文件路径、搜索关键词、明确目标），让子 Agent 能独立完成；',
    '收到摘要后基于摘要继续推进，无需重复读取子 Agent 已读过的文件。'
  ].join('\n')

/**
 * 根据当前聊天模式生成一段"模式指令"，作为独立 system 消息追加到稳定 system 之后。
 * 不写入稳定 system 提示词，以保留其缓存前缀；参考 opencode 做法，让 AI 自行收敛行为：
 * - 1 计划模式：可读取 / 分析、可运行 shell（需审批），但严禁写入 / 修改文件，建议先给计划
 * - 0 默认 / 2 完全访问 / 3 自动编辑：无附加指令
 */
const buildModeInstructionBody = (mode: AiChatMode): string => {
  if (mode === 1) {
    return '【计划模式】当前处于计划模式。你可以读取、分析文件，也可以运行 shell 命令（运行前会请求用户批准）。但你没有任何写入 / 修改文件的权限，禁止创建、编辑或删除任何文件。建议先给出清晰的执行计划，涉及写文件的操作请明确说明并交由用户在默认模式下执行。'
  }
  return ''
}

/** 将当前待办清单序列化为 system 消息，作为模型每轮请求可见的最新进度快照 */
const buildTodoStatePromptBody = (todos: TodoItem[]): string => {
  if (todos.length === 0) return ''
  const lines = todos.map((todo) => {
    const statusLabel = { pending: '待开始', in_progress: '进行中', completed: '已完成' }[
      todo.status
    ]
    return `- [${statusLabel}] ${todo.content}`
  })
  return `## 当前待办清单\n\n以下是你当前维护的待办清单，请据此推进任务；需要变更时调用 update_todo 工具全量替换：\n\n${lines.join('\n')}`
}

/** 锚点修改模式指令：告知模型只能修改用户选中的锚点元素（读全局、改局部） */
const buildAnchorInstructionBody = (anchorNodeIds: string[]): string => {
  if (anchorNodeIds.length === 0) return ''
  const list = anchorNodeIds.map((id) => `- ${id}`).join('\n')
  return [
    '【锚点修改模式】用户选定了以下元素作为修改锚点：',
    list,
    '',
    '约束：',
    '- 只能修改 / 移动 / 删除上述锚点元素（update / move / delete / image 的目标必须属于锚点）。',
    '- 锚点之外的所有元素必须保持完全不变（不能移动、不能改属性、不能删除）。',
    '- 允许 insert 新增元素，新增元素可挂到锚点元素内部或画布根节点。',
    '- 可读取整个画布（canvas_get_nodes / canvas_inspect / canvas_read）理解上下文。',
    '- 若用户需求涉及锚点之外的元素，先说明「该元素不在选中范围内」，不要擅自修改。'
  ].join('\n')
}

/**
 * 稳定 system 前缀的「贡献者」契约：skill / 专家 / 记忆 / 场景等正交注入统一为贡献者，
 * 每段自带门控（封闭工具面 / 隐私 / 子 Agent 判断收进各段内部），组装主体只负责顺序拼接。
 * 新增一种注入 = 在 STABLE_CONTRIBUTIONS 中追加一个贡献者。
 * 顺序即拼接顺序；空串段被过滤，不影响其余段（前缀可缓存的稳定性由各段自身保证）。
 */
interface PromptContribution {
  id: string
  segment: (ctx: PromptContext, params: ResolvedChatRequestParams) => string | Promise<string>
}

/** 封闭工具面（生图型子 Agent / design_draw 内部 Agent）：工具面已固定，目录类提示词只会诱导调用不存在的工具 */
const sealedSurfaceOf = (ctx: PromptContext): boolean =>
  !!ctx.closedToolSurface || isSceneToolsOnlyAgent(ctx.subAgentType)

const STABLE_CONTRIBUTIONS: PromptContribution[] = [
  // 构造器注入的基础提示词（主聊天为空；子 Agent / design_draw 内部 Agent 的专属提示词走这里）
  { id: 'base', segment: (ctx) => ctx.systemPrompt },
  {
    // 专家提示词（builtin / 用户自建 agent；其工具注入在 agentFunctions 的 agent.tools 解析）
    id: 'expert',
    segment: async (_ctx, params) => {
      const agent = params.agentId ? useAiAgentStore().getById(params.agentId) : undefined
      return agent ? buildAiAgentPrompt(agent) : ''
    }
  },
  {
    // 个性化设定（soul/*.md，用户手编、极少变化 → 稳定可缓存；子 Agent 任务作用域不注入）
    id: 'personalize',
    segment: (ctx) =>
      ctx.isSubAgent ? '' : buildPersonalizePrompt(ctx.scene.personalizeScope)
  },
  {
    // skill 目录（渐进式披露）：用户目录 skills 按启用过滤 + 当前场景内置 skill；
    // 正文由 load_skill 工具按需在对话中加载，不进 system。禁用的 skill 不注入目录（模型不可见即不会调用）
    id: 'skillCatalog',
    segment: async (ctx) => {
      if (sealedSurfaceOf(ctx)) return ''
      const skillStore = useSettingSkillStore()
      const skills = (await localSkillList()).filter((e) => skillStore.isSkillEnabled(e))
      return buildSkillCatalogPrompt(skills, ctx.scene.skills ?? [])
    }
  },
  {
    // 可选工具集合目录（静态可缓存）：配合 load_tool_collection 按需整组装载；
    // 场景剔除名单含装载器时不再声明目录，否则会在 system 里声明一份模型无法装载的目录，纯属诱导
    id: 'toolCatalog',
    segment: (ctx) =>
      sealedSurfaceOf(ctx) || (ctx.scene.excludedTools ?? []).includes('load_tool_collection')
        ? ''
        : buildToolCatalogPrompt()
  },
  { id: 'todoGuide', segment: (ctx) => (sealedSurfaceOf(ctx) ? '' : buildTodoPrompt()) },
  { id: 'workspace', segment: (ctx) => buildWorkspacePromptBody(ctx.sandboxDir, ctx.workspace) },
  {
    // 工作空间设定文件（AGENTS.md 等项目约定，带缓存）；封闭能力面下不注入
    id: 'workspaceSettings',
    segment: async (ctx) => {
      if (sealedSurfaceOf(ctx)) return ''
      const settings = await buildWorkspaceSettingsPromptBody(ctx.workspace, ctx.settingsCache)
      // 缓存盒原地回写：调用方（ToolChat）构建后存回实例，workspace 未变时下轮复用
      ctx.settingsCache = settings.cache
      return settings.prompt
    }
  },
  {
    // 场景提示词（叶子场景工厂已含家族通用约定 + 场景专属段 + 设计风格等，创建后锁定 → 前缀稳定可缓存）
    id: 'scene',
    segment: (ctx) => ctx.scene.prompt(ctx.typeTools)
  },
  {
    // 记忆工具使用指导仅主 Agent 注入（record_memory 随默认工具注册，子 Agent 任务作用域不记全局记忆）；
    // 隐私聊天不注入（工具本身也已在函数表构建中过滤）
    id: 'memoryTool',
    segment: (ctx) => (ctx.isSubAgent || ctx.privacy ? '' : buildMemoryToolPrompt())
  },
  {
    // 子 Agent 使用指导仅主 Agent 注入（子 Agent 的 spawn_agent 已被过滤，指导无意义且会诱导嵌套）
    id: 'subAgentGuide',
    segment: (ctx) => (ctx.isSubAgent ? '' : buildSubAgentGuidancePrompt())
  }
]

/**
 * 组装单次请求的完整 API 消息（稳定 system 前缀 + 动态独立 system 段 + 对话历史）。
 * 稳定前缀 = 贡献者管线按序拼接；工作空间设定缓存经 ctx.settingsCache 原地回传。
 */
export const buildAgentRequestMessages = async (
  ctx: PromptContext,
  params: ResolvedChatRequestParams,
  assistantMessageId: string
): Promise<BuiltRequestMessages> => {
  const segments = await Promise.all(
    STABLE_CONTRIBUTIONS.map(async (contribution) => ({
      id: contribution.id,
      prompt: await contribution.segment(ctx, params)
    }))
  )
  const systemPrompt = segments
    .map((segment) => segment.prompt)
    .filter(Boolean)
    .join('\n\n')
  const systemMessages: AiMessageParam[] = []
  if (systemPrompt) systemMessages.push({ role: 'system', content: systemPrompt })
  // 模式指令作为独立 system 消息追加（不污染稳定 system 提示词，保留缓存前缀）
  const modeInstruction = buildModeInstructionBody(ctx.mode)
  if (modeInstruction) systemMessages.push({ role: 'system', content: modeInstruction })
  // 锚点修改约束作为独立 system 消息注入（随选中动态变化，不进稳定前缀）
  const anchorInstruction = buildAnchorInstructionBody(ctx.anchorNodeIds)
  if (anchorInstruction) systemMessages.push({ role: 'system', content: anchorInstruction })
  // 当前待办状态同样作为独立 system 消息注入，让模型跨轮次感知进度而不依赖历史工具调用
  const todoStatePrompt = buildTodoStatePromptBody(ctx.todos.value)
  if (todoStatePrompt) systemMessages.push({ role: 'system', content: todoStatePrompt })
  // 记忆（长期 + 近期短期）作为独立 system 消息注入：内容按日变化，不污染稳定前缀；
  // 子 Agent 任务作用域隔离，不注入全局记忆。内部按 mtime 缓存，agent loop 每轮调用无额外读盘；
  // 隐私聊天不注入记忆
  if (!ctx.isSubAgent && !ctx.privacy) {
    const memoryPrompt = await buildMemoryPrompt()
    if (memoryPrompt) systemMessages.push({ role: 'system', content: memoryPrompt })
  }
  // 识图模型：把全部历史用户消息引用的图片重建为图像内容块（每次从磁盘路径读取，落库仍为路径引用）
  const vision = params.support?.includes('image')
    ? await collectVisionBlocks(ctx.messages.value)
    : undefined
  // 识图模型：重建历史 image_read 工具引用的图片（紧凑化已过期 / 已剔除的调用跳过读盘，
  // 用户附件已注入的同路径图片去重）
  let imagesByToolCallId: Map<string, AiImageBlock[]> | undefined
  if (vision) {
    const compact = buildToolCallCompactPlan(ctx.messages.value, assistantMessageId)
    imagesByToolCallId = await collectToolCallVisionBlocks(ctx.messages.value, {
      excludePaths: vision.attachedUrls,
      skipToolCallIds: new Set([...compact.expiredToolCallIds, ...compact.droppedToolCallIds])
    })
  }
  const messages = toAgentRequestMessages(
    ctx.messages.value,
    assistantMessageId,
    buildReferenceContextBody(ctx.messages.value, vision?.attachedUrls),
    vision?.blocksByMessageId,
    params.message.thinking !== false,
    imagesByToolCallId
  )
  return {
    apiMessages: [...systemMessages, ...messages],
    // skill 目录段回传供完成时 token 构成估算（lastSkillCatalogPrompt）
    skillCatalogPrompt: segments.find((s) => s.id === 'skillCatalog')?.prompt ?? ''
  }
}
