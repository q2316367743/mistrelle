import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import type {
  ImagePromptContext,
  ImagePromptKind
} from '@/windows/main/modules/tool/components/writing/imagePrompt'
import ImageGenContent from './ImageGenContent.vue'

export interface ImageGenParams {
  /** cover=生成封面 / image=生成插图（决定默认尺寸与产物命名前缀） */
  kind: ImagePromptKind
  /** 产物落盘目录（作品 assets/ 绝对路径） */
  assetsDir: string
  /** 作品语境：弹窗打开时据此让 AI 代写生图描述（缺省则留空由用户手写） */
  context?: ImagePromptContext
  /** 成功回调：返回落盘图片绝对路径 */
  onSuccess?: (absPath: string) => void
}

/**
 * 写作场景配图 AI 生成弹窗外壳（命令式 DialogPlugin，直出生图接口不建页面记录）：
 * 描述 / 尺寸 / 模型与生成操作都在 ImageGenContent.vue，经 body: () => h(...) 渲染。
 * 文章创作（封面 / 插图）与短篇小说（封面）共用，仅 assetsDir 与 context 不同。
 */
export const openImageGen = (params: ImageGenParams) => {
  const dp = DialogPlugin({
    header: params.kind === 'cover' ? 'AI 生成封面' : 'AI 生成插图',
    placement: 'center',
    width: '480px',
    footer: false,
    destroyOnClose: true,
    closeBtn: false,
    closeOnEscKeydown: false,
    closeOnOverlayClick: false,
    body: () =>
      h(ImageGenContent, {
        kind: params.kind,
        assetsDir: params.assetsDir,
        context: params.context,
        onClose: () => dp?.destroy?.(),
        onSuccess: (absPath: string) => {
          dp?.destroy?.()
          params.onSuccess?.(absPath)
        }
      })
  })
}
