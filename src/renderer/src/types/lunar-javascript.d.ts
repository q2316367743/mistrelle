declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number
    ): Solar
    static fromDate(date: Date): Solar
    static fromJulianDay(julianDay: number): Solar
    static fromBaZi(
      yearGanZhi: string,
      monthGanZhi: string,
      dayGanZhi: string,
      timeGanZhi: string
    ): Solar[]

    getYear(): number
    getMonth(): number
    getDay(): number
    getHour(): number
    getMinute(): number
    getSecond(): number
    getWeek(): number
    getWeekInChinese(): string
    getSolarWeek(): SolarWeek
    isLeapYear(): boolean
    getFestivals(): string[]
    getOtherFestivals(): string[]
    getXingZuo(): string
    getXingzuo(): string
    getJulianDay(): number
    getSalaryRate(): number
    toYmd(): string
    toYmdHms(): string
    toString(): string
    toFullString(): string
    getLunar(): Lunar
    nextYear(n?: number): Solar
    nextMonth(n?: number): Solar
    nextDay(n?: number): Solar
    nextHour(n?: number): Solar
    next(n: number): Solar
    nextWorkday(n?: number): Solar
    subtract(solar: Solar): number
    subtractMinute(solar: Solar): number
    isAfter(solar: Solar): boolean
    isBefore(solar: Solar): boolean
  }

  export class Lunar {
    static fromYmd(year: number, month: number, day: number): Lunar
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number
    ): Lunar
    static fromSolar(solar: Solar): Lunar
    static fromDate(date: Date): Lunar

    getYear(): number
    getMonth(): number
    getDay(): number
    getHour(): number
    getMinute(): number
    getSecond(): number
    getYearInChinese(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    getYearShengXiao(): string
    getMonthShengXiao(): string
    getDayShengXiao(): string
    getTimeShengXiao(): string
    getShengxiao(): string
    getYearInGanZhi(): string
    getYearInGanZhiByLiChun(): string
    getYearInGanZhiExact(): string
    getMonthInGanZhi(): string
    getMonthInGanZhiExact(): string
    getDayInGanZhi(): string
    getDayInGanZhiExact(): string
    getDayInGanZhiExact2(): string
    getTimeInGanZhi(): string
    getYearGan(): string
    getYearZhi(): string
    getMonthGan(): string
    getMonthZhi(): string
    getDayGan(): string
    getDayZhi(): string
    getTimeGan(): string
    getTimeZhi(): string
    getYearGanIndex(): number
    getYearZhiIndex(): number
    getMonthGanIndex(): number
    getMonthZhiIndex(): number
    getDayGanIndex(): number
    getDayZhiIndex(): number
    getTimeGanIndex(): number
    getTimeZhiIndex(): number
    getYearNaYin(): string
    getMonthNaYin(): string
    getDayNaYin(): string
    getTimeNaYin(): string
    getSeason(): string
    getWeek(): number
    getWeekInChinese(): string
    getXiu(): string
    getXiuLuck(): string
    getXiuSong(): string
    getZheng(): string
    getAnimal(): string
    getGong(): string
    getShou(): string
    getYueXiang(): string
    getJie(): string
    getQi(): string
    getJieQi(): string
    getCurrentJieQi(): string | null
    getCurrentJie(): string | null
    getCurrentQi(): string | null
    getJieQiTable(): Record<string, string>
    getJieQiList(): string[]
    getNextJie(): string | null
    getNextQi(): string | null
    getNextJieQi(): string | null
    getPrevJie(): string | null
    getPrevQi(): string | null
    getPrevJieQi(): string | null
    getFestivals(): string[]
    getOtherFestivals(): string[]
    getDayYi(): string[]
    getDayJi(): string[]
    getDayJiShen(): string[]
    getDayXiongSha(): string[]
    getTimeYi(): string[]
    getTimeJi(): string[]
    getDayChong(): string
    getDayChongGan(): string
    getDayChongGanTie(): string
    getDayChongShengXiao(): string
    getDaySha(): string
    getDayChongDesc(): string
    getPengZuGan(): string
    getPengZuZhi(): string
    getPositionXi(): string
    getPositionXiDesc(): string
    getPositionYangGui(): string
    getPositionYangGuiDesc(): string
    getPositionYinGui(): string
    getPositionYinGuiDesc(): string
    getPositionFu(): string
    getPositionFuDesc(): string
    getPositionCai(): string
    getPositionCaiDesc(): string
    getDayPositionXi(): string
    getDayPositionXiDesc(): string
    getDayPositionYangGui(): string
    getDayPositionYangGuiDesc(): string
    getDayPositionYinGui(): string
    getDayPositionYinGuiDesc(): string
    getDayPositionFu(): string
    getDayPositionFuDesc(): string
    getDayPositionCai(): string
    getDayPositionCaiDesc(): string
    getDayPositionTaiSui(): string
    getDayPositionTaiSuiDesc(): string
    getMonthPositionTaiSui(): string
    getMonthPositionTaiSuiDesc(): string
    getYearPositionTaiSui(): string
    getYearPositionTaiSuiDesc(): string
    getDayPositionTai(): string
    getMonthPositionTai(): string
    getDayTianShen(): string
    getDayTianShenType(): string
    getDayTianShenLuck(): string
    getTimeTianShen(): string
    getTimeTianShenType(): string
    getTimeTianShenLuck(): string
    getZhiXing(): string
    getShuJiu(): string | null
    getFu(): string | null
    getLiuYao(): string
    getWuHou(): string
    getHou(): string
    getDayLu(): string
    getTimes(): string[]
    getTime(): string
    getYearXun(): string
    getMonthXun(): string
    getDayXun(): string
    getTimeXun(): string
    getYearXunKong(): string
    getMonthXunKong(): string
    getDayXunKong(): string
    getTimeXunKong(): string
    getYearNineStar(): object
    getMonthNineStar(): object
    getDayNineStar(): object
    getTimeNineStar(): object
    getBaZi(): string[]
    getBaZiWuXing(): string[]
    getBaZiNaYin(): string[]
    getBaZiShiShenGan(): string[]
    getBaZiShiShenZhi(): string[][]
    getBaZiShiShenYearZhi(): string[]
    getBaZiShiShenMonthZhi(): string[]
    getBaZiShiShenDayZhi(): string[]
    getBaZiShiShenTimeZhi(): string[]
    getEightChar(): EightChar
    getSolar(): Solar
    getFoto(): Foto
    getTao(): Tao
    next(n: number): Lunar
    toFullString(): string
    toString(): string
  }

  export class EightChar {
    setSect(sect: number): void
    getSect(): number
    getDayGanIndex(): number
    getDayZhiIndex(): number

    getYear(): string
    getYearGan(): string
    getYearZhi(): string
    getYearHideGan(): string[]
    getYearWuXing(): string
    getYearNaYin(): string
    getYearShiShenGan(): string
    getYearShiShenZhi(): string[]
    getYearDiShi(): string
    getYearXun(): string
    getYearXunKong(): string

    getMonth(): string
    getMonthGan(): string
    getMonthZhi(): string
    getMonthHideGan(): string[]
    getMonthWuXing(): string
    getMonthNaYin(): string
    getMonthShiShenGan(): string
    getMonthShiShenZhi(): string[]
    getMonthDiShi(): string
    getMonthXun(): string
    getMonthXunKong(): string

    getDay(): string
    getDayGan(): string
    getDayZhi(): string
    getDayHideGan(): string[]
    getDayWuXing(): string
    getDayNaYin(): string
    getDayShiShenGan(): string
    getDayShiShenZhi(): string[]
    getDayDiShi(): string
    getDayXun(): string
    getDayXunKong(): string

    getTime(): string
    getTimeGan(): string
    getTimeZhi(): string
    getTimeHideGan(): string[]
    getTimeWuXing(): string
    getTimeNaYin(): string
    getTimeShiShenGan(): string
    getTimeShiShenZhi(): string[]
    getTimeDiShi(): string
    getTimeXun(): string
    getTimeXunKong(): string

    getTaiYuan(): string
    getTaiYuanNaYin(): string
    getTaiXi(): string
    getTaiXiNaYin(): string
    getMingGong(): string
    getMingGongNaYin(): string
    getShenGong(): string
    getShenGongNaYin(): string
    getLunar(): Lunar
    getYun(gender: number, sect?: number): Yun
    toString(): string
  }

  export class Yun {
    getGender(): number
    getStartYear(): number
    getStartMonth(): number
    getStartDay(): number
    getStartHour(): number
    isForward(): boolean
    getDaYun(): DaYun[]
    getLunar(): Lunar
    getStartSolar(): Solar
  }

  export class DaYun {
    getStartYear(): number
    getEndYear(): number
    getStartAge(): number
    getEndAge(): number
    getIndex(): number
    getGanZhi(): string
    getXun(): string
    getXunKong(): string
    getLunar(): Lunar
    getLiuNian(): LiuNian[]
    getXiaoYun(): XiaoYun[]
  }

  export class LiuNian {
    getYear(): number
    getAge(): number
    getGanZhi(): string
    getXun(): string
    getXunKong(): string
    getLunar(): Lunar
  }

  export class XiaoYun {
    getYear(): number
    getAge(): number
    getGanZhi(): string
    getXun(): string
    getXunKong(): string
    getLunar(): Lunar
  }

  export class LunarMonth {
    static fromYm(year: number, month: number): LunarMonth
    getIndex(): number
    getGanIndex(): number
    getZhiIndex(): number
    getGan(): string
    getZhi(): string
    getGanZhi(): string
    getYear(): number
    getMonth(): number
    getDayCount(): number
    getFirstJulianDay(): number
    isLeap(): boolean
    getPositionXi(): string
    getPositionXiDesc(): string
    getPositionYangGui(): string
    getPositionYangGuiDesc(): string
    getPositionYinGui(): string
    getPositionYinGuiDesc(): string
    getPositionFu(): string
    getPositionFuDesc(): string
    getPositionCai(): string
    getPositionCaiDesc(): string
    getPositionTaiSui(): string
    getPositionTaiSuiDesc(): string
    getNineStar(): object
    next(n: number): LunarMonth
    toString(): string
  }

  export class LunarYear {
    static fromYear(year: number): LunarYear
    getYear(): number
    getMonthCount(): number
    getDayCount(): number
    isLeap(): boolean
    getLeapMonth(): number
    getMonths(): LunarMonth[]
    toString(): string
    toFullString(): string
  }

  export class SolarWeek {
    getIndex(): number
    getYear(): number
    getMonth(): number
    getDay(): number
    toString(): string
  }

  export class NineStar {
    getIndex(): number
    getNumber(): string
    getColor(): string
    getWuXing(): string
    getPosition(): string
    getName(): string
    toString(): string
  }

  export class Foto {
    getYear(): number
    getMonth(): number
    getDay(): number
    getYearInChinese(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    getFestivals(): string[]
    getOtherFestivals(): string[]
  }

  export class Tao {
    getYear(): number
    getMonth(): number
    getDay(): number
    getYearInChinese(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    getFestivals(): string[]
    getOtherFestivals(): string[]
  }

  export namespace HolidayUtil {
    function getHoliday(year: number, month: number, day: number): object | null
    function getHolidays(year: number): object[]
    function getHolidaysByTarget(year: number): object[]
    function fix(year: number, months: string): void
  }

  export namespace SolarUtil {
    // Various static utility methods
  }

  export namespace LunarUtil {
    // Various static utility methods
  }
}
