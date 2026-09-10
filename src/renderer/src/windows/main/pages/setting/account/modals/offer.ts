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

/** 系统浏览器打开 16688 商品购买页 */
export function openPurchase(purchaseUrl: string): void {
  openUrlByBrowser(purchaseUrl)
}
