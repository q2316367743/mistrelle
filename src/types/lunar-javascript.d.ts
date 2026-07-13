declare module 'lunar-javascript' {
  export class Solar {
    static fromYmdHms(
      year: number,
      month: number,
      day: number,
      hour: number,
      minute: number,
      second: number
    ): Solar
    getLunar(): Lunar
  }

  export class Lunar {
    getEightChar(): EightChar
  }

  export class EightChar {
    getYear(): string
    getMonth(): string
    getDay(): string
    getTime(): string
  }
}
