/**
 * 设计素材工具（与 canvas 画布解耦）：为设计类对话提供真实素材获取能力。
 * - icon_svg：Iconify 真实 SVG 图标（补 iconfont 无免费 API 的缺口）
 * - website_logo：按网址获取真实 logo / favicon，落盘沙盒返回本地路径
 * - font_list：查询本机可用字体（系统 + 资源库），供画布 text 节点指定 fontFamily
 * - font_register：将字体文件加入资源库，之后 font_list 永久包含
 * - image_crop：将一张图片按区域 / 网格裁剪成多张 PNG（本地 Sharp，免费）
 * - image_generate：文字生图（仅在配置了默认生图模型时注入；真实实现见 chat 模块 generateImage）
 * 工具注入：chatType.ts（global/ChatTypeConfig）的 design 配置里与画布工具一起挂载。
 */
import type { ToolFunction } from '@/domain'
import { useSettingDefaultStore } from '@/store/setting/SettingDefaultStore'
import { createIconSvgTool } from './iconSvg'
import { createWebsiteLogoTool, type DesignToolContext } from './websiteLogo'
import { createFontListTool, createFontRegisterTool } from './fontTools'
import { createImageCropTool } from './imageCrop'
import { createImageGenerateTool } from './imageGenerate'

export type { DesignToolContext }

export const createDesignTools = (ctx: DesignToolContext): ToolFunction[] => {
  const tools: ToolFunction[] = [
    createIconSvgTool(),
    createWebsiteLogoTool(ctx),
    createFontListTool(),
    createFontRegisterTool(),
    createImageCropTool()
  ]
  // 仅配置了默认生图模型时注入 image_generate：未配置则 AI 无生图能力，走占位图 / 用户素材
  if (useSettingDefaultStore().state.defaultImageModel) {
    tools.push(createImageGenerateTool(ctx))
  }
  return tools
}
