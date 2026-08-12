import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import type { SubscribeBlogger } from '@/entity/project/Subscribe'
import BloggerSettingContent from './BloggerSettingContent.vue'

export interface BloggerSettingDialogParams {
  projectId: string
  blogger: SubscribeBlogger
  onSuccess?: (blogger: SubscribeBlogger) => void
}

/**
 * 博主识别参数设置弹窗外壳（命令式 DialogPlugin）：
 * 内容组件 BloggerSettingContent.vue 承载表单与保存，经 body: () => h(...) 渲染；
 * 操作按钮由内容组件内部提供（footer: false）。
 */
export const openBloggerSettingDialog = (params: BloggerSettingDialogParams) => {
  const dp = DialogPlugin({
    header: `识别设置 · ${params.blogger.name}`,
    placement: 'center',
    width: '440px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(BloggerSettingContent, {
        projectId: params.projectId,
        blogger: params.blogger,
        onClose: () => dp?.destroy?.(),
        onSuccess: (blogger: SubscribeBlogger) => {
          dp?.destroy?.()
          params.onSuccess?.(blogger)
        }
      })
  })
}
