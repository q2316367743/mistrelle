import { ToolFunction } from '@/domain'
import {
  solarToLunar,
  lunarToSolar,
  getDailyCalendar,
  getAuspiciousDirections,
  getTimeDetails,
  calculateBaziDetail,
  calculateDaYun,
  getSolarTerms,
  getShuJiuAndFu,
  calcLocationTime
} from './CalendarCalcUtil'

const BEIJING_LON = 120

export const dateTools: ToolFunction[] = [
  {
    name: 'solar_to_lunar',
    label: '公历转农历',
    description: '将阳历（公历）日期转换为农历（阴历）日期，返回农历年月日、干支、生肖等信息',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '公历年份' },
        month: { type: 'number', description: '公历月份（1-12）' },
        day: { type: 'number', description: '公历日期（1-31）' }
      },
      required: ['year', 'month', 'day']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, number>
      return solarToLunar(args.year, args.month, args.day)
    }
  },
  {
    name: 'lunar_to_solar',
    label: '农历转公历',
    description: '将农历（阴历）日期转换为阳历（公历）日期，支持闰月',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '农历年份' },
        month: { type: 'number', description: '农历月份（1-12）' },
        day: { type: 'number', description: '农历日期（1-30）' },
        isLeap: {
          type: 'boolean',
          description: '是否为闰月，默认 false'
        }
      },
      required: ['year', 'month', 'day']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, unknown>
      return lunarToSolar(
        args.year as number,
        args.month as number,
        args.day as number,
        (args.isLeap as boolean) || false
      )
    }
  },
  {
    name: 'get_daily_calendar',
    label: '每日黄历',
    description:
      '获取指定日期的老黄历详细信息，包括农历日期、干支、生肖、星座、节气、节日、宜忌、冲煞、彭祖百忌、星宿、月相、建除十二值星、日禄、日天神等',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '公历年份' },
        month: { type: 'number', description: '公历月份（1-12）' },
        day: { type: 'number', description: '公历日期（1-31）' }
      },
      required: ['year', 'month', 'day']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, number>
      return getDailyCalendar(args.year, args.month, args.day)
    }
  },
  {
    name: 'get_auspicious_directions',
    label: '吉神方位',
    description:
      '获取指定日期的吉神方位，包括喜神、福神、财神、阳贵神、阴贵神、太岁的方位及描述',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '公历年份' },
        month: { type: 'number', description: '公历月份（1-12）' },
        day: { type: 'number', description: '公历日期（1-31）' }
      },
      required: ['year', 'month', 'day']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, number>
      return getAuspiciousDirections(args.year, args.month, args.day)
    }
  },
  {
    name: 'get_time_details',
    label: '时辰详情',
    description:
      '获取指定日期的时辰详情，包括 12 个时辰（子丑寅卯辰巳午未申酉戌亥）的干支、天神（黄道/黑道）及吉凶',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '公历年份' },
        month: { type: 'number', description: '公历月份（1-12）' },
        day: { type: 'number', description: '公历日期（1-31）' }
      },
      required: ['year', 'month', 'day']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, number>
      return getTimeDetails(args.year, args.month, args.day)
    }
  },
  {
    name: 'calculate_bazi_detail',
    label: '八字详情',
    description:
      '根据阳历（公历）出生年月日时计算八字详细信息，包含年柱、月柱、日柱、时柱的干支、天干、地支、藏干、五行、纳音、十神、十二长生（地势）、旬空；以及胎元、命宫、身宫等信息',
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
      return calculateBaziDetail(args.year, args.month, args.day, args.hour, args.minute)
    }
  },
  {
    name: 'calculate_da_yun',
    label: '大运推算',
    description: '根据阳历（公历）出生年月日时、性别和起运流派推算大运，包含起运年龄、顺逆排、大运列表（每运干支及起止年份）',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '阳历出生年份' },
        month: { type: 'number', description: '阳历出生月份（1-12）' },
        day: { type: 'number', description: '阳历出生日期（1-31）' },
        hour: { type: 'number', description: '阳历出生小时（0-23）' },
        minute: { type: 'number', description: '阳历出生分钟（0-59）' },
        gender: { type: 'number', description: '性别，1 表示男，0 表示女' },
        sect: { type: 'number', description: '起运流派，1 表示按时辰折算，2 表示按分钟精确折算；默认 1' }
      },
      required: ['year', 'month', 'day', 'hour', 'minute', 'gender']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, number>
      return calculateDaYun(args.year, args.month, args.day, args.hour, args.minute, args.gender, args.sect)
    }
  },
  {
    name: 'get_solar_terms',
    label: '节气查询',
    description: '获取指定日期前后的二十四节气信息，包括当前节气、上一个/下一个节气（含节和气）及全年节气时间表',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '公历年份' },
        month: { type: 'number', description: '公历月份（1-12）' },
        day: { type: 'number', description: '公历日期（1-31）' }
      },
      required: ['year', 'month', 'day']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, number>
      return getSolarTerms(args.year, args.month, args.day)
    }
  },
  {
    name: 'get_shu_jiu_and_fu',
    label: '数九三伏',
    description: '获取指定日期的数九（冬九九）和三伏（夏九九）信息，判断当天是否在数九或三伏期间',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: '公历年份' },
        month: { type: 'number', description: '公历月份（1-12）' },
        day: { type: 'number', description: '公历日期（1-31）' }
      },
      required: ['year', 'month', 'day']
    },
    handler: async (...params: unknown[]) => {
      const args = params[0] as Record<string, number>
      return getShuJiuAndFu(args.year, args.month, args.day)
    }
  },
  {
    name: 'calc_true_local_time',
    label: '真太阳时计算',
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
