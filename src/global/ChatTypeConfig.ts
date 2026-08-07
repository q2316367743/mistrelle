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
import type { ChatType, ChatTypeToolContext } from '@/modules/chat/chatType'
import type { WritingScene } from '@/modules/chat/writingScene'
import { ARTICLE_SCENE_PROMPT } from '@/modules/tool/components/article/articlePrompt'
import { createArticleTools } from '@/modules/tool/components/article/articleTools'
import { buildDesignCanvasPrompt } from '@/modules/canvas'
import { createCanvasTools } from '@/modules/tool/components/canvas/canvasTools'
import { createDesignTools } from '@/modules/tool/components/design'
import { useSettingDefaultStore } from '@/store/setting/SettingDefaultStore'

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
  /** 场景固定提示词（场景创建后锁定 → 可进稳定 system 前缀，不影响 prompt 缓存） */
  prompt: string
  /** 场景工具工厂（article → article_* 管理工具） */
  tools: (ctx: ChatTypeToolContext) => ToolFunction[]
}

/**
 * 写作子场景单一数据源（类 CHAT_TYPE_CONFIG 风格）。
 * 场景提示词场景内固定、创建后锁定，可安全进入稳定 system 前缀保证缓存命中。
 */
export const WRITING_SCENE_CONFIG: Record<WritingScene, WritingSceneConfig> = {
  article: {
    label: '文章创作',
    prompt: ARTICLE_SCENE_PROMPT,
    tools: (ctx) => createArticleTools(ctx)
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
    // 日常办公无额外场景指令，保持既有行为
    prompt: () => '',
    tools: () => []
  },
  writing: {
    label: '写作',
    // 写作通用约定（文章创作基底）；子场景专属提示词在 WRITING_SCENE_CONFIG 按场景维护
    prompt: () =>
      [
        '## 写作模式',
        '你是一名专业写作助手。你的文档产出统一写入用户工作空间（workspace）或沙盒 outputs/ 目录下的 .md 文件。',
        '约定：',
        '- 使用 file_write 创建 / 更新 .md 文档，路径建议放在 outputs/ 下，便于侧边栏文档树展示与预览',
        '- 每次写作完成后，告知用户文档的完整路径',
        '- 文档结构清晰：使用标题层级、列表、引用组织内容'
      ].join('\n'),
    tools: (ctx) => WRITING_SCENE_CONFIG[ctx.writingScene ?? 'article'].tools(ctx)
  },
  design: {
    label: '设计创意',
    // 与 createDesignTools 同源判断：仅配置默认生图模型时注入 image_generate 生图增强规则
    prompt: () =>
      buildDesignCanvasPrompt({
        hasImageGenerate: !!useSettingDefaultStore().state.defaultImageModel
      }),
    tools: (ctx) => [...createCanvasTools(ctx), ...createDesignTools(ctx)]
  }
}
