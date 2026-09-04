import { ToolFunction } from '@/domain'
import { useSettingSecureStore } from '@/windows/main/store/setting/SettingSecureStore'
import { isPathBlacklisted } from '@/utils/sandbox'
import { readImageInfo } from '@/utils/imageInfo'

/** 读取本地图片格式与宽高（设计场景：image 节点按真实尺寸等比缩放） */
export const createImageInfoTool = (): ToolFunction => ({
  name: 'image_info',
  label: '读取图片信息',
  description:
    '读取本地图片文件的实际格式与宽高（基于系统内置图像引擎，支持 png / jpeg / webp / gif 等常见位图格式）。给 image 节点设置 width/height 前先调用，按真实尺寸等比缩放，避免失真；格式由图像引擎按内容判定（与扩展名无关）。',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '图片文件路径' }
    },
    required: ['path']
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { path } = params[0] as { path: string }
    const { sandbox } = useSettingSecureStore().state
    if (sandbox.enabled && isPathBlacklisted(path, sandbox.fileBlackList)) {
      return { error: `路径 ${path} 在黑名单中，已被安全策略拦截` }
    }
    const info = await readImageInfo(path)
    if (!info) return { error: `无法解析图片信息：${path}（文件不存在、非图片格式或文件损坏）` }
    return { path, format: info.format, width: info.width, height: info.height }
  }
})
