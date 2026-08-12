import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import FontMetaContent from './FontMetaContent.vue'

export interface FontMetaDialogParams {
  /** 添加模式：待入库字体文件绝对路径列表 */
  files?: string[]
  /** 编辑模式：已存在字体（资源库或系统字体） */
  font?: FontItemWithMeta
  onSuccess?: (result: { added?: number; name?: string }) => void
}

/**
 * 字体分类元数据弹窗外壳（命令式 DialogPlugin）：
 * 内容组件 FontMetaContent.vue 承载逐字体 5 维下拉与入库/保存，经 body: () => h(...) 渲染；
 * 操作按钮由内容组件内部提供（footer: false）。成功后回调 onSuccess。
 */
export const openFontMetaDialog = (params: FontMetaDialogParams) => {
  const header = params.font ? `编辑字体 · ${params.font.name}` : `设置字体信息（${params.files?.length ?? 0} 个文件）`
  const dp = DialogPlugin({
    header,
    placement: 'center',
    width: '760px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(FontMetaContent, {
        files: params.files,
        font: params.font,
        onClose: () => dp?.destroy?.(),
        onSuccess: (result: { added?: number; name?: string }) => {
          dp?.destroy?.()
          params.onSuccess?.(result)
        }
      })
  })
}
