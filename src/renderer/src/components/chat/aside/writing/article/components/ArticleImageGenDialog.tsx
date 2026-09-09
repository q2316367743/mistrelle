import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import ArticleImageGenContent from './ArticleImageGenContent.vue'
import type { ArticlePlatform } from '@/windows/main/modules/tool/components/article/articleTypes'

export interface ArticleImageGenParams {
  /** cover=生成封面 / image=生成插图（决定默认尺寸与产物命名前缀） */
  kind: 'cover' | 'image'
  /** 目标平台（影响封面默认尺寸取向） */
  platform: ArticlePlatform
  /** 产物落盘目录（项目 assets/ 绝对路径） */
  assetsDir: string
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
    body: () =>
      h(ArticleImageGenContent, {
        kind: params.kind,
        platform: params.platform,
        assetsDir: params.assetsDir,
        onClose: () => dp?.destroy?.(),
        onSuccess: (absPath: string) => {
          dp?.destroy?.()
          params.onSuccess?.(absPath)
        }
      })
  })
}
