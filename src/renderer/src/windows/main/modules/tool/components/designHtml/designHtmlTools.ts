import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/windows/main/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'
import { getCanvasGuidelineContent } from '@/windows/main/modules/canvas'
import {
  buildDesignHtmlOutputsDir,
  exportDesignHtmlPng,
  getDesignHtmlStore
} from '@/windows/main/modules/designHtml'

/** HTML 引擎工具上下文：仅需沙盒目录定位 outputs/ 下的设计稿文件 */
export interface DesignHtmlToolContext {
  getSandboxDir: () => string
}

const ctxError = (): never => {
  throw new Error('HTML 设计稿工具缺少沙盒目录上下文')
}

const storeOf = (ctx: DesignHtmlToolContext) => getDesignHtmlStore(ctx.getSandboxDir() || ctxError())

/** 按需设计知识白名单：复用画布引擎 guidelines 注册表的引擎无关主题，剔除 canvas 专属操作 / 工作流文档 */
const DESIGN_HTML_GUIDELINE_TOPICS = [
  'style-guide',
  'composition',
  'typography',
  'image-generation',
  'styles',
  'poster',
  'book-cover',
  'album-cover',
  'social-media',
  'knowledge-card'
] as const

const docSummary = (result: {
  name: string
  version: number
  title?: string
  width: number
  height: number
}) => ({
  success: true,
  name: result.name,
  version: result.version,
  title: result.title,
  width: result.width,
  height: result.height,
  note: '已落盘并同步侧边栏预览'
})

/** 返回 HTML 引擎工具实例（按 chat sandboxDir 绑定），供 ChatTypeConfig 场景级注入 */
export const createDesignHtmlTools = (ctx: DesignHtmlToolContext): ToolFunction[] => {
  const store = () => storeOf(ctx)

  return [
    {
      name: 'html_list',
      label: '列出设计稿',
      description:
        '列出当前聊天 outputs/ 目录下全部 HTML 设计稿（html-{version}.html），含版本号 / 标题与尺寸',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => store().refreshFiles()
    },
    {
      name: 'html_create',
      label: '创建设计稿',
      description:
        '创建新 HTML 设计稿（自动分配 html-{下一个版本号}）并设为当前，侧边栏即时预览。常用比例：海报 3:4 1080×1440、电影海报 2:3、专辑封面 1:1 1000×1000、公众号封面 2.35:1 900×383、小红书 3:4 1242×1660、知识卡片 4:3。html 为完整 HTML 文档（内联 style，禁 script / 外链资源）',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '设计稿标题（可选，用于侧边栏辨识）' },
          width: { type: 'number', description: '设计稿宽度（px，body 即该尺寸画布）' },
          height: { type: 'number', description: '设计稿高度（px）' },
          html: { type: 'string', description: '完整 HTML 文档源码（<!DOCTYPE html> 起）' }
        },
        required: ['width', 'height', 'html']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { title, width, height, html } = params[0] as {
          title?: string
          width: number
          height: number
          html: string
        }
        try {
          return docSummary(await store().create({ title, width, height, html }))
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      }
    },
    {
      name: 'html_write',
      label: '重写设计稿',
      description:
        '核心编辑工具：整页重写当前设计稿的 HTML 源码（全量替换，源码以你上次提交为准，不必先 html_read）。可选 width / height 同步调整画布尺寸',
      parameters: {
        type: 'object',
        properties: {
          html: { type: 'string', description: '重写后的完整 HTML 文档源码' },
          width: { type: 'number', description: '可选：调整画布宽度（缺省沿用当前）' },
          height: { type: 'number', description: '可选：调整画布高度（缺省沿用当前）' }
        },
        required: ['html']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { html, width, height } = params[0] as {
          html: string
          width?: number
          height?: number
        }
        try {
          return docSummary(await store().write(html, { width, height }))
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) }
        }
      }
    },
    {
      name: 'html_read',
      label: '读取源码',
      description:
        '读取 HTML 设计稿源码原文（默认当前设计稿，可指定版本）；仅在上下文丢失需要找回源码时使用',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '设计稿版本号（缺省读当前）' } }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version?: number }
        if (version != null) {
          const content = await store().read(version)
          if (content === null) return { error: `未找到设计稿 html-${version}` }
          return { content }
        }
        const current = store().current.value
        if (!current) return { error: '当前没有打开的设计稿，请先 html_create 或 html_open' }
        return { content: current.html }
      }
    },
    {
      name: 'html_open',
      label: '打开设计稿',
      description: '打开指定版本设计稿为当前，后续 html_write 等操作都作用于它',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '设计稿版本号（html_list 获取）' } },
        required: ['version']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version: number }
        const doc = await store().open(version)
        if (!doc) return { error: `未找到设计稿 html-${version}` }
        return docSummary(doc)
      }
    },
    {
      name: 'html_delete',
      label: '删除设计稿',
      description: '删除指定版本设计稿文件',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '设计稿版本号（html_list 获取）' } },
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
      name: 'html_export',
      label: '导出设计稿图片',
      description:
        '将当前设计稿（或指定版本）渲染为 PNG 图片并保存到本地，返回保存路径与实际尺寸。用于目测整体视觉效果；导出为静态定格（CSS 动画停在终态）',
      parameters: {
        type: 'object',
        properties: {
          version: { type: 'number', description: '设计稿版本号（缺省导出当前设计稿）' },
          path: {
            type: 'string',
            description:
              'PNG 保存路径（缺省保存到沙盒 outputs/html-{version}.png；父目录不存在会自动创建）'
          },
          scale: {
            type: 'number',
            description: '像素密度倍率，1~4，缺省 2（如 1080×1440 @2x 导出 2160×2880）'
          }
        }
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { version, path, scale } = params[0] as {
          version?: number
          path?: string
          scale?: number
        }
        let doc = store().current.value
        if (version != null && doc?.version !== version) {
          doc = await store().readDoc(version)
          if (!doc) return { error: `未找到设计稿 html-${version}` }
        }
        if (!doc) {
          return { error: '当前没有打开的设计稿，请先 html_create 或 html_open，或指定 version' }
        }
        const sandboxDir = ctx.getSandboxDir() || ctxError()
        const pixelScale = Math.min(4, Math.max(1, Math.round(scale ?? 2)))
        const target =
          path || window.preload.path.join(buildDesignHtmlOutputsDir(sandboxDir), `html-${doc.version}.png`)
        try {
          const blob = await exportDesignHtmlPng(doc, pixelScale)
          await window.preload.fs.mkdir(window.preload.path.dirname(target), true)
          await window.preload.fs.writeBinaryFile(target, await blob.arrayBuffer())
        } catch (err) {
          return { error: `导出失败：${err instanceof Error ? err.message : String(err)}` }
        }
        return {
          success: true,
          path: target,
          width: doc.width,
          height: doc.height,
          scale: pixelScale,
          note: `已按 ${pixelScale}x 像素密度导出`
        }
      }
    },
    {
      name: 'html_guidelines',
      label: '获取设计参考',
      description:
        '获取内置设计参考（按需加载，避免全部塞进提示词）。通用：style-guide 反 AI 俗套 / composition 构图 / typography 字体排版 / image-generation 生图省钱 / styles 内置风格目录（签名手法）；场景：poster / book-cover / album-cover / social-media / knowledge-card。做某类作品前先读对应场景指南；未指定风格时先读 styles',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: `可用 topic：${DESIGN_HTML_GUIDELINE_TOPICS.join(' / ')}`
          }
        },
        required: ['topic']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { topic } = params[0] as { topic: string }
        if (!(DESIGN_HTML_GUIDELINE_TOPICS as readonly string[]).includes(topic)) {
          return {
            error: `未知 topic：${topic}，可用：${DESIGN_HTML_GUIDELINE_TOPICS.join(' / ')}`
          }
        }
        const content = getCanvasGuidelineContent(topic)
        if (!content) return { error: `未知 topic：${topic}` }
        return { topic, content }
      }
    }
  ]
}

