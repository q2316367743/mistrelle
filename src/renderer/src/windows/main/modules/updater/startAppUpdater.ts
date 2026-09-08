import { useSettingGlobalStore } from '@/windows/main/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'

let started = false
let prompting = false

async function promptDownload(state: UpdaterState): Promise<void> {
  if (prompting) return
  prompting = true
  try {
    const version = state.availableVersion ?? ''
    await MessageBoxUtil.confirm(`发现新版本 ${version}，是否下载？`, '应用更新')
    await window.preload.updater.download()
  } catch {
    // 用户取消
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
