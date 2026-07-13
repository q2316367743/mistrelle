import { calendarCalc, calcLocationTime } from './CalendarCalcUtil'
import { ToolFunction } from '@/domain'

const BEIJING_LON = 120

export const dateTools: ToolFunction[] = [
  {
    name: 'calculate_bazi',
    description:
      '根据阳历（公历）出生年月日时计算八字（四柱），返回年柱、月柱、日柱、时柱的天干地支',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '阳历出生年份' },
        month: { type: 'number', description: '阳历出生月份（1-12）' },
        day: { type: 'number', description: '阳历出生日期（1-31）' },
        hour: { type: 'number', description: '阳历出生小时（0-23）' },
        minute: { type: 'number', description: '阳历出生分钟（0-59）' }
      },
      required: ['year', 'month', 'day', 'hour', 'minute']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, number>
      return calendarCalc(args.year, args.month, args.day, args.hour, args.minute)
    }
  },
  {
    name: 'calc_true_local_time',
    description:
      '根据出生时间和出生地经度，计算真太阳时（真地理时）。以北京时间（东经120°）为基准校正到出生地真太阳时',
    parameters: {
      type: 'object',
      properties: {
        birthTimeISO: {
          type: 'string',
          description: '出生时间的 ISO 字符串（如 1990-08-15T10:30:00）'
        },
        birthLon: {
          type: 'number',
          description: '出生地经度，东经为正，西经为负'
        },
        birthLat: {
          type: 'number',
          description: '出生地纬度，北纬为正，南纬为负'
        }
      },
      required: ['birthTimeISO', 'birthLon', 'birthLat']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, unknown>
      const birthTimeISO = args.birthTimeISO as string
      const birthLon = args.birthLon as number
      const birthLat = args.birthLat as number
      const startTime = new Date(birthTimeISO)
      const result = calcLocationTime({
        startTime,
        startLon: BEIJING_LON,
        startLat: 0,
        endLon: birthLon,
        endLat: birthLat
      })
      return {
        trueLocalTime: result.endTime.toISOString(),
        diffMinutes: result.diffMinutes,
        diffDescription: `出生地真太阳时相比北京时间 ${result.diffMinutes >= 0 ? '快' : '慢'} ${Math.abs(result.diffMinutes)} 分钟`
      }
    }
  }
]
