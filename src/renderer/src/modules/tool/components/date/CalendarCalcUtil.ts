import { Solar, Lunar } from 'lunar-javascript'

const TIME_PERIOD_NAMES = [
  '子时 (23:00-00:59)',
  '丑时 (01:00-02:59)',
  '寅时 (03:00-04:59)',
  '卯时 (05:00-06:59)',
  '辰时 (07:00-08:59)',
  '巳时 (09:00-10:59)',
  '午时 (11:00-12:59)',
  '未时 (13:00-14:59)',
  '申时 (15:00-16:59)',
  '酉时 (17:00-18:59)',
  '戌时 (19:00-20:59)',
  '亥时 (21:00-22:59)'
]

function getSolar(year: number, month: number, day: number, hour = 12, minute = 0) {
  return Solar.fromYmdHms(year, month, day, hour, minute, 0)
}

function getLunar(year: number, month: number, day: number, hour = 12, minute = 0) {
  return getSolar(year, month, day, hour, minute).getLunar()
}

export interface SolarToLunarResult {
  solarDate: string
  lunarYear: string
  lunarMonth: string
  lunarDay: string
  lunarYearGanZhi: string
  lunarMonthGanZhi: string
  lunarDayGanZhi: string
  shengXiao: string
  isLeap: boolean
}

export const solarToLunar = (
  year: number,
  month: number,
  day: number
): SolarToLunarResult => {
  const lunar = getLunar(year, month, day)
  return {
    solarDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    lunarYear: lunar.getYearInChinese(),
    lunarMonth: lunar.getMonthInChinese(),
    lunarDay: lunar.getDayInChinese(),
    lunarYearGanZhi: lunar.getYearInGanZhi(),
    lunarMonthGanZhi: lunar.getMonthInGanZhi(),
    lunarDayGanZhi: lunar.getDayInGanZhi(),
    shengXiao: lunar.getYearShengXiao(),
    isLeap: lunar.getDay() === lunar.getDay() && lunar.getMonth() !== 0
  }
}

export interface LunarToSolarResult {
  solarDate: string
  lunarYear: string
  lunarMonth: string
  lunarDay: string
  lunarYearGanZhi: string
  shengXiao: string
  weekInChinese: string
}

export const lunarToSolar = (
  year: number,
  month: number,
  day: number,
  isLeap = false
): LunarToSolarResult | null => {
  try {
    const lunar = Lunar.fromYmd(year, isLeap ? -month : month, day)
    const solar = lunar.getSolar()
    return {
      solarDate: solar.toYmd(),
      lunarYear: lunar.getYearInChinese(),
      lunarMonth: lunar.getMonthInChinese(),
      lunarDay: lunar.getDayInChinese(),
      lunarYearGanZhi: lunar.getYearInGanZhi(),
      shengXiao: lunar.getYearShengXiao(),
      weekInChinese: solar.getWeekInChinese()
    }
  } catch {
    return null
  }
}

export interface DailyCalendarResult {
  solarDate: string
  weekInChinese: string
  lunarYear: string
  lunarMonth: string
  lunarDay: string
  lunarYearGanZhi: string
  lunarMonthGanZhi: string
  lunarDayGanZhi: string
  shengXiao: string
  xingZuo: string
  season: string
  jieQi: string | null
  festivals: string[]
  otherFestivals: string[]
  dayYi: string[]
  dayJi: string[]
  dayJiShen: string[]
  dayXiongSha: string[]
  dayChong: string
  dayChongShengXiao: string
  daySha: string
  dayChongDesc: string
  pengZuGan: string
  pengZuZhi: string
  xiu: string
  xiuLuck: string
  yueXiang: string
  zhiXing: string
  dayLu: string
  dayTianShen: string
  dayTianShenType: string
  dayTianShenLuck: string
}

