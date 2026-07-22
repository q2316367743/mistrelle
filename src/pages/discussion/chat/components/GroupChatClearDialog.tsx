import { DialogPlugin } from 'tdesign-vue-next'

/** 逻辑清空聊天记录确认弹窗：数据保留，仅界面隐藏 */
export const confirmClearLog = (onConfirm: () => void | Promise<void>) => {
  const dp = DialogPlugin.confirm({
    header: '清空聊天记录',
    body: '逻辑清空后消息仍保留在本地，仅在界面中隐藏。是否继续？',
    confirmBtn: '清空',
    theme: 'warning',
    onConfirm: () => {
      Promise.resolve(onConfirm()).then(() => dp.destroy())
    }
  })
}

/** 完全清空聊天缓存确认弹窗：永久删除 chat.json 与 memory */
export const confirmClearCache = (onConfirm: () => void | Promise<void>) => {
  const dp = DialogPlugin.confirm({
    header: '清空缓存',
    body: '此操作将永久删除当前讨论组的所有聊天记录与记忆，且不可恢复。是否继续？',
    confirmBtn: '彻底清空',
    theme: 'danger',
    onConfirm: () => {
      Promise.resolve(onConfirm()).then(() => dp.destroy())
    }
  })
}
