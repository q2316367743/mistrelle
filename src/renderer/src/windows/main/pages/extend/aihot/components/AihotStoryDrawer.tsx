import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import AihotStoryDrawerContent from './AihotStoryDrawerContent.vue'

/**
 * 查看事件详情抽屉（命令式 DrawerPlugin）：
 * 内容组件 AihotStoryDrawerContent.vue 自行请求 /api/v1/stories/{publicId}，
 * 支持在抽屉内沿 storyline / related 连续跳转；操作按钮由内容组件内部提供（footer: false）
 */
export const openAihotStory = (publicId: string, fallbackTitle?: string) => {
  const dp = DrawerPlugin({
    header: false,
    size: 'clamp(500px, 70%, 960px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(AihotStoryDrawerContent, {
        publicId,
        fallbackTitle,
        onClose: () => dp?.destroy?.()
      })
  })
}
