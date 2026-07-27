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
import { objectify } from '@/utils/lang'

interface ToolOption {
  group: string
  children: Array<CommonSelect>
}

const toOptions = (tools: ToolFunction[]) => tools.map((e) => ({ label: e.label, value: e.name }))

// 此处都是附加能力
export const toolOptions: Array<ToolOption> = [
  {
    group: '日期工具',
    children: toOptions(dateTools)
  },
  {
    group: '系统信息',
    children: toOptions(injectOsTools)
  },
  {
    group: '剪贴板',
    children: toOptions(injectClipboardTools)
  },
  {
    group: '通知',
    children: toOptions(injectNotificationTools)
  },
  {
    group: '屏幕',
    children: toOptions(injectScreenTools)
  },
  {
    group: '浏览器',
    children: toOptions([...injectBrowserTools, ...nativeBrowserAutomationTools])
  }
]

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
  ...objectify(nativeBrowserAutomationTools, 'name')
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
