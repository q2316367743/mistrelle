import type { Component } from 'vue'
import { FileMarkdownIcon } from 'tdesign-icons-vue-next'
import type { ToolFunction } from '@/domain'
import type { ChatTypeToolContext } from '@/modules/chat/chatType'
import { createArticleTools } from '@/modules/tool/components/article/articleTools'
import { ARTICLE_SCENE_PROMPT } from '@/modules/tool/components/article/articlePrompt'

/**
 * 写作子场景（writing 聊天类型内部分层，新建对话时选定，创建后锁定）：
 * - article：文章创作（项目管理：文章列表 / 状态 / 平台 / 配图，writing 类型默认且唯一场景）
 * 未来可扩展 novel（小说创作）等场景，只改本配置表。
 */
export type WritingScene = 'article'

export interface WritingSceneConfig {
  /** 具体名字，eg. 文章创作 */
  label: string
  /** 场景固定提示词（场景创建后锁定 → 可进稳定 system 前缀，不影响 prompt 缓存） */
  prompt: string
  /** 场景工具工厂（article → article_* 管理工具） */
  tools: (ctx: ChatTypeToolContext) => ToolFunction[]
}

/** 写作子场景选项（供新建对话页等 UI 消费，单一数据源） */
export interface WritingSceneOption {
  value: WritingScene
  label: string
  description: string
  icon: Component
}

export const WRITING_SCENE_OPTIONS: WritingSceneOption[] = [
  {
    value: 'article',
    label: '文章创作',
    description: '自媒体文章项目管理，含配图（设计子 Agent）',
    icon: FileMarkdownIcon
  }
]

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
