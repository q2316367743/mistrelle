/**
 * 更新弹窗命令式入口：独立挂载 Fluent 风格弹窗，返回用户选择。
 * confirm：builtin = 开始应用内下载；external = 由调用方打开网盘链接。
 */
import { createApp } from 'vue'
import UpdateDialog from './UpdateDialog.vue'

export type UpdateDialogAction = 'confirm' | 'cancel'

export function showUpdateDialog(state: UpdaterState): Promise<UpdateDialogAction> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let settled = false
    const finish = (result: UpdateDialogAction) => {
      if (settled) return
      settled = true
      app.unmount()
      container.remove()
      resolve(result)
    }
    const app = createApp(UpdateDialog, {
      state,
      onConfirm: () => finish('confirm'),
      onCancel: () => finish('cancel'),
    })
    app.mount(container)
  })
}
