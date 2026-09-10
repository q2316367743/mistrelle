/**
 * image_generate 工具：根据文字描述生成插画 / 素材图片并保存到本地，生成的图片同时作为
 * image 内容块直接展示在对话中（执行器识别返回值里的 chatImages 标记完成回填，见 agentTools）。
 * - 通用能力门控：登录后注入（hasImageGenerateAccess）；积分扣减由服务端负责，余额不足等
 *   错误经工具结果透传。模型取「设置 → 默认生图模型」，未配置时回退服务端档位列表第一项。
 * - 真实生图逻辑收口在 main 的 ImageService（经 window.preload.image.generate 工具直出模式：
 *   不建页面记录，产物落盘 path 后返回终态）；本工具只做参数校验、路径兜底与结果透传。
 * - 设计创意场景：返回的 path 可直接填进画布 image 节点 imageUrl / HTML `<img src>` 使用。
 */
import type { ToolFunction } from '@/domain'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import { useImageModelStore } from '@/windows/main/store/image/ImageModelStore'
import { useSettingDefaultStore } from '@/windows/main/store/setting/SettingDefaultStore'
import { registerToolPolicy, type ToolPolicyContext } from '@/windows/main/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'
import type { DesignToolContext } from './websiteLogo'

/** 生图能力门控：已登录即可用（积分由服务端校验与扣减） */
export const hasImageGenerateAccess = (): boolean => useAuthStore().status === 'signed-in'

/** 默认输出路径：{sandboxDir}/outputs/images/image-{时间戳}.png */
const buildDefaultOutputPath = (sandboxDir: string): string => {
  const imagesDir = window.preload.path.join(sandboxDir, 'outputs', 'images')
  return window.preload.path.join(imagesDir, `image-${Date.now()}.png`)
}

