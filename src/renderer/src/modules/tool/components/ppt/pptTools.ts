/**
 * PPT 工具集（ppt_*，内部工具，全部仅操作当前聊天沙盒 outputs/）：
 * 契约模型 = 单一文件持续编辑：ppt_create 定文件名 + Theme → ppt_add_slide 加页 →
 * ppt_batch_edit 编辑页内元素（SlideNode JSON 元素数组，TypeBox 严格校验，全程 JSON 不涉及 xml）。
 */
import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'
import { buildPptOutputsDir, exportPptx, exportPptxToPngs, getPptStore } from '@/modules/ppt'
import {
  PPT_GUIDELINE_TOPICS,
  PPT_GUIDELINES,
  PPT_SLIDE_SIZE,
  pptElementSchema,
  pptElementPatchSchema
} from '@/modules/ppt'
import type { PptElementPatch } from '@/modules/ppt'
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
        '创建新 PPT 文件：指定文件名（id）+ 全局主题色板（theme 令牌），返回文件标识。创建后为 0 页，用 ppt_add_slide 逐页添加；后续编辑都在这个文件上原地进行',
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
          }
        },
        required: ['name']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { name, theme } = params[0] as { name?: string; theme?: Record<string, string> }
        return store().create({ name: name ?? '', theme })
      }
    },
    {
      name: 'ppt_add_slide',
      label: '新增页面',
      description:
        '在 PPT 文件末尾新增一页，返回 1 起始的页索引。elements 为页面元素数组（SlideNode JSON：{tag, attr, child}），缺省生成空白页；页面根元素必须是 VStack / HStack 布局容器',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（缺省使用当前打开的 PPT）' },
          elements: {
            type: 'array',
            items: pptElementSchema,
            description:
              '页面元素数组（每个元素是 SlideNode：{tag, attr, child}；根元素必须用 VStack / HStack 布局容器）'
          }
        }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { pptId, elements } = params[0] as { pptId?: string; elements?: unknown[] }
        return store().addSlide(pptId, elements)
      }
    },
    {
      name: 'ppt_batch_edit',
      label: '编辑页面元素',
      description:
        '核心编辑工具：替换指定页（slideId 从 1 开始）的内容为元素数组（整页覆盖）。元素为 SlideNode JSON（tag + attr + child，经严格校验；任一非法整批拒绝）。页面根元素必须是 VStack / HStack 布局容器（flexbox 先布局后内容），不要散落裸 Text / Shape',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（缺省使用当前打开的 PPT）' },
          slideId: {
            type: 'number',
            description: '目标页码（1 起始，ppt_read / ppt_add_slide 获取）'
          },
          elements: {
            type: 'array',
            items: pptElementSchema,
            description:
              '该页全部元素（SlideNode JSON 数组，整页替换；根元素必须用 VStack / HStack 布局容器）'
          }
        },
        required: ['slideId', 'elements']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { pptId, slideId, elements } = params[0] as {
          pptId?: string
          slideId: number
          elements?: unknown[]
        }
        return store().editSlide(pptId, slideId, elements ?? [])
      }
    },
    {
      name: 'ppt_edit_element',
      label: '精准编辑节点',
      description:
        '按节点 id（nodeId）精准编辑指定页内单个节点，不动整页。nodeId 来自用户点击节点引用、ppt_read / ppt_add_slide / ppt_batch_edit 返回的 nodes[].id。patch 为任意组合：attr 合并覆盖属性（点表示法键）、text 覆盖文本（仅文本节点）、child 替换子元素数组。找不到节点返回错误（可能已被整页替换，先 ppt_read 重读）',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（缺省使用当前打开的 PPT）' },
          slideId: { type: 'number', description: '目标页码（1 起始）' },
          nodeId: { type: 'string', description: '目标节点 id（引用返回 / ppt_read 获取）' },
          patch: pptElementPatchSchema
        },
        required: ['slideId', 'nodeId', 'patch']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { pptId, slideId, nodeId, patch } = params[0] as {
          pptId?: string
          slideId: number
          nodeId: string
          patch: PptElementPatch
        }
        return store().editElementById(pptId, slideId, nodeId, patch)
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
      name: 'ppt_open',
      label: '打开 PPT',
      description: '打开指定 PPT 为当前文档，后续缺省 pptId 的操作都作用于它，侧边栏预览同步切换',
      parameters: {
        type: 'object',
        properties: { pptId: { type: 'string', description: 'PPT 文件标识（ppt_list 获取）' } },
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
      name: 'ppt_read',
      label: '读取 PPT',
      description:
        '读取指定 PPT（缺省当前）的 JSON：不给 slideId 返回完整文档（含 name / theme / slide 数组），给 slideId 只返回该页的 SlideNode 元素数组；同时返回渲染状态与最近渲染错误（有错先修正再编辑）',
      parameters: {
        type: 'object',
        properties: {
          pptId: { type: 'string', description: 'PPT 文件标识（缺省当前打开的 PPT）' },
          slideId: { type: 'number', description: '页码（1 起始，缺省返回全文）' }
        }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { pptId, slideId } = params[0] as { pptId?: string; slideId?: number }
        const result =
          slideId != null ? await store().read(pptId, slideId) : await store().read(pptId)
        if (result === null) return { error: '未找到该 PPT（或当前未打开任何 PPT）' }
        return result
      }
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
        '获取内置 PPT 经验指南（按需加载，避免全部塞进提示词）。做 PPT 前先读 workflow 与 layout；元素属性不确定读 nodes；配色与样式读 styling；存储结构与语法速查读 json',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: `layout（布局系统与页面模式）/ nodes（20 种节点属性速查）/ styling（配色 / 字体 / 样式）/ json（SlideNode JSON 存储结构速查）/ workflow（端到端工作流）（${PPT_GUIDELINE_TOPICS.join(' / ')}）`
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
  'ppt_add_slide',
  'ppt_batch_edit',
  'ppt_edit_element',
  'ppt_list',
  'ppt_open',
  'ppt_read',
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
