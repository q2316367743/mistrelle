/**
 * image_generate 工具：根据文字描述生成插画 / 素材图片并保存到本地。
 * - 依赖「默认生图模型」（设置 → 默认设置）；未配置时工具不注入（见 design/index.ts），
 *   运行时模型被清空则返回错误提示，AI 回退 stock / placeholder 或让用户提供素材。
 * - 真实生图逻辑收口在 @/modules/chat/service/ImageGenerate.generateImage（当前为空实现，
 *   返回「尚未就绪」友好错误）；本工具只做参数校验、路径兜底与结果透传。
 * - 从具体文件路径导入 generateImage（叶子模块），不经过 chat 桶文件，避免循环依赖。
 */
import type { ToolFunction } from '@/domain'
import { useSettingDefaultStore } from '@/store/setting/SettingDefaultStore'
import { generateImage } from '@/modules/chat/service/ImageGenerate'
import { registerToolPolicy, type ToolPolicyContext } from '@/modules/tool/toolPolicy'
import type { DesignToolContext } from './websiteLogo'

/** 默认输出路径：{sandboxDir}/outputs/images/image-{时间戳}.png */
const buildDefaultOutputPath = (sandboxDir: string): string => {
  const imagesDir = window.preload.path.join(sandboxDir, 'outputs', 'images')
  return window.preload.path.join(imagesDir, `image-${Date.now()}.png`)
}

const isPathUnder = (target: string, parent: string): boolean => {
  if (!target || !parent) return false
  const t = window.preload.path.normalizePath(target).replace(/\/$/, '')
  const p = window.preload.path.normalizePath(parent).replace(/\/$/, '')
  return t === p || t.startsWith(p + '/')
}

export const createImageGenerateTool = (ctx: DesignToolContext): ToolFunction => ({
  name: 'image_generate',
  label: '生成图片',
  description:
    '根据文字描述生成一张插画 / 素材图片并保存到本地，返回图片绝对路径（path），' +
    '把 path 填进画布 image 节点 imageUrl 即可使用。需要已配置默认生图模型；' +
    '未配置或服务未就绪时返回错误，此时回退 stock / placeholder 占位或请用户提供素材。',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description:
          '生图描述（建议用详细英文描述：主体 / 风格 / 配色 / 构图；多素材合并生成时描述整张布局与每个区块内容）'
      },
      path: {
        type: 'string',
        description: '输出图片保存路径（缺省保存到沙盒 outputs/images/ 下自动命名）'
      },
      size: {
        type: 'string',
        description: '输出尺寸，如 1024x1024；缺省由服务端决定'
      }
    },
    required: ['prompt']
  },
  risk: 'sensitive',
  handler: async (...params: unknown[]) => {
    const { prompt, path, size } = params[0] as {
      prompt?: string
      path?: string
      size?: string
    }
    if (!prompt?.trim()) return { error: '缺少 prompt：请输入生图描述' }

    if (!useSettingDefaultStore().state.defaultImageModel) {
      return {
        error: '未配置默认生图模型：请到 设置 → 默认设置 → 默认生图模型 选择模型后再试'
      }
    }

    const sandboxDir = ctx.getSandboxDir()
    if (!sandboxDir && !path?.trim()) {
      return { error: '缺少 path 且无可用沙盒目录：请传入输出文件路径' }
    }
    const target = path?.trim() || buildDefaultOutputPath(sandboxDir as string)

    const result = await generateImage({ prompt: prompt.trim(), path: target, size })
    if ('error' in result) return { error: result.error }

    return {
      success: true,
      path: result.path,
      ...(result.width != null ? { width: result.width, height: result.height } : {}),
      note: '图片已生成，把 path 填进画布 image 节点的 imageUrl 即可使用'
    }
  }
})

/**
 * image_generate 写入策略：path 缺省写沙盒 outputs/images/（可信区），显式 path 位于
 * 沙盒 / 工作空间内自动放行，其余需用户审批（与 canvas_export / font_register 一致）。
 */
registerToolPolicy({
  name: 'image_generate',
  resolve(_tool, args, ctx: ToolPolicyContext) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'allow'
    const userDirs = [ctx.sandboxDir, ctx.workspace].filter(Boolean)
    if (userDirs.some((dir) => isPathUnder(path, dir))) return 'allow'
    return 'ask'
  }
})
