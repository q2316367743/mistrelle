/**
 * font_list 查询可用字体（系统 + 资源库）。
 *
 * 每个字体带五维分类元数据 meta（type/style/weight/license/language）：资源库 / 系统缓存中用户
 * 手动设置的持久化值优先，缺省按名称启发式推断（inferFontMeta）。font_list 支持按这些维度过滤。
 * 字体入库 / 元数据修改由用户在资源管理页操作（window.preload.font.addFont / updateFontMeta），
 * 不对 AI 暴露注册工具。
 * 统一契约：任何字体都以 { name, path, source } 输出，模型拿到 name 填入画布 text 节点的
 * fontFamily 即可。渲染层 ensureFontsForDoc 自动分流：system → Chromium 原生；
 * library → new FontFace 注册。资源库目录 ~/.mistrelle/assets/ 由 preload font 模块管理。
 */
import type { ToolFunction } from '@/domain'
import {
  FONT_LANG_OPTIONS,
  FONT_LICENSE_OPTIONS,
  FONT_STYLE_OPTIONS,
  FONT_TYPE_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  filterFontsByMeta,
  type FontMetaFilter
} from '@/utils/fontMeta'
import { registerToolPolicy } from '@/windows/main/modules/tool/toolPolicy'
import { useAuthStore } from '@/windows/main/store'

/** 字体列表默认上限：避免超 MAX_TOOL_RESULT_BYTES，模型可按 query / offset 翻页 */
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

export const createFontListTool = (): ToolFunction => ({
  name: 'font_list',
  label: '查询可用字体',
  description:
    '返回本机可用字体列表（系统字体 + 资源库字体，统一 { name, path, source, meta }）。' +
    '查到的 name 可直接填进画布 text 节点 fontFamily。可传 query 按字体名子串过滤（如 "PingFang"/"Songti"/"黑体"）、' +
    'source 过滤来源（system 系统 / library 资源库）、type/style/weight/license/language 按分类维度过滤' +
    '（缺省返回全部；各维度的值可从「全部」里挑选，如 type="宋体"、weight="粗"）、limit+offset 分页（默认前 100 条）。' +
    '每个字体项的 meta 含 { type, style, weight, license, language }，缺省为启发式推断，可作选字参考。' +
    '指定特殊字体前先查本机是否有该字体；系统未安装的字体文件需用户先到「资源管理」页添加入库，模型无法自行注册。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '按字体名子串过滤，如 PingFang / Songti / 黑体；缺省返回全部'
      },
      source: {
        type: 'string',
        description: '来源过滤：system 系统字体 / library 资源库；缺省返回全部',
        enum: ['system', 'library']
      },
      type: {
        type: 'string',
        description: `字体类型过滤；缺省返回全部。可选：${FONT_TYPE_OPTIONS.join(' / ')}`,
        enum: [...FONT_TYPE_OPTIONS]
      },
      style: {
        type: 'string',
        description: `字体风格过滤；缺省返回全部。可选：${FONT_STYLE_OPTIONS.join(' / ')}`,
        enum: [...FONT_STYLE_OPTIONS]
      },
      weight: {
        type: 'string',
        description: `字体字重过滤；缺省返回全部。可选：${FONT_WEIGHT_OPTIONS.join(' / ')}`,
        enum: [...FONT_WEIGHT_OPTIONS]
      },
      license: {
        type: 'string',
        description: `授权类型过滤；缺省返回全部。可选：${FONT_LICENSE_OPTIONS.join(' / ')}`,
        enum: [...FONT_LICENSE_OPTIONS]
      },
      language: {
        type: 'string',
        description: `字体语言过滤；缺省返回全部。可选：${FONT_LANG_OPTIONS.join(' / ')}`,
        enum: [...FONT_LANG_OPTIONS]
      },
      limit: {
        type: 'number',
        description: `返回条数上限，默认 ${DEFAULT_LIMIT}，最大 ${MAX_LIMIT}`
      },
      offset: { type: 'number', description: '分页偏移，配合 limit 翻页' }
    }
  },
  internal: true,
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const args = params[0] as {
      query?: string
      source?: string
      limit?: number
      offset?: number
    } & FontMetaFilter
    const all = await window.preload.font.listFonts()
    // 资源库字体（自定义字体）为会员功能：非会员对 AI 不可见
    const fontsLocked = !useAuthStore().features.customFonts
    const visible = fontsLocked ? all.filter((f) => f.source !== 'library') : all
    const kw = args.query?.trim().toLowerCase()
    const filtered = filterFontsByMeta(visible, {
      type: args.type,
      style: args.style,
      weight: args.weight,
      license: args.license,
      language: args.language
    }).filter((f) => {
      if (args.source && f.source !== args.source) return false
      if (kw && !f.name.toLowerCase().includes(kw)) return false
      return true
    })
    const safeLimit = Math.min(Math.max(args.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
    const safeOffset = Math.max(args.offset ?? 0, 0)
    const page = filtered.slice(safeOffset, safeOffset + safeLimit)
    return {
      total: filtered.length,
      returned: page.length,
      offset: safeOffset,
      fonts: page,
      note:
        filtered.length > safeLimit
          ? `共 ${filtered.length} 个匹配字体，已返回第 ${safeOffset + 1}~${safeOffset + page.length} 条；可调 limit/offset 翻页或用 query / 分类条件缩小范围`
          : fontsLocked
            ? '当前账号仅可使用系统字体（资源库自定义字体为会员功能）'
            : undefined
    }
  }
})

