/**
 * PPT 工具集（ppt_*，内部工具，全部仅操作当前聊天沙盒 outputs/）：
 * 契约模型 = 单一文件持续编辑：ppt_create 定文件名 + Theme + 初始页数 → ppt_add_slide 加页 /
 * ppt_delete_slide 删页 → ppt_batch_edit 对指定页做**元素级批量操作**（仿 canvas canvas_batch_edit：
 * insert / copy / update / move / delete，按节点 id 精准增删改查，≤15 个/批，单操作容错）。
 * 查看：ppt_info 文档级信息 / ppt_get_nodes 单页元素树（含 id）；换肤：ppt_set_theme。
 */
import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'
import { buildPptOutputsDir, exportPptx, exportPptxToPngs, getPptStore } from '@/modules/ppt'
import {
  PPT_GUIDELINE_TOPICS,
  PPT_GUIDELINES,
  PPT_SLIDE_SIZE,
  pptBatchOpsSchema
} from '@/modules/ppt'
import type { ChatTypeToolContext } from '@/modules/chat/chatType'

const ctxError = (): never => {
  throw new Error('PPT 工具缺少沙盒目录上下文')
}

const storeOf = (ctx: ChatTypeToolContext) => getPptStore(ctx.getSandboxDir() || ctxError())

