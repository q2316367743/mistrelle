import { CommonSelect, ToolFunction, ToolRiskLevel } from '@/domain'
import { dateTools } from '@/modules/tool/components/date'
import {
  injectOsTools,
  injectClipboardTools,
  injectScreenTools,
  injectBrowserTools,
  injectFfmpegTools
} from '@/modules/tool/components/inject'
import { shellTools } from './components/native/shell'
import { fileTools } from './components/native/file'
import { fileParseTools } from './components/native/fileParse'
import { nativeHttpTools } from './components/native/http'
import { nativeBrowserAutomationTools } from './components/native/browserAutomation'
import { browserFetchTools } from './components/native/browserFetch'
import { skillTools } from './components/skill'
import { agentTools } from './components/agent'
import { askTool } from './components/ask'
import { spawnAgentTool } from './components/spawnAgent'
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
  { group: '系统信息', tools: injectOsTools },
  { group: '剪贴板', tools: injectClipboardTools },
  { group: '屏幕', tools: injectScreenTools },
  { group: '媒体工具', tools: [...injectFfmpegTools] },
  { group: '浏览器', tools: [...injectBrowserTools, ...nativeBrowserAutomationTools] },
  { group: '专家管理', tools: agentTools }
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
  ...objectify(injectOsTools, 'name'),
  ...objectify(injectClipboardTools, 'name'),
  ...objectify(injectScreenTools, 'name'),
  ...objectify(injectBrowserTools, 'name'),
  ...objectify(injectFfmpegTools, 'name'),
  ...objectify(nativeBrowserAutomationTools, 'name'),
  ...objectify(agentTools, 'name')
}

export const defaultTools: ToolFunction[] = [
  askTool,
  spawnAgentTool,
  ...shellTools,
  ...skillTools,
  ...fileTools,
  ...fileParseTools,
  ...nativeHttpTools,
  ...browserFetchTools
]

export {
  resolveToolPolicy,
  registerToolPolicy,
  isShellExecTool,
  type ToolPolicyContext,
  type ToolPolicy
} from './toolPolicy'
