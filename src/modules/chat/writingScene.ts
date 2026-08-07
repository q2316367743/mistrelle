import type { Component } from 'vue'
import { FileMarkdownIcon } from 'tdesign-icons-vue-next'

/**
 * 写作子场景（writing 聊天类型内部分层，新建对话时选定，创建后锁定）：
 * - article：文章创作（项目管理：文章列表 / 状态 / 平台 / 配图，writing 类型默认且唯一场景）
 * 未来可扩展 novel（小说创作）等场景，只改 global/ChatTypeConfig 的配置表。
 */
export type WritingScene = 'article'

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