export const getDailyCalendar = (
  year: number,
  month: number,
  day: number
): DailyCalendarResult => {
  const solar = getSolar(year, month, day)
  const lunar = solar.getLunar()
  return {
    solarDate: solar.toYmd(),
    weekInChinese: solar.getWeekInChinese(),
    lunarYear: lunar.getYearInChinese(),
    lunarMonth: lunar.getMonthInChinese(),
    lunarDay: lunar.getDayInChinese(),
    lunarYearGanZhi: lunar.getYearInGanZhi(),
    lunarMonthGanZhi: lunar.getMonthInGanZhi(),
    lunarDayGanZhi: lunar.getDayInGanZhi(),
    shengXiao: lunar.getYearShengXiao(),
    xingZuo: solar.getXingZuo(),
    season: lunar.getSeason(),
    jieQi: lunar.getCurrentJieQi(),
    festivals: lunar.getFestivals(),
    otherFestivals: lunar.getOtherFestivals(),
    dayYi: lunar.getDayYi(),
    dayJi: lunar.getDayJi(),
    dayJiShen: lunar.getDayJiShen(),
    dayXiongSha: lunar.getDayXiongSha(),
    dayChong: lunar.getDayChong(),
    dayChongShengXiao: lunar.getDayChongShengXiao(),
    daySha: lunar.getDaySha(),
    dayChongDesc: lunar.getDayChongDesc(),
    pengZuGan: lunar.getPengZuGan(),
    pengZuZhi: lunar.getPengZuZhi(),
    xiu: lunar.getXiu(),
    xiuLuck: lunar.getXiuLuck(),
    yueXiang: lunar.getYueXiang(),
    zhiXing: lunar.getZhiXing(),
    dayLu: lunar.getDayLu(),
    dayTianShen: lunar.getDayTianShen(),
    dayTianShenType: lunar.getDayTianShenType(),
    dayTianShenLuck: lunar.getDayTianShenLuck()
  }
}

export interface AuspiciousDirection {
  direction: string
  description: string
}

export interface AuspiciousDirectionsResult {
  xi: AuspiciousDirection
  fu: AuspiciousDirection
  cai: AuspiciousDirection
  yangGui: AuspiciousDirection
  yinGui: AuspiciousDirection
  taiSui: AuspiciousDirection
}

export const getAuspiciousDirections = (
  year: number,
  month: number,
  day: number
): AuspiciousDirectionsResult => {
  const lunar = getLunar(year, month, day)
  return {
    xi: { direction: lunar.getDayPositionXi(), description: lunar.getDayPositionXiDesc() },
    fu: { direction: lunar.getDayPositionFu(), description: lunar.getDayPositionFuDesc() },
    cai: { direction: lunar.getDayPositionCai(), description: lunar.getDayPositionCaiDesc() },
    yangGui: { direction: lunar.getDayPositionYangGui(), description: lunar.getDayPositionYangGuiDesc() },
    yinGui: { direction: lunar.getDayPositionYinGui(), description: lunar.getDayPositionYinGuiDesc() },
    taiSui: { direction: lunar.getDayPositionTaiSui(), description: lunar.getDayPositionTaiSuiDesc() }
  }
}

export interface TimePeriodDetail {
  index: number
  name: string
  ganZhi: string
  tianShen: string
  type: string
  luck: string
}

export interface TimeDetailsResult {
  currentTimeGanZhi: string
  timeYi: string[]
  timeJi: string[]
  timePeriods: TimePeriodDetail[]
}

export const getTimeDetails = (
  year: number,
  month: number,
  day: number
): TimeDetailsResult => {
  const solar = getSolar(year, month, day)
  const lunar = solar.getLunar()

  const timePeriods: TimePeriodDetail[] = []
  for (let i = 0; i < 12; i++) {
    const hour = (i * 2 + 23) % 24
    const l = getLunar(year, month, day, hour, 0)
    timePeriods.push({
      index: i,
      name: TIME_PERIOD_NAMES[i],
      ganZhi: l.getTimeInGanZhi(),
      tianShen: l.getTimeTianShen(),
      type: l.getTimeTianShenType(),
      luck: l.getTimeTianShenLuck()
    })
  }

  return {
    currentTimeGanZhi: lunar.getTimeInGanZhi(),
    timeYi: lunar.getTimeYi(),
    timeJi: lunar.getTimeJi(),
    timePeriods
  }
}

