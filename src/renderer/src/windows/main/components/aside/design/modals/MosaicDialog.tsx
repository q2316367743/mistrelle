import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import type { CanvasMosaic } from '@/windows/main/modules/canvas'
import MosaicDialogContent from './MosaicDialogContent.vue'

/**
 * 图片遮盖抽屉（命令式 DrawerPlugin）：
 * 编辑全部在抽屉内完成（识别文字勾选 / 图上框选 / 手动涂抹 / 擦除，可选马赛克或毛玻璃并调强度），
 * 点「应用」才写入画布节点的 `mosaic` 字段（非破坏记录：原图不变，清空标记后应用 = 复原）。
 * 节点已有记录时打开即回填，可局部增删。操作按钮由内容组件提供（footer: false）；
 * 关掉遮罩点击避免误触丢编辑，取消 / 关闭都不写回。
 */
export const openMosaicDialog = (options: {
  sandbox: string
  nodeId: string
  source: string
  /** 节点已记录的遮盖（打开即回填） */
  initial?: CanvasMosaic
}) => {
  const dp = DrawerPlugin({
    header: '图片遮盖（马赛克 / 毛玻璃）',
    size: 'clamp(900px, 82%, 1280px)',
    footer: false,
    destroyOnClose: true,
    closeOnOverlayClick: false,
    body: () =>
      h(MosaicDialogContent, {
        ...options,
        onClose: () => dp?.destroy?.(),
        onSuccess: () => dp?.destroy?.()
      })
  })
}
