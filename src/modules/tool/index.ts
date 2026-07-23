import { CommonSelect, ToolFunction } from '@/domain'
import { dateTools } from '@/modules/tool/components/date'
import {
  injectOsTools,
  injectClipboardTools,
  injectNotificationTools,
  injectScreenTools,
  injectBrowserTools,
  injectFfmpegTools
} from '@/modules/tool/components/inject'
import { objectify } from '@/utils/lang'
import { nativeHttpTools } from '@/modules/tool/components/native/http'

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
    children: toOptions(injectBrowserTools)
  },
  {
    group: 'FFmpeg',
    children: toOptions(injectFfmpegTools)
  },
  {
    group: '网络工具',
    children: toOptions(nativeHttpTools)
  },
]

export const tools: Array<ToolFunction> = [
  ...dateTools,
  ...injectOsTools,
  ...injectClipboardTools,
  ...injectNotificationTools,
  ...injectScreenTools,
  ...injectBrowserTools,
  ...injectFfmpegTools,
  ...nativeHttpTools,
]

export const toolMap: Record<string, ToolFunction> = {
  ...objectify(dateTools, 'name'),
  ...objectify(injectOsTools, 'name'),
  ...objectify(injectClipboardTools, 'name'),
  ...objectify(injectNotificationTools, 'name'),
  ...objectify(injectScreenTools, 'name'),
  ...objectify(injectBrowserTools, 'name'),
  ...objectify(injectFfmpegTools, 'name'),
  ...objectify(nativeHttpTools, 'name'),
}

export * from './components/native/shell'
export * from './components/skill'
