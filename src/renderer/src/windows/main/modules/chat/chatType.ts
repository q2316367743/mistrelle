import { WorkIcon, EditIcon, PaletteIcon } from 'tdesign-icons-vue-next'
import type { WritingScene } from '@/windows/main/modules/chat/writingScene'
import type { DesignScene } from '@/windows/main/modules/chat/designScene'
import type { Component } from 'vue'
/**
 * 场景级工具工厂上下文：结构上等同 CanvasToolContext，但命名中性，与具体工具解耦。
 * 目前仅 canvas / designHtml 工具需要 getSandboxDir；其余工具（如 context7）忽略该参数。
 */
export interface ChatTypeToolContext {
  getSandboxDir: () => string
  /** 用户工作空间（可能为空字符串）；文章项目等产物优先落此处 */
  getWorkspace: () => string
  /** writing 类型下的子场景（article），仅 writing 场景工具使用 */
  writingScene?: WritingScene
  /** design 类型下的渲染引擎（canvas / html），仅 design 场景工具使用；子 Agent 缺省 canvas */
  designScene?: DesignScene
  /** 锚点修改模式的锚点节点 id 集合（空数组 = 非锚点模式，AI 可自由修改） */
  getAnchorNodeIds?: () => string[]
}

/**
 * 聊天类型（新建对话时选定，创建后锁定）：
 * - office：日常办公（默认，侧边栏：概览 / 工作空间 / 沙盒 / Agent 面板）
 * - writing：写作（文章创作侧边栏：文章列表 / 编辑器 / md 预览）
 * - design：设计创意（双引擎：canvas = leafer 画布侧边栏；html = HTML 设计稿预览侧边栏，创建时选定）
 * 卡片风格生成不走聊天类型：由内置专家「卡片风格创建助手」（builtin:card-style）承担。
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
  {
    value: 'writing',
    label: '写作',
    description: '文档创作，侧边栏实时编辑与预览',
    icon: EditIcon
  },
  {
    value: 'design',
    label: '设计创意',
    description: '画布 / HTML 双引擎，AI 直接绘制设计稿',
    icon: PaletteIcon
  },
  {
    value: 'office',
    label: '日常办公',
    description: '文档、表格、任务管理，全能助手',
    icon: WorkIcon
  }
]
