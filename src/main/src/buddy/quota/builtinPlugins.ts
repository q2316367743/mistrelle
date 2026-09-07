/**
 * 内置额度插件（main 进程）：目前只有 DeepSeek 余额。
 * 内置是「可关闭的预置形态」，与插件目录第三方走同一契约（quotaRunner）；
 * id/name/settings 元数据一律由脚本 definePlugin 声明、collect 时取出（单一事实源），
 * 本文件只登记 key 与源码。源码不落盘，随 app 版本更新（供应商接口变更零迁移）。
 * API 文档：https://api-docs.deepseek.com/zh-cn/api/get-user-balance
 */
import type { BuiltinQuotaPluginId } from '@common/types/quota'

export interface BuiltinQuotaPlugin {
  key: BuiltinQuotaPluginId
  code: string
}

export const BUILTIN_QUOTA_PLUGINS: readonly BuiltinQuotaPlugin[] = [
  {
    key: 'deepseek',
    code: `/**
 * DeepSeek 余额查询插件（内置预置，与第三方插件同一契约）
 * 接口：GET https://api.deepseek.com/user/balance（Bearer 认证）
 * API 文档：https://api-docs.deepseek.com/zh-cn/api/get-user-balance
 */
definePlugin({
  id: 'deepseek',
  name: 'DeepSeek 余额',
  settings: [{ key: 'apiKey', label: 'API Key', secret: true }],
  async fetch(ctx) {
    if (!ctx.settings.apiKey) throw new Error('请先填写 DeepSeek API Key')
    const res = await ctx.fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: 'Bearer ' + ctx.settings.apiKey }
    })
    if (res.status === 401) throw new Error('API Key 无效（401）')
    if (res.status !== 200) throw new Error('接口返回 HTTP ' + res.status)
    const data = JSON.parse(res.body)
    const info = data.balance_infos && data.balance_infos[0]
    if (!info) throw new Error('响应中没有余额数据')
    const units = { CNY: '元', USD: '$' }
    const unit = units[info.currency] || info.currency || ''
    return {
      items: [{
        label: 'DeepSeek 余额',
        value: info.total_balance + ' ' + unit,
        screenTemplate: 'deepseek',
        screenValue: info.total_balance,
        screenUnit: unit
      }]
    }
  }
})
`
  }
]
