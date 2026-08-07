/**
 * 字体工具：font_list 查询可用字体（系统 + 资源库），font_register 将字体文件入库。
 *
 * 统一契约：任何字体都以 { name, path, source } 输出，模型拿到 name 填入画布 text 节点的
 * fontFamily 即可。渲染层 ensureFontsForDoc 自动分流：system → Chromium 原生；
 * library → new FontFace 注册。资源库目录 ~/.mistrelle/assets/ 由 preload font 模块管理。
 */
import type { ToolFunction } from '@/domain'
import { registerToolPolicy, type ToolPolicyContext } from '@/modules/tool/toolPolicy'

/** 字体列表默认上限：避免超 MAX_TOOL_RESULT_BYTES，模型可按 query / offset 翻页 */
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

const isPathUnder = (target: string, parent: string): boolean => {
  if (!target || !parent) return false
  const t = window.preload.path.normalizePath(target).replace(/\/$/, '')
  const p = window.preload.path.normalizePath(parent).replace(/\/$/, '')
  return t === p || t.startsWith(p + '/')
}

export const createFontListTool = (): ToolFunction => ({
  name: 'font_list',
  label: '查询可用字体',
  description:
    '返回本机可用字体列表（系统字体 + 资源库字体，统一 { name, path, source }）。' +
    '查到的 name 可直接填进画布 text 节点 fontFamily。可传 query 按字体名子串过滤（如 "PingFang"/"Songti"/"黑体"）、' +
    'source 过滤来源（system 系统 / library 资源库）、limit+offset 分页（默认前 100 条）。' +
    '指定特殊字体前先查本机是否有该字体，未安装可用 font_register 注册字体文件。',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '按字体名子串过滤，如 PingFang / Songti / 黑体；缺省返回全部' },
      source: {
        type: 'string',
        description: '来源过滤：system 系统字体 / library 资源库；缺省返回全部',
        enum: ['system', 'library']
      },
      limit: { type: 'number', description: `返回条数上限，默认 ${DEFAULT_LIMIT}，最大 ${MAX_LIMIT}` },
      offset: { type: 'number', description: '分页偏移，配合 limit 翻页' }
    }
  },
  internal: true,
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { query, source, limit, offset } = params[0] as {
      query?: string
      source?: string
      limit?: number
      offset?: number
    }
    const all = await window.preload.font.listFonts()
    const kw = query?.trim().toLowerCase()
    const filtered = all.filter((f) => {
      if (source && f.source !== source) return false
      if (kw && !f.name.toLowerCase().includes(kw)) return false
      return true
    })
    const safeLimit = Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const safeOffset = Math.max(offset ?? 0, 0)
    const page = filtered.slice(safeOffset, safeOffset + safeLimit)
    return {
      total: filtered.length,
      returned: page.length,
      offset: safeOffset,
      fonts: page,
      note:
        filtered.length > safeLimit
          ? `共 ${filtered.length} 个匹配字体，已返回第 ${safeOffset + 1}~${safeOffset + page.length} 条；可调 limit/offset 翻页或用 query 缩小范围`
          : undefined
    }
  }
})

export const createFontRegisterTool = (): ToolFunction => ({
  name: 'font_register',
  label: '注册字体文件',
  description:
    '将字体文件加入资源库（~/.mistrelle/assets/fonts/）：解析字体族名 → 拷贝入库 → 更新索引。' +
    '传入字体文件路径（工作空间 / 沙盒内的 .ttf/.otf/.woff/.woff2/.ttc/.otc），返回注册后的 { name, path, source: "library" }，' +
    '之后 font_list 会包含它，name 可直接用于画布 text 节点 fontFamily。' +
    '适合用户提供了系统未安装的字体文件时使用；同名重复注册会覆盖。',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '字体文件绝对路径（支持 ttf / otf / woff / woff2 / ttc / otc）'
      }
    },
    required: ['path']
  },
  internal: true,
  risk: 'sensitive',
  handler: async (...params: unknown[]) => {
    const { path } = params[0] as { path?: string }
    if (!path) return { error: '缺少 path：请传入字体文件绝对路径' }
    const result = await window.preload.font.addFont(path)
    if ('error' in result && result.error) return { error: result.error }
    return {
      success: true,
      name: result.name,
      path: result.path,
      source: result.source,
      note: `字体「${result.name}」已加入资源库，name 可直接用于画布 text 节点 fontFamily`
    }
  }
})

/**
 * font_list / font_register 安全策略：
 * - font_list 只读系统与资源库信息 → allow
 * - font_register 只读取源字体文件（沙盒 / 工作区 / 用户目录内 allow，其余 ask），
 *   写入固定于资源库目录，不接收外部写入路径 → 默认模式直接放行
 */
registerToolPolicy({ name: 'font_list', resolve: () => 'allow' })
registerToolPolicy({
  name: 'font_register',
  resolve(_tool, args, ctx: ToolPolicyContext) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'allow'
    const userDirs = [ctx.sandboxDir, ctx.workspace, window.preload.inject.os.getPath('home')].filter(
      Boolean
    )
    if (userDirs.some((dir) => isPathUnder(path, dir))) return 'allow'
    return 'ask'
  }
})
