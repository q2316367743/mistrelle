import type { Component } from 'vue'
import { WorkIcon, EditIcon, PaletteIcon } from 'tdesign-icons-vue-next'
import type { WritingScene } from '@/modules/chat/writingScene'
/**
 * 场景级工具工厂上下文：结构上等同 CanvasToolContext，但命名中性，与具体工具解耦。
 * 目前仅 canvas 工具需要 getSandboxDir；其余工具（如 context7）忽略该参数。
 */
export interface ChatTypeToolContext {
  getSandboxDir: () => string
  /** 用户工作空间（可能为空字符串）；文章项目等产物优先落此处 */
  getWorkspace: () => string
  /** writing 类型下的子场景（article），仅 writing 场景工具使用 */
  writingScene?: WritingScene
}

/**
 * 聊天类型（新建对话时选定，创建后锁定）：
 * - office：日常办公（默认，侧边栏：概览 / 工作空间 / 沙盒 / Agent 面板）
 * - writing：写作（文章创作侧边栏：文章列表 / 编辑器 / md 预览）
 * - design：设计创意（画布侧边栏：t-select 选择 .canvas + leafer 画布渲染）
 */
export type ChatType = 'office' | 'writing' | 'design'

/** 聊天类型选项（供新建对话页等 UI 消费，单一数据源） */
export interface ChatTypeOption {
  value: ChatType
  label: string
  description: string
  icon: Component
}

export const CHAT_TYPE_OPTIONS: ChatTypeOption[] = [
  { value: 'office', label: '日常办公', description: '文档、表格、任务管理，全能助手', icon: WorkIcon },
  { value: 'writing', label: '写作', description: '文档创作，侧边栏实时编辑与预览', icon: EditIcon },
  { value: 'design', label: '设计创意', description: 'Leafer 画布，AI 直接绘制设计稿', icon: PaletteIcon }
]
