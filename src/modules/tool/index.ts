import { ToolFunction } from '@/domain'
import { dateTools } from '@/modules/tool/components/date'
import { objectify } from '@/utils/lang/ObjUtil'

export const toolMap: Record<string, ToolFunction> = {
  ...objectify(dateTools, 'name')
}