/** HTML 引擎工具完整清单（单一数据源：工具工厂与安全策略注册共用） */
export const DESIGN_HTML_TOOL_NAMES = [
  'html_list',
  'html_create',
  'html_write',
  'html_read',
  'html_open',
  'html_delete',
  'html_export',
  'html_guidelines'
] as const

/**
 * HTML 引擎工具安全策略：html_* 仅读写当前聊天自己的 outputs/ 目录（可信区），
 * 默认模式（mode=0）下直接放行，避免每次编辑都挂起等待审批（与画布工具同口径）。
 * 计划模式（mode=1）仍按模式策略 deny（写类）。注册在模块内，工具被引用即完成注册。
 */
for (const name of DESIGN_HTML_TOOL_NAMES) {
  // html_export 接收外部保存路径，不能无条件放行，改走下方路径感知策略
  if (name === 'html_export') continue
  registerToolPolicy({
    name,
    resolve: () => 'allow'
  })
}

/**
 * html_export 写入策略（写 PNG 文件，涉及外部路径，与 canvas_export 同口径）：
 * - 未传 path（缺省写入沙盒 outputs/）或 path 位于沙盒 / 工作空间（可信区）→ 自动放行
 * - 其余路径 → 需用户审批
 */
registerToolPolicy({
  name: 'html_export',
  resolve(_tool, args, ctx) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'allow'
    return isPathUnder(path, ctx.sandboxDir) || isPathUnder(path, ctx.workspace) ? 'allow' : 'ask'
  }
})
