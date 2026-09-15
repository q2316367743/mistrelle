import type { DesignScene } from '@/windows/main/modules/chat/designScene'
import type { WritingScene } from '@/windows/main/modules/chat/writingScene'

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
 * 聊天类型（家族，新建对话时选定，创建后锁定；存储于 chat 表 type 列）。
 * 家族是子场景的分组维度；场景的能力与 UI 定义见 chat/scenes 各叶子场景（SceneDefinition）。
 * - office：日常办公（默认）
 * - writing：写作（子场景 writingScene：article / novelShort）
 * - design：设计创意（子场景 designScene：canvas / html，创建时选定）
 * 卡片风格生成不走聊天类型：由内置专家「卡片风格创建助手」（builtin:card-style）承担。
 */
export type ChatType = 'office' | 'writing' | 'design'
