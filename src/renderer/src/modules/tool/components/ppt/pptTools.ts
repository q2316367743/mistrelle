/**
 * PPT 工具集（ppt_*，内部工具，全部仅操作当前聊天沙盒 outputs/）：
 * 管理 slides-{version}.pom.xml 版本文件、按页批量编辑、导出 PPTX / PNG、读取语法指南。
 */
import type { ToolFunction, ToolProperty } from '@/domain'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'
import { buildPptxBytes, buildPptOutputsDir, getPptStore, renderPptxToPngs } from '@/modules/ppt'
import type { PptBatchOp } from '@/modules/ppt'
import { PPT_GUIDELINE_TOPICS, PPT_GUIDELINES, PPT_SLIDE_SIZE } from '@/modules/ppt'
import type { ChatTypeToolContext } from '@/modules/chat/chatType'

const ctxError = (): never => {
  throw new Error('PPT 工具缺少沙盒目录上下文')
}

const storeOf = (ctx: ChatTypeToolContext) => getPptStore(ctx.getSandboxDir() || ctxError())

/** ppt_batch_edit 的 ops 联合类型 JSON Schema（oneOf 区分五种操作） */
const pptBatchOpSchema: ToolProperty = {
  type: 'object',
  description: 'PPT 批量编辑操作：add（插入页）/ update（替换页）/ remove（删除页）/ move（调整页序）/ rewrite（全量重写）',
  oneOf: [
    {
      type: 'object',
      description: '插入新页（at 缺省追加到末尾）',
      properties: {
        op: { type: 'string', description: '操作类型', const: 'add' },
        at: { type: 'number', description: '插入位置（0 起始，缺省追加到末尾）' },
        xml: { type: 'string', description: '新页 XML，必须是完整 <Slide>...</Slide>（可含多个 <Slide>）' }
      },
      required: ['op', 'xml']
    },
    {
      type: 'object',
      description: '替换指定页',
      properties: {
        op: { type: 'string', description: '操作类型', const: 'update' },
        index: { type: 'number', description: '要替换的页码（0 起始）' },
        xml: { type: 'string', description: '替换页 XML，必须恰好 1 个 <Slide>' }
      },
      required: ['op', 'index', 'xml']
    },
    {
      type: 'object',
      description: '删除指定页',
      properties: {
        op: { type: 'string', description: '操作类型', const: 'remove' },
        index: { type: 'number', description: '要删除的页码（0 起始）' }
      },
      required: ['op', 'index']
    },
    {
      type: 'object',
      description: '调整页序',
      properties: {
        op: { type: 'string', description: '操作类型', const: 'move' },
        from: { type: 'number', description: '移动来源页码（0 起始）' },
        to: { type: 'number', description: '移动目标页码（0 起始）' }
      },
      required: ['op', 'from', 'to']
    },
    {
      type: 'object',
      description: '全量重写',
      properties: {
        op: { type: 'string', description: '操作类型', const: 'rewrite' },
        xml: { type: 'string', description: '全量重写的完整 POM XML（可含 <Theme> 与多个 <Slide>）' }
      },
      required: ['op', 'xml']
    }
  ]
} as const

