import { CommonSelect, ToolFunction, ToolRiskLevel } from '@/domain'
import { dateTools } from '@/windows/main/modules/tool/components/date'
import {
  injectClipboardTools,
  injectBrowserTools
} from '@/windows/main/modules/tool/components/inject'
import { shellTools } from './components/native/shell'
import { fileTools } from './components/native/file'
import { fileParseTools, fileWriteXlsxTool } from './components/native/fileParse'
import { nativeHttpTools } from './components/native/http'
import { nativeBrowserAutomationTools } from './components/native/browserAutomation'
import { browserFetchTools } from './components/native/browserFetch'
import { egoBrowserTools } from './components/native/egoBrowser'
import { getNativeSearchTools } from './components/native/search'
import { skillTools } from './components/skill'
import { agentTools } from './components/agent'
import { designStyleTools } from './components/design'
import { aihotTools } from './components/aihot'
import { fontListTool } from './components/design/fontTools'
import { askTool } from './components/ask'
import { spawnAgentTool } from '@/windows/main/modules/subagent/tool'
// 叶子导入（勿改用 @/modules/memory 桶）：避免经 memory/index 拉入 ChatService/store 全量图（@see docs/tool/07-tool-policy.md）
import { recordMemoryTool } from '@/windows/main/modules/memory/memoryTool'
import { objectify } from '@/utils/lang'

interface ToolOption {
  group: string
  children: Array<CommonSelect & { risk?: ToolRiskLevel }>
}

export interface ToolGroup {
  /** AI 装载用稳定标识（kebab）：load_tool_collection 按 id 整组装载 */
  id: string
  /** 给 AI 的能力描述：说明该组能做什么、什么任务场景需要它（进 <available_tool_collections> 目录） */
  description: string
  /** 人类显示名（UI 选择器分组标题），与 id 无关 */
  group: string
  tools: ToolFunction[]
}

const toOptions = (tools: ToolFunction[]) =>
  tools.map((e) => ({ label: e.label, value: e.name, risk: e.risk }))

/**
 * 可选工具的分组单一数据源：
 * - UI 选择器（toolOptions）由此派生
 * - 渐进式工具加载目录（<available_tool_collections>）与 load_tool_collection 由此派生
 * internal 标记的内部工具会被过滤：不对外展示、不可分配，但仍注册在 toolMap 供声明它的 agent 调用
 * 新增分组只需改这里
 */
export const toolGroups: Array<ToolGroup> = [
  {
    id: 'date',
    group: '日期工具',
    description:
      '传统历法与命理查询：公历农历互转、每日日历/黄历、节气与数九三伏、八字排盘与大运、吉神方位、真太阳时',
    tools: dateTools
  },
  {
    id: 'clipboard',
    group: '剪贴板',
    description: '读取或写入系统剪贴板内容',
    tools: injectClipboardTools
  },
  {
    id: 'browser',
    group: '浏览器',
    description:
      '在系统默认浏览器打开链接；browser_actions 驱动浏览器自动化网页操作；ego_browser 复用用户登录态运行 AI 浏览器脚本',
    tools: [...injectBrowserTools, ...nativeBrowserAutomationTools, ...egoBrowserTools]
  },
  {
    id: 'doc',
    group: '文档处理',
    description:
      '将数据生成 xlsx Excel 表格文件（含表头样式）；配套的 docx/xlsx/pdf 解析已在常驻工具中无需装载',
    tools: [fileWriteXlsxTool]
  },
  {
    id: 'expert',
    group: '专家管理',
    description: '专家的创建与管理工具，仅注册给内置「专家创建助手」，不出现在对话装载目录',
    tools: agentTools
  },
  {
    id: 'design-style',
    group: '设计风格',
    description:
      '设计风格库管理：查询全部风格清单与完整 tokens 明细（色彩/字体/间距/圆角/边框/阴影/动效），创建或修改风格',
    tools: designStyleTools
  },
  {
    id: 'aihot',
    group: 'AI 热点',
    description: 'AI 资讯聚合检索：精选推荐、公开资讯池、热门话题榜、AI 日报，四类只读数据源',
    tools: aihotTools
  }
]
  .map((g) => ({ ...g, tools: g.tools.filter((t) => !t.internal) }))
  .filter((g) => g.tools.length > 0)

export interface ToolRegistryEntry {
  fn: ToolFunction
  /** 归属集合 id：隐式命中时据此整组装载 */
  groupId: string
}

/**
 * 全局工具注册表（name → entry），基于过滤后的 toolGroups 构建。
 * 洋葱式解析的第③层兜底：内置常驻 → 本消息已装载 → 此处全局命中
 * （命中即静默装载其所在集合，实现跨 Loop 的自动恢复）。
 * internal 工具不入表，防止幻觉调用解锁 list_tools 等内部工具。
 */
export const toolRegistry: Record<string, ToolRegistryEntry> = Object.fromEntries(
  toolGroups.flatMap((g) => g.tools.map((t) => [t.name, { fn: t, groupId: g.id }]))
)

// 此处都是附加能力
export const toolOptions: Array<ToolOption> = toolGroups.map((e) => ({
  group: e.group,
  children: toOptions(e.tools)
}))

export const toolMap: Record<string, ToolFunction> = {
  ...objectify(dateTools, 'name'),
  ...objectify(injectClipboardTools, 'name'),
  ...objectify(injectBrowserTools, 'name'),
  ...objectify(nativeBrowserAutomationTools, 'name'),
  ...objectify(egoBrowserTools, 'name'),
  ...objectify([fileWriteXlsxTool], 'name'),
  ...objectify(agentTools, 'name'),
  ...objectify(designStyleTools, 'name'),
  ...objectify(aihotTools, 'name'),
  ...objectify([fontListTool], 'name')
}

/**
 * 对话常驻默认工具（动态组装）。
 * 调用方须在需要工具列表时调用本方法，勿缓存返回值——部分工具（如 zhihu_search）依赖账号配置。
 */
export function getDefaultTools(): ToolFunction[] {
  return [
    askTool,
    spawnAgentTool,
    recordMemoryTool,
    ...shellTools,
    ...skillTools,
    ...fileTools,
    ...fileParseTools,
    ...nativeHttpTools,
    ...browserFetchTools,
    ...getNativeSearchTools()
  ]
}

export {
  resolveToolPolicy,
  registerToolPolicy,
  isShellExecTool,
  type ToolPolicyContext,
  type ToolPolicy
} from './toolPolicy'
