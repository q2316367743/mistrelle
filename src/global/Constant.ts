export const Constant = {
  // 插件的ID
  uid: 'zimjyydo',
  // 项目名称，英文名称
  id: 'mistrelle',
  // 项目中文名称
  name: '半窗烟雨',
  // 版本
  version: '1.0.0',
  // 作者
  author: '落雨不悔',
  // 仓库
  repo: ''
}

export const getAppData = () => {
  return window.preload.path.join(
    window.preload.inject.os.getPath('appData'),
    window.preload.inject.getPlatform(),
    Constant.id
  )
}

export const getAppData2Chat = () => {
  return window.preload.path.join(getAppData(), 'chat')
}

export const getAppData2Group = () => {
  return window.preload.path.join(getAppData(), 'group')
}
