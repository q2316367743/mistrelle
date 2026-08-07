/**
 * 设计素材工具（与 canvas 画布解耦）：为设计类对话提供真实素材获取能力。
 * - icon_svg：Iconify 真实 SVG 图标（补 iconfont 无免费 API 的缺口）
 * - website_logo：按网址获取真实 logo / favicon，落盘沙盒返回本地路径
 * - font_list：查询本机可用字体（系统 + 资源库），供画布 text 节点指定 fontFamily
 * - font_register：将字体文件加入资源库，之后 font_list 永久包含
 * 工具注入：chatType.ts 的 design 配置里与画布工具一起挂载。
 */
import type { ToolFunction } from '@/domain'
import { createIconSvgTool } from './iconSvg'
import { createWebsiteLogoTool, type DesignToolContext } from './websiteLogo'
import { createFontListTool, createFontRegisterTool } from './fontTools'

export type { DesignToolContext }

export const createDesignTools = (ctx: DesignToolContext): ToolFunction[] => [
  createIconSvgTool(),
  createWebsiteLogoTool(ctx),
  createFontListTool(),
  createFontRegisterTool()
]
