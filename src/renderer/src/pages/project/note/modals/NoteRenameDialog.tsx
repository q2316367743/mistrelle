import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import NoteRenameContent from './NoteRenameContent.vue'

export interface NoteRenameDialogParams {
  /** 目标类型：笔记 / 文件夹 */
  kind: 'note' | 'folder'
  /** 当前名称 */
  currentName: string
  /** 同级已占用名称（不含自身） */
  takenNames: string[]
}

/**
 * 重命名弹窗外壳（命令式 DialogPlugin）：
 * 内容组件 NoteRenameContent.vue 承载表单与提交，经 body: () => h(...) 渲染；
 * 操作按钮由内容组件内部提供（footer: false）。成功后回调 onSuccess(newName)。
 */
export const openNoteRenameDialog = (
  params: NoteRenameDialogParams,
  onSuccess: (newName: string) => void
) => {
  const dp = DialogPlugin({
    header: params.kind === 'folder' ? '重命名文件夹' : '重命名笔记',
    placement: 'center',
    width: '420px',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(NoteRenameContent, {
        currentName: params.currentName,
        takenNames: params.takenNames,
        onClose: () => dp?.destroy?.(),
        onSuccess: (newName: string) => {
          dp?.destroy?.()
          onSuccess(newName)
        }
      })
  })
}