export interface BaziPillarDetail {
  ganZhi: string
  gan: string
  zhi: string
  hideGan: string[]
  wuXing: string
  naYin: string
  shiShenGan: string
  shiShenZhi: string[]
  diShi: string
  xun: string
  xunKong: string
}

export interface BaziDetailResult {
  yearPillar: string
  monthPillar: string
  dayPillar: string
  hourPillar: string
  year: BaziPillarDetail
  month: BaziPillarDetail
  day: BaziPillarDetail
  time: BaziPillarDetail
  taiYuan: string
  taiYuanNaYin: string
  taiXi: string
  taiXiNaYin: string
  mingGong: string
  mingGongNaYin: string
  shenGong: string
  shenGongNaYin: string
}

function buildPillarDetail(
  pillarGanZhi: string,
  getGan: () => string,
  getZhi: () => string,
  getHideGan: () => string[],
  getWuXing: () => string,
  getNaYin: () => string,
  getShiShenGan: () => string,
  getShiShenZhi: () => string[],
  getDiShi: () => string,
  getXun: () => string,
  getXunKong: () => string
): BaziPillarDetail {
  return {
    ganZhi: pillarGanZhi,
    gan: getGan(),
    zhi: getZhi(),
    hideGan: getHideGan(),
    wuXing: getWuXing(),
    naYin: getNaYin(),
    shiShenGan: getShiShenGan(),
    shiShenZhi: getShiShenZhi(),
    diShi: getDiShi(),
    xun: getXun(),
    xunKong: getXunKong()
  }
}

export const calculateBaziDetail = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): BaziDetailResult => {
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
  const lunar = solar.getLunar()
  const ec = lunar.getEightChar()

  return {
    yearPillar: ec.getYear(),
    monthPillar: ec.getMonth(),
    dayPillar: ec.getDay(),
    hourPillar: ec.getTime(),
    year: buildPillarDetail(
      ec.getYear(),
      () => ec.getYearGan(), () => ec.getYearZhi(), () => ec.getYearHideGan(),
      () => ec.getYearWuXing(), () => ec.getYearNaYin(), () => ec.getYearShiShenGan(), () => ec.getYearShiShenZhi(),
      () => ec.getYearDiShi(), () => ec.getYearXun(), () => ec.getYearXunKong()
    ),
    month: buildPillarDetail(
      ec.getMonth(),
      () => ec.getMonthGan(), () => ec.getMonthZhi(), () => ec.getMonthHideGan(),
      () => ec.getMonthWuXing(), () => ec.getMonthNaYin(), () => ec.getMonthShiShenGan(), () => ec.getMonthShiShenZhi(),
      () => ec.getMonthDiShi(), () => ec.getMonthXun(), () => ec.getMonthXunKong()
    ),
    day: buildPillarDetail(
      ec.getDay(),
      () => ec.getDayGan(), () => ec.getDayZhi(), () => ec.getDayHideGan(),
      () => ec.getDayWuXing(), () => ec.getDayNaYin(), () => ec.getDayShiShenGan(), () => ec.getDayShiShenZhi(),
      () => ec.getDayDiShi(), () => ec.getDayXun(), () => ec.getDayXunKong()
    ),
    time: buildPillarDetail(
      ec.getTime(),
      () => ec.getTimeGan(), () => ec.getTimeZhi(), () => ec.getTimeHideGan(),
      () => ec.getTimeWuXing(), () => ec.getTimeNaYin(), () => ec.getTimeShiShenGan(), () => ec.getTimeShiShenZhi(),
      () => ec.getTimeDiShi(), () => ec.getTimeXun(), () => ec.getTimeXunKong()
    ),
    taiYuan: ec.getTaiYuan(),
    taiYuanNaYin: ec.getTaiYuanNaYin(),
    taiXi: ec.getTaiXi(),
    taiXiNaYin: ec.getTaiXiNaYin(),
    mingGong: ec.getMingGong(),
    mingGongNaYin: ec.getMingGongNaYin(),
    shenGong: ec.getShenGong(),
    shenGongNaYin: ec.getShenGongNaYin()
  }
}

