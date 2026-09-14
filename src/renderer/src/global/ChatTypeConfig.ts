/**
 * 聊天类型 / 写作子场景的组合配置（组合根）。
 *
 * 跨模块「类型 → 固定提示词 + 场景工具工厂」的单一注册点。原放 chatType.ts / writingScene.ts，
 * 会令 chat 模块运行时依赖 tool 模块（违反高内聚低耦合），故下沉到 global：
 * chat 模块只保留核心类型与 UI 选项，tool 工厂组合在这里一处维护，新增类型无需改动 AgentChat。
 *
 * 注意：类型 / 场景在创建后锁定，提示词可安全进入稳定 system 前缀，不影响 prompt 缓存。
 */
import type { ToolFunction } from '@/domain'
import type { ChatType, ChatTypeToolContext } from '@/windows/main/modules/chat/chatType'
import type { DesignScene } from '@/windows/main/modules/chat/designScene'
import type { WritingScene } from '@/windows/main/modules/chat/writingScene'
import { buildArticleScenePrompt } from '@/windows/main/modules/tool/components/article/articlePrompt'
import { createArticleTools } from '@/windows/main/modules/tool/components/article/articleTools'
import { NOVEL_SCENE_PROMPT } from '@/windows/main/modules/tool/components/novel/novelPrompt'
import { createNovelTools } from '@/windows/main/modules/tool/components/novel/novelTools'
import { buildDesignCanvasPrompt } from '@/windows/main/modules/canvas'
import { createCanvasTools } from '@/windows/main/modules/tool/components/canvas/canvasTools'
import { createDesignTools } from '@/windows/main/modules/tool/components/design'
import { buildDesignHtmlPrompt } from '@/windows/main/modules/designHtml'
import { createDesignHtmlTools } from '@/windows/main/modules/tool/components/designHtml/designHtmlTools'
import {
  createImageGenerateTool,
  hasImageGenerateAccess
} from '@/windows/main/modules/tool/components/design/imageGenerate'
import { createDesignDrawTool } from '@/windows/main/modules/tool/components/canvas/designDraw'
import { createHumanizeTool, hasHumanizeAccess } from '@/windows/main/modules/tool/components/design/humanize'
import { createImageSubAgentTools } from '@/windows/main/modules/tool/components/design/imageSubAgent'
import { SUB_AGENT_ALLOW, type SubAgentType } from '@/windows/main/modules/subagent/types'

export interface ChatTypeConfig {
  /** 具体名字，eg. 设计创意 */
  label: string
  /** 该类型提示词工厂：接收场景上下文返回提示词（放稳定 system 前缀）。
   *  类型创建后锁定，但内容可依赖运行时设置（如 design 是否配置生图模型）动态组装，
   *  保证提示词提到的工具与 tools 工厂实际注入的工具一致；设置不变时内容稳定、可缓存。 */
  prompt: (ctx: ChatTypeToolContext) => string
  /** 场景级工具工厂：返回该类型要注入的工具列表。
   *  design 需 sandboxDir 闭包，故为函数；所有类型工具在此一处维护，避免 getTypeTools 分支遗漏。 */
  tools: (ctx: ChatTypeToolContext) => ToolFunction[]
}

export interface WritingSceneConfig {
  /** 具体名字，eg. 文章创作 */
  label: string
  /**
   * 场景提示词工厂（场景创建后锁定 → 可进稳定 system 前缀，不影响 prompt 缓存）。
   * 为工厂而非静态串：部分段落需按运行时登录态动态组装（如文章场景的配图工作流，
   * 仅在生图型子 Agent 可用时给出），保证提示词提到的能力与实际工具一致。
   */
  prompt: (ctx: ChatTypeToolContext) => string
  /** 场景工具工厂（article → article_* 管理工具） */
  tools: (ctx: ChatTypeToolContext) => ToolFunction[]
  /**
   * 本场景要剔除的常驻默认工具名（getDefaultTools 的子集 / 渐进装载器 / 场景追加工具）。
   * 短篇小说场景据此收窄工具面：写作只用到 novel_*，file 类与 shell 反而是误导源
   * （模型有两个都能写文件的入口，且 shell 重定向可绕过 file 类的全部限制）。
   * 由 agentFunctions 统一过滤，同时作用于请求侧与执行期注册表兜底。
   */
  excludedTools?: ReadonlyArray<string>
  /**
   * 本场景允许派发的子 Agent 能力类型（覆盖 SUB_AGENT_ALLOW[chatType]）。
   * 短篇小说场景收窄为仅 research：封面 / 插图改由侧边栏直呼生图接口，
   * Agent 内不再提供生图通道，避免写作会话被图片类工具干扰。
   */
  subAgentAllow?: ReadonlyArray<SubAgentType>
}

/**
 * 写作子场景单一数据源（类 CHAT_TYPE_CONFIG 风格）。
 * 场景提示词场景内固定、创建后锁定，可安全进入稳定 system 前缀保证缓存命中。
 */
