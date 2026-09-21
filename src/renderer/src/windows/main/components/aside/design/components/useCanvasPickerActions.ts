import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { CANVAS_UPLOAD_EXTS, uploadImages } from '@/windows/main/modules/canvas'
import type { CanvasFileInfo, CanvasStore } from '@/windows/main/modules/canvas'

/** 面板画布条目：文件信息 + 是否来自归档目录 */
export interface PickerCanvasItem extends CanvasFileInfo {
  archived: boolean
}

/**
 * 画布选择面板的动作集（从 CanvasFilePicker 拆出以控行数）：
 * 归档 / 取消归档 / 上传图片（各自创建引用画布，最后一张设为当前）/ 删除上传图片（连带 uploads 源文件）
 */
export const useCanvasPickerActions = (
  getContext: () => { sandbox: string; store: CanvasStore }
) => {
  /** 条目悬停操作：归档 / 取消归档；上传图片为删除（连带源文件） */
  const handleItemAction = async (item: PickerCanvasItem): Promise<void> => {
    const { store } = getContext()
    if (item.archived) {
      await store.unarchive(item.version)
      return
    }
    if (item.source === 'upload') {
      try {
        await MessageBoxUtil.confirm(
          `确认删除图片「${item.title || item.name}」？将同时删除上传的图片文件，删除后不可恢复`,
          '删除图片'
        )
      } catch {
        return
      }
      await store.delete(item.version)
      MessageUtil.success('已删除')
      return
    }
    await store.archive(item.version)
  }

  /** 系统文件选择器多选图片，各自创建引用画布，最后一张设为当前画布 */
  const handleUpload = async (): Promise<void> => {
    const { sandbox, store } = getContext()
    const paths = await window.preload.inject.dialog.open({
      title: '上传图片',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: CANVAS_UPLOAD_EXTS }]
    })
    if (!paths?.length) return
    const count = await uploadImages(sandbox, store, paths)
    if (!count) {
      MessageUtil.warning('未选择有效的图片文件')
      return
    }
    MessageUtil.success(count > 1 ? `已上传 ${count} 张图片并创建画布` : '已上传图片并创建画布')
  }

  return { handleItemAction, handleUpload }
}