/** 返回 PPT 工具实例（按 chat sandboxDir 绑定），供 ChatTypeConfig 场景级注入 */
export const createPptTools = (ctx: ChatTypeToolContext): ToolFunction[] => {
  const store = () => storeOf(ctx)

  return [
    {
      name: 'ppt_list',
      label: '列出 PPT',
      description: '列出当前聊天 outputs/ 下全部 PPT 版本文件（slides-{version}.pom.xml），含版本号与更新时间',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => store().refreshFiles()
    },
    {
      name: 'ppt_read',
      label: '读取 PPT XML',
      description:
        '读取指定版本（缺省当前版本）PPT 的完整 POM XML 内容，供分析 / 编辑；同时返回渲染状态与最近渲染错误（有错先修正再编辑）',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '版本号（ppt_list 获取，缺省读取当前版本）' } }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version?: number }
        const result = await store().read(version)
        if (!result) return { error: '未找到该版本 PPT（或当前未打开任何 PPT）' }
        return result
      }
    },
    {
      name: 'ppt_create',
      label: '创建 PPT',
      description:
        '创建新 PPT（自动生成 16:9 标题页骨架，版本号自动分配）并设为当前文档，返回版本号。之后用 ppt_batch_edit 续写内容页',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: '演示文稿标题（可选，默认「演示文稿」）' } }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { title } = params[0] as { title?: string }
        const doc = await store().create({ title })
        return { success: true, version: doc.version, name: doc.name, note: '初始标题页已生成，请用 ppt_batch_edit 编辑内容' }
      }
    },
    {
      name: 'ppt_open',
      label: '打开 PPT',
      description: '打开指定版本为当前文档，后续 batch_edit 等操作都作用于它，侧边栏预览同步切换',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '版本号（ppt_list 获取）' } },
        required: ['version']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version: number }
        const doc = await store().open(version)
        if (!doc) return { error: `未找到版本 slides-${version}` }
        return { success: true, version: doc.version }
      }
    },
    {
      name: 'ppt_select',
      label: '定位页面',
      description: '将侧边栏预览定位到指定页（页码从 1 开始），与用户浏览视角联动',
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
      description: '删除指定版本 PPT 文件',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '版本号（ppt_list 获取）' } },
        required: ['version']
      },
      internal: true,
      risk: 'dangerous',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version: number }
        await store().delete(version)
        return { success: true }
      }
    },
    {
      name: 'ppt_batch_edit',
      label: '批量编辑 PPT',
      description:
        '核心编辑工具：按页批量操作（add / update / remove / move / rewrite）。所有 xml 片段必须先经语法校验（任一失败整批回滚，不产生新版本）；索引为当前页序（0 起始，op 间顺序可见）。编辑成功生成新版本并自动渲染侧边栏',
      parameters: {
        type: 'object',
        properties: {
          ops: {
            type: 'array',
            items: pptBatchOpSchema,
            description: '按顺序执行的操作列表'
          }
        },
        required: ['ops']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { ops } = params[0] as { ops?: PptBatchOp[] }
        if (!ops?.length) return { error: 'ops 不能为空' }
        return store().batchEdit(ops)
      }
    },
    {
      name: 'ppt_export_pptx',
      label: '导出 PPTX',
      description:
        '将当前 PPT 构建为可编辑 PPTX 文件，返回保存路径。缺省保存到沙盒 outputs/；也可指定外部路径（需用户确认）',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'PPTX 保存路径（缺省沙盒 outputs/slides-{version}.pptx）' }
        }
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { path } = params[0] as { path?: string }
        const sandboxDir = ctx.getSandboxDir() || ctxError()
        const doc = store().current.value
        if (!doc) return { error: '当前没有打开的 PPT，请先 ppt_create 或 ppt_open' }
        const target = path || window.preload.path.join(buildPptOutputsDir(sandboxDir), `slides-${doc.version}.pptx`)
        try {
          const bytes = await buildPptxBytes(doc.xml, PPT_SLIDE_SIZE)
          await window.preload.fs.mkdir(window.preload.path.dirname(target), true)
          await window.preload.fs.writeBinaryFile(target, bytes)
          return { success: true, path: target }
        } catch (err) {
          return { error: `PPTX 导出失败：${err instanceof Error ? err.message : String(err)}` }
        }
      }
    },
    {
      name: 'ppt_export_png',
      label: '导出 PNG',
      description:
        '将当前 PPT 渲染为 PNG 图片。page 缺省导出全部页（多页时 path 为目录，缺省沙盒 outputs/，每页一个文件）；指定 page 导出单页（path 为文件路径）',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '保存路径：单页导出为文件路径，多页导出为目录（缺省沙盒 outputs/）' },
          page: { type: 'number', description: '页码（1 起始，缺省导出全部页）' }
        }
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { path, page } = params[0] as { path?: string; page?: number }
        const sandboxDir = ctx.getSandboxDir() || ctxError()
        const doc = store().current.value
        if (!doc) return { error: '当前没有打开的 PPT，请先 ppt_create 或 ppt_open' }
        try {
          const results = await renderPptxToPngs(doc.xml, PPT_SLIDE_SIZE, page != null ? [page] : undefined)
          if (!results.length) return { error: `未找到可导出的页面（page: ${page}）` }
          const files: string[] = []
          for (const result of results) {
            const target = page != null
              ? (path ?? window.preload.path.join(buildPptOutputsDir(sandboxDir), `slides-${doc.version}-page-${result.page}.png`))
              : window.preload.path.join(path || buildPptOutputsDir(sandboxDir), `slides-${doc.version}-page-${result.page}.png`)
            await window.preload.fs.mkdir(window.preload.path.dirname(target), true)
            await window.preload.fs.writeBinaryFile(target, result.bytes)
            files.push(target)
          }
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
        '获取内置 POM XML 语法指南 / 工作流（按需加载，避免全部塞进提示词）。做 PPT 前先读 workflow，语法不确定先读 pom-xml',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: `pom-xml（节点语法与铁律）/ workflow（端到端工作流）（${PPT_GUIDELINE_TOPICS.join(' / ')}）`
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
  'ppt_list',
  'ppt_read',
  'ppt_create',
  'ppt_open',
  'ppt_select',
  'ppt_delete',
  'ppt_batch_edit',
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

registerToolPolicy({
  name: 'ppt_export_pptx',
  resolve(_tool, args, ctx) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'allow'
    return isPathUnder(path, ctx.sandboxDir) || isPathUnder(path, ctx.workspace) ? 'allow' : 'ask'
  }
})

registerToolPolicy({
  name: 'ppt_export_png',
  resolve(_tool, args, ctx) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'allow'
    return isPathUnder(path, ctx.sandboxDir) || isPathUnder(path, ctx.workspace) ? 'allow' : 'ask'
  }
})
