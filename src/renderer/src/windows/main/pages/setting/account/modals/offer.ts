import { openUrlByBrowser } from '@/utils/native'

/** 规格月数 → 显示名：1 月卡 / 12 年卡 / 其他 N 个月 */
export function monthLabel(months: number): string {
  if (months === 1) return '月卡'
  if (months === 12) return '年卡'
  return `${months} 个月`
}

/** 分转元显示（保留 2 位，非整数或大额均正常）；null 表示未同步 */
export function fenLabel(fen: number | null): string | null {
  if (fen === null) return null
  return `¥${(fen / 100).toFixed(2)}`
}

/**
 * 多月规格的折合月价文案（年卡营销位：折合 ¥6.58/月 · 省 ¥41.2）。
 * 只用平台价快照 priceFen 计算（与按钮价格同源），未同步 / months<=1 返回 null 不展示。
 */
export function perMonthDeal(offer: { months: number; priceFen: number | null }): string | null {
  const totalFen = offer.priceFen
  if (totalFen === null || offer.months <= 1 || totalFen <= 0) return null
  const perMonthFen = Math.round(totalFen / offer.months)
  const savedFen = Math.max(0, totalFen - perMonthFen * offer.months)
  const per = fenLabel(perMonthFen)
  if (!per) return null
  const saved = savedFen > 0 ? ` · 省 ${fenLabel(savedFen)}` : ''
  return `折合 ${per}/月${saved}`
}

/** 系统浏览器打开 16688 商品购买页 */
export function openPurchase(purchaseUrl: string): void {
  openUrlByBrowser(purchaseUrl)
}
