import type { Component } from 'vue'
import type { ChatMessage, TodoItem, ToolFunction } from '@/domain'
import type { PersonalizeScope } from '@/entity'
import type { ChatTypeToolContext } from '../chatType'
import type { DesignScene } from '../designScene'
import type { WritingScene } from '../writingScene'
import type { ChatStatus } from '../engine/ChatCommon'
import type { SubAgentType } from '@/windows/main/modules/subagent/types'
import type { SubAgentInfo } from '../agent/agentMessages'

/**
 * 场景（聊天类型）定义契约 —— agent 的「上层建筑」。
 * 一个场景 = 一段提示词 + 一组内置 skill（可选）+ 一组工具 + 一个侧边栏，四件套自包含：
 * 新增场景只需新建一个 SceneDefinition 并在 SCENES 注册，引擎与 UI 全部自动生效。
 *
 * 与存储的关系：聊天表 type 列（家族）+ content JSON 里的子场景字段（writingScene /
 * designScene）在创建后锁定，resolveScene 负责把存储字段解析到叶子场景定义。
 */
export interface SceneDefinition {
  /** ① 提示词工厂：放稳定 system 前缀（场景创建后锁定）。可依赖运行时设置动态组装，
   *  保证提示词提到的工具与 tools 实际注入的一致；设置不变时内容稳定、可缓存 */
  prompt: (ctx: SceneContext) => string
  /** ② 场景内置 skill（可选）：仅当前场景的 <available_skills> 目录可见，load_skill 可加载 */
  skills?: ReadonlyArray<BuiltInSkill>
  /** ③ 工具组：该场景注入的专属工具（design 系需 sandboxDir 闭包，故为工厂） */
  tools: (ctx: SceneContext) => ToolFunction[]
  /** ④ 侧边栏组件（聊天类型直接影响侧边栏形态） */
  aside?: Component
  /** 侧边栏 props 映射器：从统一状态包中挑选本场景组件需要的字段（防未声明 props 落 DOM 属性） */
  asideProps?: (ctx: SceneAsideContext) => Record<string, unknown>
  /** 本场景要剔除的常驻默认工具名（getDefaultTools / 渐进装载器 / 场景追加工具的子集）。
   *  由 agentFunctions 统一过滤，请求侧与执行期注册表兜底消费同一份，防止复装绕过 */
  excludedTools?: ReadonlyArray<string>
  /** 本场景允许派发的子 Agent 能力类型（spawn_agent 枚举下发与执行期校验共用） */
  subAgentAllow: ReadonlyArray<SubAgentType>
  /** 个性化设定（soul/*.md）作用域：该场景可见哪些专属段落；缺省只见 all 作用域段落 */
  personalizeScope?: Exclude<PersonalizeScope, 'all'>
  /** 沙盒内需预建的专属目录（相对沙盒根，如 outputs/articles）；通用 outputs/inputs/tmp 不在此列 */
  sandboxDirs?: () => string[]
  /** 会话页是否默认展开该场景侧边栏 */
  autoExpandAside?: boolean
}

/**
 * 场景内置 skill：随场景定义内联的「技能书」（等价一份 SKILL.md）。
 * content-only（无根目录），因此 skill 脚本免审批（cli_run 指向 skill 根目录）天然不适用；
 * 命名建议带场景前缀，避免与用户目录 skill 撞名（load_skill 解析链用户目录优先）。
 */
export interface BuiltInSkill {
  name: string
  description: string
  /** SKILL.md 正文（markdown），load_skill 时作为工具结果返回 */
  content: string
}

/**
 * 场景上下文：提示词 / 工具工厂的入参。基础字段（沙盒 / 工作空间 / 子场景 / 锚点）
 * 结构上等同 ChatTypeToolContext（工具模块按结构消费），扩展设计风格提示词供 design 场景拼接。
 */
export interface SceneContext extends ChatTypeToolContext {
  /** 设计风格提示词（design 场景创建后锁定，会话水合时注入；其他场景恒空串） */
  designStylePrompt: string
}

/** 聊天页传给侧边栏的统一状态包（LChatAside 组装，各场景 asideProps 映射器按需挑选） */
export interface SceneAsideContext {
  messages: ChatMessage[]
  workspace: string
  sandbox: string
  status: ChatStatus
  todos: TodoItem[]
  /** 子 Agent 历史列表（结构等同 AgentHistoryItem = SubAgentInfo & { current }） */
  agentHistory: Array<SubAgentInfo & { current: boolean }>
  activeAgentId: string
  fullscreen: boolean
  writingScene: WritingScene
  designScene: DesignScene
}
