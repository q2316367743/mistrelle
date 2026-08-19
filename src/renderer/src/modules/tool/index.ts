import { CommonSelect, ToolFunction, ToolRiskLevel } from '@/domain'
import { dateTools } from '@/modules/tool/components/date'
import {
  injectClipboardTools,
  injectBrowserTools,
  injectFfmpegTools
} from '@/modules/tool/components/inject'
import { shellTools } from './components/native/shell'
import { fileTools } from './components/native/file'
import { fileParseTools } from './components/native/fileParse'
import { nativeHttpTools } from './components/native/http'
import { nativeBrowserAutomationTools } from './components/native/browserAutomation'
import { browserFetchTools } from './components/native/browserFetch'
import { egoBrowserTools } from './components/native/egoBrowser'
import { getNativeSearchTools } from './components/native/search'
import { skillTools } from './components/skill'
import { agentTools } from './components/agent'
import { designStyleTools } from './components/design'
import { fontListTool } from './components/design/fontTools'
import { askTool } from './components/ask'
import { spawnAgentTool } from '@/modules/subagent/tool'
// 叶子导入（勿改用 @/modules/memory 桶）：避免经 memory/index 拉入 ChatService/store 全量图（@see docs/tool/07-tool-policy.md）
import { recordMemoryTool } from '@/modules/memory/memoryTool'
import { objectify } from '@/utils/lang'

interface ToolOption {
  group: string
  children: Array<CommonSelect & { risk?: ToolRiskLevel }>
}

export interface ToolGroup {
  group: string
  tools: ToolFunction[]
}

const toOptions = (tools: ToolFunction[]) =>
  tools.map((e) => ({ label: e.label, value: e.name, risk: e.risk }))

/**
 * 可选工具的分组单一数据源：
 * - UI 选择器（toolOptions）由此派生
 * - list_tools 工具据此向模型描述可选工具（含 description/risk）
 * internal 标记的内部工具会被过滤：不对外展示、不可分配，但仍注册在 toolMap 供声明它的 agent 调用
 * 新增分组只需改这里
 */
export const toolGroups: Array<ToolGroup> = [
  { group: '日期工具', tools: dateTools },
  { group: '剪贴板', tools: injectClipboardTools },
  { group: '媒体工具', tools: [...injectFfmpegTools] },
  { group: '浏览器', tools: [...injectBrowserTools, ...nativeBrowserAutomationTools] },
  { group: '专家管理', tools: agentTools },
  { group: '设计风格', tools: designStyleTools }
]
  .map((g) => ({ ...g, tools: g.tools.filter((t) => !t.internal) }))
  .filter((g) => g.tools.length > 0)

// 此处都是附加能力
export const toolOptions: Array<ToolOption> = toolGroups.map((e) => ({
  group: e.group,
  children: toOptions(e.tools)
}))

export const toolMap: Record<string, ToolFunction> = {
  ...objectify(dateTools, 'name'),
  ...objectify(injectClipboardTools, 'name'),
  ...objectify(injectBrowserTools, 'name'),
  ...objectify(injectFfmpegTools, 'name'),
  ...objectify(nativeBrowserAutomationTools, 'name'),
  ...objectify(agentTools, 'name'),
  ...objectify(designStyleTools, 'name'),
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
    ...egoBrowserTools,
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