/**
 * 短篇小说场景剔除的常驻工具名（getDefaultTools / 渐进装载器 / 场景追加工具的子集）。
 * 用字面量而非导入工具数组：fileParse 会拉入 mammoth / xlsx / pdf-parse，
 * 导入会把重依赖带进 ChatTypeConfig 的模块图（agentFunctions / agentPrompts 都吃这份配置）。
 *
 * 为什么整族剔除：
 * - file_*：写作只用 novel_* 写入，file 类让模型有两个都能写文件的入口，显著拉低工具选择准确率
 * - cli_run：策略上可信区内免审批，重定向 / heredoc 可绕过 file 类的全部限制——只剔 file 类等于白做
 * - load_tool_collection：会给模型一份 date / clipboard / browser / doc 的可装载目录，全是写作无关噪音
 * - http_download / design_draw / image_read：小说为纯文本体裁，下载与图片类能力用不上
 */
const NOVEL_EXCLUDED_TOOLS: ReadonlyArray<string> = [
  'file_list',
  'file_read',
  'file_write',
  'file_delete',
  'file_mkdir',
  'file_stat',
  'file_glob',
  'file_grep',
  'file_read_docx',
  'file_read_xlsx',
  'file_read_pdf',
  'file_write_xlsx',
  'cli_run',
  'load_tool_collection',
  'http_download',
  'design_draw',
  'image_read'
]

export const WRITING_SCENE_CONFIG: Record<WritingScene, WritingSceneConfig> = {
  article: {
    label: '文章创作',
    prompt: () => buildArticleScenePrompt(),
    tools: (ctx) => createArticleTools(ctx)
  },
  novelShort: {
    label: '短篇小说',
    prompt: () => NOVEL_SCENE_PROMPT,
    // 场景工具 + 去 AI 味（登录后注入，与 design 场景同源）：小说是最需要去 AI 腔的体裁，
    // 但 humanize_text 只随 createDesignTools 注入，短篇场景需显式补上
    tools: (ctx) => [
      ...createNovelTools(ctx),
      ...(hasHumanizeAccess() ? [createHumanizeTool()] : [])
    ],
    excludedTools: NOVEL_EXCLUDED_TOOLS,
    // 封面 / 插图改由侧边栏直呼生图接口，写作会话内不再提供生图型子 Agent
    subAgentAllow: ['research']
  }
}

export interface DesignSceneConfig {
  /** 具体名字，eg. 画布引擎 */
  label: string
  /** 引擎固定提示词工厂（引擎创建后锁定 → 可进稳定 system 前缀，不影响 prompt 缓存） */
  prompt: (ctx: ChatTypeToolContext) => string
  /** 引擎场景工具工厂（canvas → canvas_* 画布工具；html → html_* 设计稿工具） */
  tools: (ctx: ChatTypeToolContext) => ToolFunction[]
}

/**
 * 场景工具剔除名单（按 chatType + writingScene 取；非写作类型恒为空）。
 * 供 agentFunctions 过滤请求侧函数表与执行期注册表兜底，两处必须同源。
 */
export const getSceneExcludedTools = (
  chatType: ChatType,
  writingScene?: WritingScene
): ReadonlyArray<string> => {
  if (chatType !== 'writing') return []
  return WRITING_SCENE_CONFIG[writingScene ?? 'article'].excludedTools ?? []
}

/**
 * 场景子 Agent 能力矩阵（场景配置优先，未配置回落到 SUB_AGENT_ALLOW[chatType]）。
 * spawn_agent 的 type 枚举下发表与执行期校验共用，避免两处口径漂移。
 */
export const getSceneSubAgentAllow = (
  chatType: ChatType,
  writingScene?: WritingScene
): ReadonlyArray<SubAgentType> => {
  if (chatType === 'writing' && writingScene) {
    const scene = WRITING_SCENE_CONFIG[writingScene].subAgentAllow
    if (scene) return scene
  }
  return SUB_AGENT_ALLOW[chatType]
}
/**
 * 子 Agent 能力类型 → 专用工具工厂（仅用于「仅场景工具」型子 Agent，见 isSceneToolsOnlyAgent）。
 * 未登记的能力类型走常规路径（主 Agent 工具面 + 场景工具 + 默认常驻工具）。
 * 生图型：image_generate + 图片处理，能力面完全封闭，不注入任何默认常驻工具。
 */
export const SUB_AGENT_TOOL_CONFIG: Partial<
  Record<SubAgentType, (ctx: ChatTypeToolContext) => ToolFunction[]>
> = {
  image: (ctx) => createImageSubAgentTools(ctx)
}

/**
 * 设计子场景（渲染引擎）单一数据源（类 WRITING_SCENE_CONFIG 风格）：
 * canvas = leafer 图层树画布；html = 自包含 HTML 设计稿（iframe 预览 + snapdom 导出）。
 * 两引擎提示词独立成文（canvasPrompt / designHtmlPrompt），设计素材工具共用。
 */
