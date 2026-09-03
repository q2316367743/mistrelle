/**
 * injectApi 组装点：platform 六域桥 + sharp/ffmpeg/browser 桥聚合为 window.preload.inject。
 * 嵌套形状与 renderer 侧 types/inject.d.ts 的手工镜像契约一致，修改需同步。
 */
import { platformApi } from '~/modules/platform/platform'
import { sharpApi } from '~/modules/sharp/sharp'
import { ffmpegApi } from '~/modules/ffmpeg/ffmpeg'
import { runBrowser } from '~/modules/browser/browser'

export const injectApi = {
  ...platformApi,

  /** 浏览器工具统一入口：fetch（抓取网页内容）/ actions（自动化操作步骤） */
  runBrowser,

  ffmpeg: ffmpegApi,
  sharp: sharpApi
}
