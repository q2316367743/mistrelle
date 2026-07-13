import { Solar } from 'lunar-javascript'

interface CalendarCalcResult {
  year: string
  month: string
  day: string
  hour: string
}

export const calendarCalc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): CalendarCalcResult => {
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
  const lunar = solar.getLunar()
  const eightChar = lunar.getEightChar()

  return {
    year: eightChar.getYear(),
    month: eightChar.getMonth(),
    day: eightChar.getDay(),
    hour: eightChar.getTime()
  }
}

export interface LocationTimeCalcParams {
  startTime: Date
  startLon: number
  startLat: number
  endLon: number
  endLat: number
}

export interface LocationTimeCalcResult {
  endTime: Date
  diffMinutes: number
}

export const calcLocationTime = (params: LocationTimeCalcParams): LocationTimeCalcResult => {
  const { startTime, startLon, endLon } = params
  const diffMinutes = (endLon - startLon) * 4

  const endTime = new Date(startTime.getTime() + diffMinutes * 60 * 1000)

  return { endTime, diffMinutes }
}
