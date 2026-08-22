import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import AihotLinkDrawerContent from './AihotLinkDrawerContent.vue'

/**
 * 内嵌网页浏览抽屉（命令式 DrawerPlugin）：
 * 内容组件 AihotLinkDrawerContent.vue 以 <webview> 承载外部页面，
 * 自带导航工具栏（后退/前进/刷新/系统浏览器打开/关闭）；footer: false
 */
export const openAihotLink = (url: string, title?: string) => {
  const dp = DrawerPlugin({
    header: false,
    size: 'clamp(500px, 70%, 960px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(AihotLinkDrawerContent, {
        url,
        fallbackTitle: title,
        onClose: () => dp?.destroy?.()
      })
  })
}
