import type { ToolFunction } from '@/domain'
import type { ChatTypeToolContext } from '@/modules/chat/chatType'
import { createArticleTools } from '@/modules/tool/components/article/articleTools'
import { ARTICLE_SCENE_PROMPT } from '@/modules/tool/components/article/articlePrompt'

/**
 * 写作子场景（writing 聊天类型内部分层，新建对话时选定，创建后锁定）：
 * - free：自由写作（文档树 + 编辑器，现状行为）
 * - article：文章创作（项目管理：文章列表 / 状态 / 平台 / 配图）
 * 未来可扩展 novel（小说创作）等场景，只改本配置表。
 */
export type WritingScene = 'free' | 'article'

export const WRITING_SCENE_LABEL: Record<WritingScene, string> = {
  free: '自由写作',
  article: '文章创作'
}

export interface WritingSceneConfig {
  /** 具体名字，eg. 文章创作 */
  label: string
  /** 场景固定提示词（场景创建后锁定 → 可进稳定 system 前缀，不影响 prompt 缓存） */
  prompt: string
  /** 场景工具工厂（article → article_* 管理工具；free 无场景工具） */
  tools: (ctx: ChatTypeToolContext) => ToolFunction[]
}

/**
 * 写作子场景单一数据源（类 CHAT_TYPE_CONFIG 风格）。
 * 场景提示词场景内固定、创建后锁定，可安全进入稳定 system 前缀保证缓存命中。
 */
export const WRITING_SCENE_CONFIG: Record<WritingScene, WritingSceneConfig> = {
  free: {
    label: '自由写作',
    // 自由写作无额外场景指令，保持既有行为
    prompt: '',
    tools: () => []
  },
  article: {
    label: '文章创作',
    prompt: ARTICLE_SCENE_PROMPT,
    tools: (ctx) => createArticleTools(ctx)
  }
}
