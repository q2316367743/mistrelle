import { ref } from 'vue'
import dayjs from 'dayjs'
import { MessageUtil } from '@/utils/modal'
import { blobToBase64 } from '@/utils/file/CovertUtil'
import type { DropdownProps } from 'tdesign-vue-next'
import {
  buildDesignHtmlFileName,
  buildDesignHtmlOutputsDir,
  exportDesignHtmlPng,
  type HtmlDesignDoc
} from '@/windows/main/modules/designHtml'

/**
 * HTML 设计稿侧边栏的动作集合（复制图片 / 下载图片 / 复制源码 / 文件夹中显示），
 * 从 HtmlDesignAside 拆出以守单文件行数红线；导出统一走 exportDesignHtmlPng。
 */
export const useHtmlDesignActions = (options: {
  /** 当前设计稿 getter（复制图片 / 下载 / 复制源码的目标） */
  current: () => HtmlDesignDoc | undefined
  /** 已选版本号 getter（文件夹中显示定位文件；无当前稿时也可用） */
  selectedVersion: () => number | undefined
  sandbox: () => string
  workspace: () => string
}) => {
  const busy = ref(false)

  /** 复制当前设计稿为图片到剪贴板 */
  const handleCopy = async () => {
    const doc = options.current()
    if (!doc) return
    busy.value = true
    try {
      const blob = await exportDesignHtmlPng(doc)
      const dataUrl = await blobToBase64(blob)
      const ok = await window.preload.inject.clipboard.copyImage(dataUrl)
      if (ok) {
        MessageUtil.success('已复制到剪贴板')
      } else {
        MessageUtil.error('复制失败')
      }
    } catch (e) {
      MessageUtil.error('复制失败', e)
    } finally {
      busy.value = false
    }
  }

  /** 下载当前设计稿为图片（选择保存路径，文件名 title+时间戳） */
  const handleDownload = async () => {
    const doc = options.current()
    if (!doc) return
    busy.value = true
    try {
      const blob = await exportDesignHtmlPng(doc)
      const name = `${doc.title || doc.name || 'design'}-${dayjs().format('YYYYMMDDHHmmss')}.png`
      const path = await window.preload.inject.dialog.save({
        title: '保存设计稿图片',
        defaultPath: name,
        filters: [{ name: 'PNG 图片', extensions: ['png'] }]
      })
      if (!path) return
      await window.preload.fs.writeBinaryFile(path, await blob.arrayBuffer())
      MessageUtil.success('已保存设计稿图片')
    } catch (e) {
      MessageUtil.error('保存失败', e)
    } finally {
      busy.value = false
    }
  }

  const handleAction: DropdownProps['onClick'] = (data) => {
    if (data.value === 'copy') void handleCopy()
    else if (data.value === 'download') void handleDownload()
    else if (data.value === 'source') {
      const doc = options.current()
      if (!doc) return
      void window.preload.inject.clipboard.copyText(doc.html).then((ok) => {
        if (ok) MessageUtil.success('已复制 HTML 源码')
        else MessageUtil.error('复制失败')
      })
    } else if (data.value === 'folder') {
      const version = options.selectedVersion()
      if (version) {
        window.preload.inject.shell.showItemInFolder(
          window.preload.path.join(
            buildDesignHtmlOutputsDir(options.sandbox()),
            buildDesignHtmlFileName(version)
          )
        )
      } else {
        window.preload.inject.shell.openPath(
          options.workspace() || buildDesignHtmlOutputsDir(options.sandbox())
        )
      }
    }
  }

  return { busy, handleAction }
}