/** 返回 PPT 工具实例（按 chat sandboxDir 绑定），供 ChatTypeConfig 场景级注入 */
export const createPptTools = (ctx: ChatTypeToolContext): ToolFunction[] => {
  const store = () => storeOf(ctx)

  return [
    {
      name: 'ppt_create',
      label: '创建 PPT',
      description:
        '创建新 PPT 文件：指定文件名（id）+ 全局主题色板（theme 令牌）+ 初始页面数量（slideCount），返回文件标识。slide 数组按 slideCount 放对应数量的空页（空白页），之后用 ppt_batch_edit 逐页填充元素、ppt_add_slide 追加页、ppt_delete_slide 删除页；后续编辑都在这个文件上原地进行',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              '文件名（作为文件标识，如「产品发布会」；1-60 字符，中文 / 字母 / 数字 / _ / -）'
          },
          theme: {
            type: 'object',
            description:
              '全局主题色板（theme 令牌）：token 名 → 6 位 hex 颜色（如 { "surface": "0F172A", "accent": "38BDF8", "textMain": "F8FAFC" }），后续所有颜色属性可用 $token 引用'
          },
          slideCount: {
            type: 'number',
            description:
              '初始页面数量（slide 数组放对应数量的空页，缺省 1；建议先规划整份 PPT 页数，如封面 / 目录 / 内容页 / 结尾）'
          }
        },
        required: ['name']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { name, theme, slideCount } = params[0] as {
          name?: string
          theme?: Record<string, string>
          slideCount?: number
        }
        return store().create({ name: name ?? '', theme, slideCount })
      }
    },
    {
      name: 'ppt_info',
      label: '获取 PPT 信息',
      description:
        '获取指定 PPT 的文档级信息：id / 名称 / 页面数量 / 主题色板（theme 令牌）+ 渲染状态与最近渲染错误（有错先修正再编辑）',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（ppt_list / ppt_create 获取）' }
        },
        required: ['pptId']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { pptId } = params[0] as { pptId: string }
        const result = await store().info(pptId)
        if (result === null) return { error: `未找到 PPT「${pptId}」（可能未创建，先 ppt_create 或 ppt_list）` }
        return result
      }
    },
    {
      name: 'ppt_open',
      label: '打开 PPT',
      description: '打开指定 PPT 为当前文档，侧边栏预览同步切换；后续操作仍需显式传 pptId',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（ppt_list 获取）' }
        },
        required: ['pptId']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { pptId } = params[0] as { pptId: string }
        const doc = await store().open(pptId)
        if (!doc) return { error: `未找到 PPT「${pptId}」` }
        return { success: true, id: doc.id }
      }
    },
    {
      name: 'ppt_get_nodes',
      label: '获取页面元素树',
      description:
        '返回指定页的完整元素树（SlideNode JSON，含每个节点顶层 id、tag、attr、child），供分析 / 编辑前查看节点结构与 id。ids 给定时只返回命中节点（保留祖先结构），用于聚焦少量元素；缺省返回整页。同页内 id 唯一，编辑用 id 精准定位；附带 theme 与渲染状态',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（ppt_list / ppt_create 获取）' },
          slideId: { type: 'number', description: '目标页码（1 起始）' },
          ids: {
            type: 'array',
            items: { type: 'string', description: '节点 id' },
            description: '可选：只返回指定 id 的节点（缺省返回全部）'
          }
        },
        required: ['pptId', 'slideId']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { pptId, slideId, ids } = params[0] as {
          pptId: string
          slideId: number
          ids?: string[]
        }
        const result = await store().getNodes(pptId, slideId, ids)
        if (result === null) return { error: `未找到 PPT「${pptId}」` }
        return result
      }
    },
    {
      name: 'ppt_batch_edit',
      label: '批量编辑页面元素',
      description:
        '核心编辑工具：对指定页（slideId 1 起始）的元素做批量操作（insert / copy / update / move / delete，≤15 个/批），按节点 id 精准增删改查，非整页覆盖。单操作非法只让该操作失败并返回错误（results 内联），其余照常执行；同批可用 as 绑定名（insert / copy 声明，后续 op 用 parent:"@绑定名" 引用刚创建的节点）。构建顺序建议 背景→主视觉→装饰→文字。语法速查与示例详见 ppt_guidelines("operations")',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（ppt_list / ppt_create 获取）' },
          slideId: { type: 'number', description: '目标页码（1 起始）' },
          operations: pptBatchOpsSchema
        },
        required: ['pptId', 'slideId', 'operations']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { pptId, slideId, operations } = params[0] as {
          pptId: string
          slideId: number
          operations?: unknown[]
        }
        return store().batchEdit(pptId, slideId, operations ?? [])
      }
    },
    {
      name: 'ppt_add_slide',
      label: '新增页面',
      description: '在 PPT 文件末尾新增一页空白页，返回新增页的页码（1 起始）与当前总页数',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（ppt_list / ppt_create 获取）' }
        },
        required: ['pptId']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { pptId } = params[0] as { pptId: string }
        return store().addSlide(pptId)
      }
    },
    {
      name: 'ppt_delete_slide',
      label: '删除页面',
      description: '删除指定页（不可恢复），返回当前总页数；删除后后续页码自动前移',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（ppt_list / ppt_create 获取）' },
          slideId: { type: 'number', description: '目标页码（1 起始）' }
        },
        required: ['pptId', 'slideId']
      },
      internal: true,
      risk: 'dangerous',
      handler: async (...params: unknown[]) => {
        const { pptId, slideId } = params[0] as { pptId: string; slideId: number }
        return store().deleteSlide(pptId, slideId)
      }
    },
    {
      name: 'ppt_set_theme',
      label: '设置主题色板',
      description:
        '更新指定 PPT 的全局主题色板（theme 令牌），如 { "surface": "0F172A", "accent": "38BDF8", "textMain": "F8FAFC" }。之后所有颜色属性用 $token 引用，全篇色彩和谐、可整体换肤；同名 token 覆盖',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（ppt_list / ppt_create 获取）' },
          theme: { type: 'object', description: 'token 名 → 6 位 hex 颜色（# 可选，如 FFFFFF）' }
        },
        required: ['pptId', 'theme']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { pptId, theme } = params[0] as { pptId: string; theme: Record<string, string> }
        return store().setTheme(pptId, theme)
      }
    },
    {
      name: 'ppt_list',
      label: '列出 PPT',
      description: '列出当前聊天 outputs/ 下全部 PPT 文件（{name}.ppt.json），含文件标识与更新时间',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => store().refreshFiles()
    },
    {
      name: 'ppt_select',
      label: '定位预览页',
      description: '将侧边栏预览定位到指定页（页码从 1 开始），与用户浏览视角联动；不影响文件内容',
      parameters: {
        type: 'object',
        properties: { page: { type: 'number', description: '目标页码（1 起始）' } },
        required: ['page']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { page } = params[0] as { page: number }
        return store().selectPage(page)
      }
    },
    {
      name: 'ppt_delete',
      label: '删除 PPT',
      description: '删除指定 PPT 文件（不可恢复）',
      parameters: {
        type: 'object',
        properties: { pptId: { type: 'string', description: 'PPT 文件标识（ppt_list 获取）' } },
        required: ['pptId']
      },
      internal: true,
      risk: 'dangerous',
      handler: async (...params: unknown[]) => {
        const { pptId } = params[0] as { pptId: string }
        await store().delete(pptId)
        return { success: true }
      }
    },
    {
      name: 'ppt_export_pptx',
      label: '导出 PPTX',
      description:
        '将指定 PPT（缺省当前）构建为可编辑 PPTX 文件，返回保存路径。缺省保存到沙盒 outputs/；也可指定外部路径（需用户确认）',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（缺省当前打开的 PPT）' },
          path: { type: 'string', description: 'PPTX 保存路径（缺省沙盒 outputs/{name}.pptx）' }
        }
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { pptId, path } = params[0] as { pptId?: string; path?: string }
        const sandboxDir = ctx.getSandboxDir() || ctxError()
        const doc = await store().read(pptId)
        if (doc === null) return { error: '未找到该 PPT（或当前未打开任何 PPT）' }
        if ('error' in doc) return { error: doc.error }
        const target =
          path || window.preload.path.join(buildPptOutputsDir(sandboxDir), `${doc.id}.pptx`)
        try {
          const filePath = await exportPptx(doc.content, PPT_SLIDE_SIZE, target)
          return { success: true, path: filePath }
        } catch (err) {
          return { error: `PPTX 导出失败：${err instanceof Error ? err.message : String(err)}` }
        }
      }
    },
    {
      name: 'ppt_export_png',
      label: '导出 PNG',
      description:
        '将指定 PPT（缺省当前）渲染为 PNG 图片。page 缺省导出全部页（多页时 path 为目录，缺省沙盒 outputs/，每页一个文件）；指定 page 导出单页（path 为文件路径）',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（缺省当前打开的 PPT）' },
          path: {
            type: 'string',
            description: '保存路径：单页导出为文件路径，多页导出为目录（缺省沙盒 outputs/）'
          },
          page: { type: 'number', description: '页码（1 起始，缺省导出全部页）' }
        }
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { pptId, path, page } = params[0] as { pptId?: string; path?: string; page?: number }
        const sandboxDir = ctx.getSandboxDir() || ctxError()
        const doc = await store().read(pptId)
        if (doc === null) return { error: '未找到该 PPT（或当前未打开任何 PPT）' }
        if ('error' in doc) return { error: doc.error }
        try {
          // 单页导出：path 为文件路径；多页导出：path 为目录（每页 page-{n}.png）
          const target =
            page != null
              ? (path ??
                window.preload.path.join(
                  buildPptOutputsDir(sandboxDir),
                  `${doc.id}-page-${page}.png`
                ))
              : path || buildPptOutputsDir(sandboxDir)
          const files = await exportPptxToPngs(
            doc.content,
            PPT_SLIDE_SIZE,
            target,
            page != null ? [page] : undefined
          )
          if (!files.length) return { error: `未找到可导出的页面（page: ${page}）` }
          return { success: true, files }
        } catch (err) {
          return { error: `PNG 导出失败：${err instanceof Error ? err.message : String(err)}` }
        }
      }
    },
    {
      name: 'ppt_guidelines',
      label: '获取 PPT 指南',
      description:
        '获取内置 PPT 经验指南（按需加载，避免全部塞进提示词）。做 PPT 前先读 workflow 与 layout；批量操作元素语法读 operations；元素属性不确定读 nodes；配色与样式读 styling；存储结构与语法速查读 json',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: `operations（批量操作语法速查）/ layout（布局系统与页面模式）/ nodes（20 种节点属性速查）/ styling（配色 / 字体 / 样式）/ json（SlideNode JSON 存储结构速查）/ workflow（端到端工作流）（${PPT_GUIDELINE_TOPICS.join(' / ')}）`
          }
        },
        required: ['topic']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { topic } = params[0] as { topic: string }
        const content = PPT_GUIDELINES[topic as keyof typeof PPT_GUIDELINES]
        if (!content) {
          return { error: `未知 topic：${topic}，可用：${PPT_GUIDELINE_TOPICS.join(' / ')}` }
        }
        return { topic, content }
      }
    }
  ]
}

