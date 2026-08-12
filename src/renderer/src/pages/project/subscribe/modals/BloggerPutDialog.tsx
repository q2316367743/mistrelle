import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import BloggerPutContent from './BloggerPutContent.vue'

export interface BloggerPutDialogParams {
  projectId: string
  onSuccess: (bloggerId: string) => void
}

/**
 * 添加博主弹窗外壳（命令式 DialogPlugin）：
 * 内容组件 BloggerPutContent.vue 承载链接解析与创建，经 body: () => h(...) 渲染；
 * 操作按钮由内容组件内部提供（footer: false）。成功后回调 onSuccess(bloggerId)。
 */
export const openBloggerPutDialog = (params: BloggerPutDialogParams) => {
  const dp = DialogPlugin({
    header: '添加博主',
    placement: 'center',
    width: '480px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(BloggerPutContent, {
        projectId: params.projectId,
        onClose: () => dp?.destroy?.(),
        onSuccess: (bloggerId: string) => {
          dp?.destroy?.()
          params.onSuccess(bloggerId)
        }
      })
  })
}