export const createImageGenerateTool = (ctx: DesignToolContext): ToolFunction => ({
  name: 'image_generate',
  label: '生成图片',
  description:
    '根据文字描述生成图片并保存到本地，生成的图片会直接展示在对话中，返回图片绝对路径（path）。' +
    '支持一次生成多张（n 1-4）、像素档位（resolution 1k/2k/4k）、参考图（referenceImagePaths 非空时按参考图重绘）。' +
    '设计创意场景可把 path 直接填进画布 image 节点 imageUrl / HTML 的 <img src> 使用（渲染层自动转 file 协议 / 内联）。' +
    '注意：生图模型不支持真透明，产物必带不透明背景色（通常为白色）——需要透明底素材时，若当前会话提供 ' +
    'image_remove_background 工具，可生成后用它从边缘清除连续白底（产出带 alpha 的 PNG），' +
    '切勿把带白底的图直接盖在深色/彩色背景上。需要已登录账号；服务不可用时返回错误，' +
    '此时回退 stock / placeholder 占位或请用户提供素材。',
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
        description: '输出图片保存路径（缺省保存到沙盒 outputs/images/ 下自动命名；多张时第 1 张落此路径）'
      },
      size: {
        type: 'string',
        description: '输出尺寸：宽x高（如 1024x1024）或比例（如 16:9）；缺省由服务端决定'
      },
      n: {
        type: 'integer',
        description: '单次生成张数，1-4 的整数（缺省 1）；第 2 张起在 path 同目录追加 -2/-3/-4 序号'
      },
      resolution: {
        type: 'string',
        enum: ['1k', '2k', '4k'],
        description: '输出像素档位，与 size 共同决定实际尺寸（如 16:9 + 4k = 3840×2160）；缺省由服务端决定'
      },
      quality: {
        type: 'string',
        description: '质量档位（auto / high / medium / low），按上游模型支持透传'
      },
      background: {
        type: 'string',
        enum: ['auto', 'transparent', 'opaque'],
        description: '背景（auto / transparent / opaque），按上游模型支持透传'
      },
      outputFormat: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp'],
        description: '输出格式（缺省 png）'
      },
      outputCompression: {
        type: 'integer',
        description: '输出压缩率 0-100（仅 jpeg / webp 有效）'
      },
      moderation: {
        type: 'string',
        enum: ['auto', 'low'],
        description: '内容审核档位（auto / low），按上游模型支持透传'
      },
      nsfwCheck: {
        type: 'boolean',
        description: '提交前 NSFW 审核（开启增加耗时与成本，仅在需要时开启）'
      },
      referenceImagePaths: {
        type: 'array',
        items: { type: 'string', description: '参考图本地绝对路径' },
        description:
          '参考图本地绝对路径数组（≤15 张，png/jpg/jpeg/webp/gif），非空时触发图生图：按参考图重绘，' +
          '未指定 size 时输出尺寸跟随参考图'
      }
    },
    required: ['prompt']
  },
  risk: 'sensitive',
  handler: async (...params: unknown[]) => {
    const {
      prompt,
      path,
      size,
      n,
      resolution,
      quality,
      background,
      outputFormat,
      outputCompression,
      moderation,
      nsfwCheck,
      referenceImagePaths
    } = params[0] as {
      prompt?: string
      path?: string
      size?: string
      n?: number
      resolution?: string
      quality?: string
      background?: string
      outputFormat?: string
      outputCompression?: number
      moderation?: string
      nsfwCheck?: boolean
      referenceImagePaths?: string[]
    }
    if (!prompt?.trim()) return { error: '缺少 prompt：请输入生图描述' }

    if (!hasImageGenerateAccess()) {
      return { error: '未登录：请先登录后再使用生图功能' }
    }

    // 模型解析：默认生图模型优先，未配置时回退服务端档位列表第一项
    const model =
      useSettingDefaultStore().state.defaultImageModel || useImageModelStore().items[0]?.value
    if (!model) {
      return { error: '当前没有可用的生图模型档位：请稍后重试，或到 设置 → 默认设置 → 默认生图模型 选择模型' }
    }

    const sandboxDir = ctx.getSandboxDir()
    if (!sandboxDir && !path?.trim()) {
      return { error: '缺少 path 且无可用沙盒目录：请传入输出文件路径' }
    }
    const target = path?.trim() || buildDefaultOutputPath(sandboxDir as string)

    // 工具直出模式：不建页面记录，主进程落盘后返回终态（参考图路径由 main 归一化为 data URI）
    const res = await window.preload.image.generate({
      prompt: prompt.trim(),
      model,
      size,
      n,
      resolution,
      quality,
      background,
      outputFormat,
      outputCompression,
      moderation,
      nsfwCheck,
      imageUrls: referenceImagePaths,
      record: false,
      path: target
    })
    if (res.phase !== 'finished') return { error: '生图服务返回异常：未收到生成结果' }
    const result = res.result
    if ('error' in result) return { error: result.error }

    // 全部产物（n>1 时多张；旧形状兜底单张）；chatImages：执行器据此把图片作为
    // image 内容块展示在对话中，并从回传给模型的结果中剥离该标记
    const items =
      result.images?.length
        ? result.images
        : [{ path: result.path, width: result.width ?? null, height: result.height ?? null }]
    return {
      success: true,
      path: result.path,
      ...(result.width != null ? { width: result.width, height: result.height } : {}),
      count: items.length,
      paths: items.map((item) => item.path),
      note: '图片已生成并展示在对话中；设计场景可将 path 填进画布 image 节点的 imageUrl / HTML 的 <img src> 使用（本地路径自动转换）',
      chatImages: items.map((item) => ({
        path: item.path,
        name: window.preload.path.basename(item.path),
        ...(item.width != null ? { width: item.width, height: item.height } : {})
      }))
    }
  }
})

/**
 * image_generate 写入策略：path 缺省写沙盒 outputs/images/（可信区），显式 path 位于
 * 沙盒 / 工作空间内自动放行，其余需用户审批（与 canvas_export 一致）。
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