/** PPT 工具完整清单（单一数据源：工具工厂与安全策略注册共用） */
export const PPT_TOOL_NAMES = [
  'ppt_create',
  'ppt_info',
  'ppt_open',
  'ppt_get_nodes',
  'ppt_batch_edit',
  'ppt_add_slide',
  'ppt_delete_slide',
  'ppt_set_theme',
  'ppt_list',
  'ppt_select',
  'ppt_delete',
  'ppt_export_pptx',
  'ppt_export_png',
  'ppt_guidelines'
] as const

/**
 * PPT 工具安全策略：绝大多数只读写当前聊天沙盒 outputs/（可信区），默认直接放行；
 * 导出工具（ppt_export_pptx / ppt_export_png）接收外部保存路径，仿 canvas_export：
 * 未传 path 或 path 位于沙盒 / 工作空间（可信区）→ 自动放行，其余路径 → 需用户审批。
 * 注意：resolveToolPolicy 按工具全名匹配策略，必须为每个工具名单独注册。
 */
for (const name of PPT_TOOL_NAMES) {
  if (name === 'ppt_export_pptx' || name === 'ppt_export_png') continue
  registerToolPolicy({
    name,
    resolve: () => 'allow'
  })
}

const exportPathPolicy = (
  _tool: unknown,
  args: Record<string, unknown>,
  ctx: { sandboxDir: string; workspace: string }
) => {
  const path = args.path
  if (typeof path !== 'string' || !path) return 'allow'
  return isPathUnder(path, ctx.sandboxDir) || isPathUnder(path, ctx.workspace) ? 'allow' : 'ask'
}

registerToolPolicy({
  name: 'ppt_export_pptx',
  resolve: exportPathPolicy
})

registerToolPolicy({
  name: 'ppt_export_png',
  resolve: exportPathPolicy
})
