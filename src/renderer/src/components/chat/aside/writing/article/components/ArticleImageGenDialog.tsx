import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import type { ArticleImageContext } from '@/windows/main/modules/tool/components/article/articleImagePrompt'
import ArticleImageGenContent from './ArticleImageGenContent.vue'

export interface ArticleImageGenParams {
  /** cover=生成封面 / image=生成插图（决定默认尺寸与产物命名前缀） */
  kind: 'cover' | 'image'
  /** 产物落盘目录（项目 assets/ 绝对路径） */
  assetsDir: string
  /** 文章语境：弹窗打开时据此让 AI 代写生图描述（缺省则留空由用户手写） */
  context?: ArticleImageContext
  /** 成功回调：返回落盘图片绝对路径 */
  onSuccess?: (absPath: string) => void
}

/**
 * 文章配图 AI 生成弹窗外壳（命令式 DialogPlugin，直出生图接口不建页面记录）：
 * 描述 / 尺寸 / 模型与生成操作都在 ArticleImageGenContent.vue，经 body: () => h(...) 渲染。
 */
export const openArticleImageGen = (params: ArticleImageGenParams) => {
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
      h(ArticleImageGenContent, {
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
