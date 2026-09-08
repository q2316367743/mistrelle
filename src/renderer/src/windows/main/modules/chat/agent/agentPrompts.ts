import type { Ref } from 'vue'
import type { AttachmentContent, ChatMessage, TodoItem } from '@/domain'
import type { AiImageBlock, AiMessageParam } from '@/windows/main/modules/ai'
import type { AiChatMode } from '@/entity'
import type { ResolvedChatRequestParams } from '@/windows/main/modules/chat'
import type { ChatType, ChatTypeToolContext } from '@/windows/main/modules/chat/chatType'
import { CHAT_TYPE_CONFIG, WRITING_SCENE_CONFIG } from '@/global/ChatTypeConfig'
import type { WritingScene } from '@/windows/main/modules/chat/writingScene'
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
  privacy: boolean
  mode: AiChatMode
  chatType: ChatType
  writingScene: WritingScene
  /** 设计风格提示词（design 创建后锁定，会话水合时注入；缺省空串不注入） */
  designStylePrompt: string
  /** 锚点修改模式的锚点节点 id 集合（空 = 非锚点模式） */
  anchorNodeIds: string[]
  sandboxDir: string
  workspace: string
  /** 场景上下文（类型提示词工厂按场景动态组装时使用） */
  typeTools: ChatTypeToolContext
  todos: Ref<TodoItem[]>
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
  /** 工作空间设定文件缓存（workspace 未变时复用） */
  settingsCache: WorkspaceSettingsCache | null
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
 * 聊天类型提示词（工厂按场景上下文动态组装）+ writing 子场景提示词拼接。
 * 类型与场景均在创建后锁定，组合稳定 → 进入稳定 system 前缀；design 提示词可随运行时设置
 * （是否配置生图模型）动态变化，与注入工具保持一致。
 */
const buildTypePromptBody = (ctx: PromptContext): string => {
  const base = CHAT_TYPE_CONFIG[ctx.chatType].prompt(ctx.typeTools)
  // 设计风格（design 创建后锁定）：附加在类型提示词之后
  if (ctx.chatType === 'design' && ctx.designStylePrompt) {
    return [base, ctx.designStylePrompt].filter(Boolean).join('\n\n')
  }
  if (ctx.chatType !== 'writing') return base
  const scenePrompt = WRITING_SCENE_CONFIG[ctx.writingScene].prompt
  return scenePrompt ? [base, scenePrompt].filter(Boolean).join('\n\n') : base
}

/**
 * 根据当前聊天模式生成一段"模式指令"，作为独立 system 消息追加到稳定 system 之后。
 * 不写入稳定 system 提示词，以保留其缓存前缀；参考 opencode 做法，让 AI 自行收敛行为：
 * - 1 计划模式：可读取 / 分析、可运行 shell（需审批），但严禁写入 / 修改文件，建议先给计划
 * - 0 默认 / 2 完全访问：无附加指令
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
 * 组装单次请求的完整 API 消息（稳定 system 前缀 + 动态独立 system 段 + 对话历史）。
 * 子 Agent / 隐私聊天的裁剪规则与原实现一致；skill 目录与工作空间设定缓存经返回值回传调用方。
 */
export const buildAgentRequestMessages = async (
  ctx: PromptContext,
  params: ResolvedChatRequestParams,
  assistantMessageId: string,
  settingsCache: WorkspaceSettingsCache | null
): Promise<BuiltRequestMessages> => {
  const agent = params.agentId ? useAiAgentStore().getById(params.agentId) : undefined
  const agentPrompt = agent ? buildAiAgentPrompt(agent) : ''
  // 被禁用的 skill 不注入目录（模型不可见即不会调用 load_skill），SkillLocal 管理页仍可见全量
  const skillStore = useSettingSkillStore()
  const skills = (await localSkillList()).filter((e) => skillStore.isSkillEnabled(e))
  const catalogPrompt = buildSkillCatalogPrompt(skills)
  const workspacePrompt = buildWorkspacePromptBody(ctx.sandboxDir, ctx.workspace)
  const settings = await buildWorkspaceSettingsPromptBody(ctx.workspace, settingsCache)
  // 个性化设定（soul/*.md，用户手编、极少变化 → 稳定可缓存；子 Agent 任务作用域不注入）
  const personalizePrompt = ctx.isSubAgent ? '' : await buildPersonalizePrompt(ctx.chatType)
  // system 前缀保持稳定的可缓存内容；skill 正文由 load_skill 工具按需在对话中加载，不进 system
  const systemPrompt = [
    ctx.systemPrompt,
    agentPrompt,
    personalizePrompt,
    catalogPrompt,
    // 可选工具集合目录（静态可缓存）：配合 load_tool_collection 实现按需整组装载
    buildToolCatalogPrompt(),
    buildTodoPrompt(),
    workspacePrompt,
    settings.prompt,
    // 聊天类型固定提示词 + writing 子场景提示词（类型与场景创建后锁定 → 前缀稳定可缓存；子 Agent 只读，无需类型指导）
    buildTypePromptBody(ctx),
    // 记忆工具使用指导仅主 Agent 注入（record_memory 随默认工具注册，子 Agent 任务作用域不记全局记忆）；
    // 隐私聊天不注入（工具本身也已在函数表构建中过滤）
    ctx.isSubAgent || ctx.privacy ? '' : buildMemoryToolPrompt(),
    // 子 Agent 使用指导仅主 Agent 注入（子 Agent 的 spawn_agent 已被过滤，指导无意义且会诱导嵌套）
    ctx.isSubAgent ? '' : buildSubAgentGuidancePrompt()
  ]
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
    skillCatalogPrompt: catalogPrompt,
    settingsCache: settings.cache
  }
}
