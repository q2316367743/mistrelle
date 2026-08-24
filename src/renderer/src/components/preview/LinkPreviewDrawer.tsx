import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import LinkPreviewContent from './LinkPreviewContent.vue'

export interface LinkPreviewOptions {
  /** webview 持久化会话名，跨打开保留 cookie / 登录态；缺省 'persist:link-preview' */
  partition?: string
}

/**
 * 内嵌网页浏览抽屉（公共组件，命令式 DrawerPlugin）：
 * 内容组件 LinkPreviewContent.vue 以 <webview> 承载外部页面，
 * 自带导航工具栏（后退/前进/刷新/系统浏览器打开/关闭）；footer: false
 */
export const openLinkPreview = (url: string, options?: LinkPreviewOptions) => {
  const dp = DrawerPlugin({
    header: false,
    size: 'clamp(500px, 70%, 960px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(LinkPreviewContent, {
        url,
        partition: options?.partition,
        onClose: () => dp?.destroy?.()
      })
  })
}