export const DESIGN_SCENE_CONFIG: Record<DesignScene, DesignSceneConfig> = {
  canvas: {
    label: '画布引擎',
    prompt: () =>
      buildDesignCanvasPrompt({
        hasImageGenerate: hasImageGenerateAccess(),
        hasHumanize: hasHumanizeAccess()
      }),
    tools: (ctx) => [...createCanvasTools(ctx), ...createDesignTools(ctx)]
  },
  html: {
    label: 'HTML 引擎',
    // 与 createDesignTools 同源判断：登录后注入 image_generate 生图增强规则 + humanize_text 去 AI 味规则
    prompt: () =>
      buildDesignHtmlPrompt({
        hasImageGenerate: hasImageGenerateAccess(),
        hasHumanize: hasHumanizeAccess()
      }),
    tools: (ctx) => [...createDesignHtmlTools(ctx), ...createDesignTools(ctx)]
  }
}

/**
 * 聊天类型单一数据源。
 * 同一类型的提示词固定、类型不变，因此类型提示词可安全进入稳定 system 前缀，
 * 保证 prompt 前缀稳定可缓存。
 */
export const CHAT_TYPE_CONFIG: Record<ChatType, ChatTypeConfig> = {
  office: {
    label: '日常办公',
    // 图片产出能力说明：design_draw（画布绘图，登录无关）恒在；image_generate（扩散生图，需登录）按登录态追加。
    // 门控动态组装，登录态稳定时前缀不变、可缓存
    prompt: () => {
      const lines = [
        '## 图片产出能力',
        '- 需要**精确排版 / 可控文案**的设计图（海报、封面、社交配图、知识卡片、图文排版）时，调用 design_draw(prompt, size?)——它以画布逐层绘制，画面干净、无明显 AI 感'
      ]
      if (hasImageGenerateAccess()) {
        lines.push('- 需要写实插画 / 照片质感的素材时，调用 image_generate(prompt)——扩散生图')
      }
      lines.push(
        '- 生成图片会直接展示在对话中；完成后简要说明结果并告知保存路径（path），失败如实告知，不反复重试'
      )
      return lines.join('\n')
    },
    tools: (ctx) =>
      hasImageGenerateAccess()
        ? [createImageGenerateTool(ctx), createDesignDrawTool()]
        : [createDesignDrawTool()]
  },
  writing: {
    label: '写作',
    // 写作通用约定：按子场景组装。文章场景产出为独立 md 文档并可用 design_draw 配图；
    // 小说场景一切写入走 novel_* 专用通道（file_write / design_draw 已从工具面剔除，
    // 提示词若仍提到它们会诱导模型调用不存在的工具）
    prompt: (ctx) => {
      if ((ctx.writingScene ?? 'article') === 'novelShort') {
        return [
          '## 写作模式',
          '你是一名专业写作助手，当前在短篇小说创作场景。',
          '约定：',
          '- 分步骤推进，每步完成一件明确的事，产出直接写入小说项目（由 novel_* 工具管理），不要自行拼装文件路径',
          '- 每次写作完成后，简要说明本次产出（改了哪个文件、字数变化）',
          '- 文档结构清晰：使用标题层级、列表组织内容'
        ].join('\n')
      }
      return [
        '## 写作模式',
        '你是一名专业写作助手。你的文档产出统一写入用户工作空间（workspace）或沙盒 outputs/ 目录下的 .md 文件。',
        '约定：',
        '- 使用 file_write 创建 / 更新 .md 文档，路径建议放在 outputs/ 下，便于侧边栏文档树展示与预览',
        '- 每次写作完成后，告知用户文档的完整路径',
        '- 文档结构清晰：使用标题层级、列表、引用组织内容',
        '- 需要**精确排版 / 可控文案**的设计图（封面、图文卡片、社交配图）时，可用 design_draw(prompt, size?) 直接在画布上绘制'
      ].join('\n')
    },
    tools: (ctx) => {
      const scene = WRITING_SCENE_CONFIG[ctx.writingScene ?? 'article']
      const tools = scene.tools(ctx)
      // 短篇场景不注入绘图工具（提示词同步不提，见上）
      return scene.excludedTools?.includes('design_draw') ? tools : [...tools, createDesignDrawTool()]
    }
  },
  design: {
    label: '设计创意',
    // 渲染引擎分层（canvas / html）：提示词与工具按 DESIGN_SCENE_CONFIG 委托；
    // 子 Agent 不派发 design 能力类型，ctx 无 designScene → 缺省 canvas
    prompt: (ctx) => DESIGN_SCENE_CONFIG[ctx.designScene ?? 'canvas'].prompt(ctx),
    tools: (ctx) => DESIGN_SCENE_CONFIG[ctx.designScene ?? 'canvas'].tools(ctx)
  }
}