export interface DaYunItem {
  ganZhi: string
  index: number
  startAge: number
  endAge: number
  startYear: number
  endYear: number
  xun: string
  xunKong: string
}

export interface DaYunResult {
  gender: number
  startAge: number
  startMonth: number
  startDay: number
  startSolarDate: string
  forward: boolean
  daYun: DaYunItem[]
}

export const calculateDaYun = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  gender: number,
  sect = 1
): DaYunResult => {
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0)
  const lunar = solar.getLunar()
  const ec = lunar.getEightChar()
  const yun = ec.getYun(gender, sect)
  const daYunArr = yun.getDaYun()

  return {
    gender: yun.getGender(),
    startAge: yun.getStartYear(),
    startMonth: yun.getStartMonth(),
    startDay: yun.getStartDay(),
    startSolarDate: yun.getStartSolar().toYmd(),
    forward: yun.isForward(),
    daYun: daYunArr
      .filter((dy) => dy.getGanZhi())
      .map((dy) => ({
        ganZhi: dy.getGanZhi(),
        index: dy.getIndex(),
        startAge: dy.getStartAge(),
        endAge: dy.getEndAge(),
        startYear: dy.getStartYear(),
        endYear: dy.getEndYear(),
        xun: dy.getXun(),
        xunKong: dy.getXunKong()
      }))
  }
}

interface JieQiItem {
  name: string
  date: string
  type: string
}

function formatJieQi(obj: unknown): JieQiItem | null {
  if (!obj || typeof obj !== 'object') return null
  const item = obj as { getName: () => string; getSolar: () => { toYmd: () => string }; isJie: () => boolean; isQi: () => boolean }
  return {
    name: item.getName(),
    date: item.getSolar().toYmd(),
    type: item.isJie() ? '节' : item.isQi() ? '气' : ''
  }
}

export interface SolarTermsResult {
  currentJieQi: string | null
  currentJie: string | null
  currentQi: string | null
  prevJieQi: JieQiItem | null
  nextJieQi: JieQiItem | null
  prevJie: JieQiItem | null
  nextJie: JieQiItem | null
  prevQi: JieQiItem | null
  nextQi: JieQiItem | null
  jieQiTable: Record<string, string>
}

export const getSolarTerms = (
  year: number,
  month: number,
  day: number
): SolarTermsResult => {
  const lunar = getLunar(year, month, day)
  return {
    currentJieQi: lunar.getCurrentJieQi(),
    currentJie: lunar.getCurrentJie(),
    currentQi: lunar.getCurrentQi(),
    prevJieQi: formatJieQi(lunar.getPrevJieQi()),
    nextJieQi: formatJieQi(lunar.getNextJieQi()),
    prevJie: formatJieQi(lunar.getPrevJie()),
    nextJie: formatJieQi(lunar.getNextJie()),
    prevQi: formatJieQi(lunar.getPrevQi()),
    nextQi: formatJieQi(lunar.getNextQi()),
    jieQiTable: lunar.getJieQiTable()
  }
}

export interface ShuJiuAndFuResult {
  shuJiu: string | null
  fu: string | null
}

export const getShuJiuAndFu = (
  year: number,
  month: number,
  day: number
): ShuJiuAndFuResult => {
  const lunar = getLunar(year, month, day)
  return {
    shuJiu: lunar.getShuJiu(),
    fu: lunar.getFu()
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

export interface CalendarCalcResult {
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
