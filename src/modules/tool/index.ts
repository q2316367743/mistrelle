import { CommonSelect, ToolFunction } from '@/domain'
import { dateTools } from '@/modules/tool/components/date'
import { objectify } from '@/utils/lang/ObjUtil'

interface ToolOption {
  group: string
  children: Array<CommonSelect>
}

export const toolOptions: Array<ToolOption> = [
  {
    group: '日期工具',
    children: dateTools.map((e) => ({
      label: e.label,
      value: e.name
    }))
  }
]

export const tools: Array<ToolFunction> = [...dateTools]

export const toolMap: Record<string, ToolFunction> = {
  ...objectify(dateTools, 'name')
}