/**
 * font_list 安全策略：只读系统与资源库信息 → 直接放行。
 * 字体入库 / 元数据修改不对 AI 开放，仅资源管理页经 window.preload.font 操作。
 */
registerToolPolicy({ name: 'font_list', resolve: () => 'allow' })

/**
 * font_list 单例（无 ctx 依赖）：注册进 toolMap，供声明该工具的内置 Agent
 * （如「设计风格创建助手」）在任意聊天类型下查询本机字体；design 聊天的类型工具另建实例。
 */
export const fontListTool = createFontListTool()

// ── font_pick：让用户选择字体（交互式，走 InteractiveBridge）──────────────

export const FONT_PICK_TOOL_NAME = 'font_pick'

export interface FontPickArgs {
  /** 选字用途 / 场景说明，展示给用户参考 */
  purpose?: string
  /** 推荐字体 name 列表（2-5 个，须为本机已安装字体） */
  recommends?: string[]
}

/** 归一化 font_pick 参数：过滤非法 recommends 项，保证调用方拿到的是有效参数 */
export const normalizeFontPickArgs = (args: Record<string, unknown>): FontPickArgs => ({
  purpose: typeof args.purpose === 'string' ? args.purpose : '',
  recommends: Array.isArray(args.recommends)
    ? args.recommends.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : []
})

/** 用户选字结果格式化：选中的字体名可直接用于画布 text 节点 fontFamily */
export const formatFontPickResult = (name: string | null): string =>
  name
    ? `用户选择了字体：「${name}」。把该 name 填入画布 text 节点 fontFamily 即可`
    : '用户未选择字体，请自行用 font_list 挑选合适的字体或继续推进任务'

/**
 * font_pick 工具：弹出选字面板让用户挑选字体。
 * 面板顶部展示推荐字体（带预览），下方可展开查看全部字体（均带预览、可按名称搜索）。
 * 由 executeToolCalls 特殊处理走 InteractiveBridge，handler 不会被直接调用，
 * 仅作为兜底（如模型在无 UI 环境回放时）返回占位文本。
 */
export const createFontPickTool = (): ToolFunction => ({
  name: FONT_PICK_TOOL_NAME,
  label: '让用户选择字体',
  description:
    '当需要用户从本机字体中挑选一个时调用：会弹出选字面板，顶部展示你推荐的字体（recommends，带真实预览），' +
    '下方可点「选择更多」展开全部字体（系统 + 资源库，均带预览，可按名称搜索）。' +
    '用户选中的字体 name 会作为结果返回，可直接填入画布 text 节点 fontFamily。' +
    '调用前建议先 font_list 确认候选字体确实存在，再把它们的 name 放进 recommends（2-5 个）。',
  parameters: {
    type: 'object',
    properties: {
      purpose: {
        type: 'string',
        description: '选字用途 / 场景说明（如「海报主标题」「正文」），会展示给用户参考'
      },
      recommends: {
        type: 'array',
        description: '推荐字体 name 列表（2-5 个，须为本机已安装字体，可先 font_list 核实）',
        items: { type: 'string', description: '字体族名（name），如 PingFang SC / 思源宋体' }
      }
    },
    required: []
  },
  internal: true,
  risk: 'safe',
  handler: async () => 'font_pick 工具由交互界面回答，不会直接执行'
})
