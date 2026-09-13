import { useSettingGlobalStore } from '@/windows/main/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { openUrlByBrowser } from '@/utils/native/NativeUtil'
import { showUpdateDialog } from './updateDialog'

let started = false
let prompting = false

/** 弹统一更新弹窗：builtin 确认后应用内下载；external 确认后打开网盘链接。 */
async function promptDownload(state: UpdaterState): Promise<void> {
  if (prompting) return
  prompting = true
  try {
    const action = await showUpdateDialog(state)
    if (action !== 'confirm') return
    if (state.mode === 'external' && state.downloadUrl) {
      openUrlByBrowser(state.downloadUrl)
      return
    }
    await window.preload.updater.download()
  } catch {
    // 用户取消或弹窗异常
  } finally {
    prompting = false
  }
}

async function promptInstall(): Promise<void> {
  if (prompting) return
  prompting = true
  try {
    await MessageBoxUtil.confirm('更新已下载，重启后完成安装。', '应用更新')
    await window.preload.updater.quitAndInstall()
  } catch {
    // 用户取消
  } finally {
    prompting = false
  }
}

export async function startAppUpdater(): Promise<void> {
  if (started) return
  started = true
  const store = useSettingGlobalStore()
  await store.ready
  window.preload.updater.onChanged((state) => {
    if (state.status === 'downloaded') void promptInstall()
  })
  if (!store.state.autoCheckUpdate) return
  const state = await window.preload.updater.check()
  if (state.status === 'available') await promptDownload(state)
}

export async function checkAppUpdatesManually(): Promise<void> {
  const state = await window.preload.updater.check()
  if (state.status === 'available') {
    await promptDownload(state)
    return
  }
  if (state.status === 'downloaded') {
    await promptInstall()
    return
  }
  if (state.error) {
    MessageUtil.warning(state.error)
    return
  }
  MessageUtil.success('已是最新版本')
}

export async function installAppUpdate(): Promise<void> {
  await promptInstall()
}
