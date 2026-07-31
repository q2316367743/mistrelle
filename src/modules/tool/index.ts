import { CommonSelect, ToolFunction } from '@/domain'
import { useAiToolStore } from '@/store'
import { dateTools } from '@/modules/tool/components/date'
import {
  injectOsTools,
  injectClipboardTools,
  injectNotificationTools,
  injectScreenTools,
  injectBrowserTools,
  injectFfmpegTools
} from '@/modules/tool/components/inject'
import { shellTools } from './components/native/shell'
import { fileTools } from './components/native/file'
import { fileParseTools } from './components/native/fileParse'
import { nativeHttpTools } from './components/native/http'
import { nativeBrowserAutomationTools } from './components/native/browserAutomation'
import { skillTools } from './components/skill'
import { agentTools } from './components/agent'
import { objectify } from '@/utils/lang'

interface ToolOption {
  group: string
  children: Array<CommonSelect>
}

export interface ToolGroup {
  group: string
  tools: ToolFunction[]
}

const toOptions = (tools: ToolFunction[]) => tools.map((e) => ({ label: e.label, value: e.name }))

/**
 * 可选工具的分组单一数据源：
 * - UI 选择器（toolOptions）由此派生
 * - list_tools 工具据此向模型描述可选工具（含 description/risk）
 * 新增分组只需改这里
 */
export const toolGroups: Array<ToolGroup> = [
  { group: '日期工具', tools: dateTools },
  { group: '系统信息', tools: injectOsTools },
  { group: '剪贴板', tools: injectClipboardTools },
  { group: '通知', tools: injectNotificationTools },
  { group: '屏幕', tools: injectScreenTools },
  { group: '浏览器', tools: [...injectBrowserTools, ...nativeBrowserAutomationTools] },
  { group: '专家管理', tools: agentTools }
]

// 此处都是附加能力
export const toolOptions: Array<ToolOption> = toolGroups.map((e) => ({
  group: e.group,
  children: toOptions(e.tools)
}))

export const tools: Array<ToolFunction> = [
  ...dateTools,
  ...injectOsTools,
  ...injectClipboardTools,
  ...injectNotificationTools,
  ...injectScreenTools,
  ...injectBrowserTools,
  ...injectFfmpegTools,
  ...nativeBrowserAutomationTools
]

export const toolMap: Record<string, ToolFunction> = {
  ...objectify(dateTools, 'name'),
  ...objectify(injectOsTools, 'name'),
  ...objectify(injectClipboardTools, 'name'),
  ...objectify(injectNotificationTools, 'name'),
  ...objectify(injectScreenTools, 'name'),
  ...objectify(injectBrowserTools, 'name'),
  ...objectify(injectFfmpegTools, 'name'),
  ...objectify(nativeBrowserAutomationTools, 'name'),
  ...objectify(agentTools, 'name')
}

export const defaultTools: ToolFunction[] = [
  ...shellTools,
  ...skillTools,
  ...fileTools,
  ...fileParseTools,
  ...nativeHttpTools
]

/** 获取所有已启用且已连接的 MCP 工具（运行时动态） */
export const getMcpTools = (): ToolFunction[] => useAiToolStore().getMcpTools()

export {
  resolveToolPolicy,
  registerToolPolicy,
  isShellExecTool,
  type ToolPolicyContext,
  type ToolPolicy
} from './toolPolicy'
