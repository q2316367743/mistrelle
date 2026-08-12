import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import VideoExportContent from './VideoExportContent.vue'

export interface VideoExportDialogOptions {
  /** 沙盒目录：定位画布 store 与缺省输出目录 */
  sandbox: string
}

/**
 * 导出为视频弹窗外壳（命令式 DialogPlugin）：
 * 内容组件 VideoExportContent.vue 承载帧率/时长/格式等选项与「开始导出」，
 * 经 body: () => h(...) 渲染进弹窗；操作按钮由内容组件内部提供（footer: false）。
 */
export const openVideoExportDialog = (options: VideoExportDialogOptions): void => {
  const dp = DialogPlugin({
    header: '导出为视频',
    placement: 'center',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(VideoExportContent, {
        sandbox: options.sandbox,
        onClose: () => dp?.destroy()
      })
  })
}
