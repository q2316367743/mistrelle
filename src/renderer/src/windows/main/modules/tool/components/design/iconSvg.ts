/**
 * icon_svg 工具：从 Iconify 获取真实 SVG 图标。
 * Iconify 聚合 Material / Feather / Lucide / Tabler / Font Awesome 等全部开源图标库，
 * 免费开放，是 iconfont（无免费 API）的替代方案。
 * - name：形如 "mdi:home"（{集合}:{名称}）→ 直接返回内联 SVG 字符串
 * - query：关键词搜索 → 返回候选图标名，供 AI 选后再用 name 获取
 */
import type { ToolFunction } from '@/domain'
import { requestText } from '@/plugin/http'

const ICONIFY_BASE = 'https://api.iconify.design'

/** 校验返回值是否为合法 SVG（防御服务端返回 HTML / 空内容） */
const isSvg = (content: string | undefined): boolean =>
  typeof content === 'string' && content.includes('<svg')

const fetchIconSvg = async (name: string, color?: string): Promise<{ svg: string } | { error: string }> => {
  const query = new URLSearchParams()
  // $token 调色板引用无法传给远端服务，交给 svg 节点的 $token 替换处理，此处不上色
  if (color && !color.startsWith('$')) query.set('color', color)
  const qs = query.toString()
  const url = `${ICONIFY_BASE}/${name}.svg${qs ? `?${qs}` : ''}`
  const res = await requestText({ url })
  if (res.status < 200 || res.status >= 300) return { error: `Iconify 请求失败：HTTP ${res.status}` }
  if (!isSvg(res.data)) return { error: 'Iconify 返回内容不是合法 SVG' }
  return { svg: res.data }
}

const searchIcons = async (
  query: string
): Promise<{ icons: string[]; total: number } | { error: string }> => {
  const url = `${ICONIFY_BASE}/search?query=${encodeURIComponent(query)}&limit=10`
  const res = await requestText({ url })
  if (res.status < 200 || res.status >= 300) return { error: `Iconify 搜索失败：HTTP ${res.status}` }
  try {
    const data = JSON.parse(res.data) as { icons?: string[]; total?: number }
    if (!data.icons?.length) return { error: `未找到与 "${query}" 相关的图标` }
    return { icons: data.icons, total: data.total ?? data.icons.length }
  } catch {
    return { error: 'Iconify 搜索结果解析失败' }
  }
}

export const createIconSvgTool = (): ToolFunction => ({
  name: 'icon_svg',
  label: '获取 SVG 图标',
  description:
    '从 Iconify（聚合 Material / Feather / Lucide / Tabler 等开源图标库，免费）获取真实 SVG 图标。' +
    '传 name（格式 {集合}:{名称}，如 "mdi:home"）直接返回内联 SVG 字符串，可填进画布 svg 节点，颜色可写 $token名 由调色板替换，或传 color 参数直接上色；' +
    '传 query（关键词，如 "heart"）先返回候选图标名列表，再从列表中选一个用 name 获取。',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '图标名，格式 {集合}:{名称}，如 mdi:home / tabler:heart-filled；与 query 二选一'
      },
      query: {
        type: 'string',
        description: '关键词搜索图标，如 home / heart；与 name 二选一，返回候选图标名列表'
      },
      color: {
        type: 'string',
        description: '可选：单色图标颜色（如 #E63946）。$token 调色板引用不用传这里，直接写进 svg 节点即可'
      }
    }
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { name, query, color } = params[0] as { name?: string; query?: string; color?: string }

    if (!name && !query) {
      return { error: 'name 与 query 至少填一个：name 形如 "mdi:home"，query 为关键词' }
    }

    if (name) {
      if (!name.includes(':')) {
        return {
          error: `图标名格式应为 {集合}:{名称}（如 mdi:home），收到 "${name}"；可用 query 做关键词搜索先找名字`
        }
      }
      const result = await fetchIconSvg(name, color)
      if ('error' in result) return { error: result.error }
      return {
        success: true,
        name,
        svg: result.svg,
        note: '把 svg 字符串填进画布 svg 节点；单色图标把内部颜色改成 $token名 可跟随调色板'
      }
    }

    if (!query) {
      return { error: '缺少 query：请输入关键词搜索图标' }
    }

    const result = await searchIcons(query)
    if ('error' in result) return { error: result.error }
    return {
      success: true,
      query,
      icons: result.icons,
      total: result.total,
      note: '从 icons 中选择一个（如 mdi:home），再用 name 参数获取该图标 SVG'
    }
  }
})
