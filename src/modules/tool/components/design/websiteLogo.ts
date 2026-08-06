/**
 * website_logo 工具：根据网站地址 / 域名获取真实 logo / favicon。
 * 内部按分数降序尝试多个来源（见 faviconSources.ts，来源即下载策略），对每个来源
 * 直接 downloadFileFromUrl 下载（HTTP 失败即抛错触发打分降权），成功下载到沙盒
 * outputs/images/，返回本地路径（可直接作为画布 image 节点的 imageUrl）。
 */
import type { ToolFunction } from '@/domain'
import { requestDownload } from '@/plugin/http'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import { readImageInfo } from '@/utils/imageInfo'
import {
  orderedFaviconSources,
  reportSourceFailure,
  reportSourceSuccess,
  type FaviconSource
} from './faviconSources'

/** 设计工具运行所需上下文（website_logo 需沙盒目录用于落盘素材） */
export interface DesignToolContext {
  /** 当前聊天沙盒目录（下载 logo 到 {sandboxDir}/outputs/images/） */
  getSandboxDir: () => string
}

const extractDomain = (url: string): string | null => {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
  } catch {
    return null
  }
}

/** 尝试从单个来源下载 logo，成功返回本地信息，失败返回 null */
const downloadFromSource = async (
  ctx: DesignToolContext,
  domain: string,
  source: FaviconSource
): Promise<{ path: string; href: string; format: string; width?: number; height?: number } | null> => {
  const sourceUrl = source.buildUrl(domain)
  const sandboxDir = ctx.getSandboxDir()
  if (!sandboxDir) return null
  const imagesDir = window.preload.path.join(sandboxDir, 'outputs', 'images')
  const target = window.preload.path.join(imagesDir, `logo-${domain}.${source.format}`)
  try {
    await window.preload.fs.mkdir(imagesDir, true)
    await requestDownload({ url: sourceUrl }, target)
    const items = await window.preload.fs.readDir(imagesDir)
    const file = items.find((f) => f.path === target || f.name === target.split(/[\\/]/).pop())
    if (!file || file.size <= 0) return null
    // 实际格式按文件头判定（来源扩展名可能误判，如真实 ICO 伪装 .svg），顺带返回真实宽高
    const info = await readImageInfo(target)
    return {
      path: target,
      href: window.preload.net.pathToHref(target),
      format: info?.format ?? source.format,
      width: info?.width,
      height: info?.height
    }
  } catch {
    return null
  }
}

export const createWebsiteLogoTool = (ctx: DesignToolContext): ToolFunction => ({
  name: 'website_logo',
  label: '获取网站图标',
  description:
    '根据网站地址或域名获取其真实 logo / favicon（禁止自己画一个近似 logo）。' +
    '内部自动从多个来源下载官网图标到沙盒 outputs/images/，返回本地路径（path 或 href），' +
    '填入画布 image 节点的 imageUrl 即可使用。',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '网站地址或域名，如 https://www.google.com 或 github.com'
      }
    },
    required: ['url']
  },
  risk: 'sensitive',
  handler: async (...params: unknown[]) => {
    const { url } = params[0] as { url?: string }
    if (!url) return { error: '缺少 url：请输入网站地址或域名' }

    const domain = extractDomain(url)
    if (!domain) return { error: `无法从 "${url}" 解析出域名` }

    for (const source of orderedFaviconSources()) {
      const result = await downloadFromSource(ctx, domain, source)
      if (result) {
        reportSourceSuccess(source.id)
        return {
          success: true,
          domain,
          path: result.path,
          href: result.href,
          format: result.format,
          ...(result.width != null ? { width: result.width, height: result.height } : {}),
          note: 'logo 已下载到沙盒，把 path/href 填进 image 节点 imageUrl 即可使用；width/height 为真实尺寸'
        }
      }
      reportSourceFailure(source.id)
    }

    return {
      error: '所有来源均获取失败。可让用户提供 logo 图片并放入工作空间，或稍后重试'
    }
  }
})

/**
 * website_logo 安全策略：只写入当前聊天沙盒 outputs/images/（可信区），
 * 路径由工具内部计算、不接收用户路径，故默认模式直接放行（与 canvas_* 一致）。
 * 注册在本模块内，保证工具被引用即完成注册。
 */
registerToolPolicy({
  name: 'website_logo',
  resolve: () => 'allow'
})
