/**
 * 生图型子 Agent 的专用工具集（最小能力面）。
 *
 * 定位：只做文生图这一件事。工具面严格限定为「生图 + 图片处理」，不含任何默认常驻能力
 * （记忆 / todo / ask / shell / 文件 / skill / 渐进式装载器），因为：
 * - 生图子 Agent 的任务是自包含的（撰写描述 → 生成 → 落盘 → 汇报路径），无需调研、提问或读写业务文件；
 * - 能力面越窄，模型越不可能跑偏去调无关工具、也越省上下文。
 * 与主流程共用同一个 image_generate 实例（参数 schema 完全一致），保证「AI 生图 = 设计创意生图 = 文章配图生图」。
 * 工具组合经 global/ChatTypeConfig 的 SUB_AGENT_TOOL_CONFIG 注册，本文件只提供工厂。
 */
import type { ToolFunction } from '@/domain'
import { createImageGenerateTool, hasImageGenerateAccess } from './imageGenerate'
import { createImageCropTool } from './imageCrop'
import { createImageInfoTool } from './imageInfo'
import type { DesignToolContext } from './websiteLogo'

export const createImageSubAgentTools = (ctx: DesignToolContext): ToolFunction[] => {
  // 未登录时生图不可用，返回空集（调用方 agentTools 已有未登录守卫，正常情况下不会启动）
  if (!hasImageGenerateAccess()) return []
  return [createImageGenerateTool(ctx), createImageCropTool(), createImageInfoTool()]
}
