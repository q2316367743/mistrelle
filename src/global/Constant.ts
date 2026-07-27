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


export const LOADING_TEXTS = [
  '正在努力思考中…',
  '正在思考人生…',
  '正在分析数据…',
  '正在翻阅知识库…',
  '正在构思回答…',
  '正在连接神经元…',
  '正在给大脑加个速…',
  '正在整理思维碎片…',
  '正在召唤灵感精灵…',
  '正在穿越信息海洋…',
  '正在拼凑答案碎片…',
  '正在向宇宙发送请求…',
  '正在喂饱神经网络…',
  '正在泡一杯电子咖啡…',
  '正在给逻辑链条上油…',
  '正在唤醒沉睡的知识…',
  '正在把问号拉直成感叹号…',
  '正在用算法按摩脑细胞…',
  '正在调取平行宇宙的答案…',
  '正在把0和1排成队…'
]

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

export const getAppData2Discussion = () => {
  return window.preload.path.join(getAppData(), 'discussion')
}

// ~/.mistrelle
export const getDataFolder  = () => {
  return window.preload.path.join(
    window.preload.inject.os.getPath('home'),
    `.${Constant.id}`
  )
}
export const getDataForWorkspace = () => {
  return window.preload.path.join(getDataFolder(), 'workspace')
}

// ~/.mistrelle/project
export const getAppData2Project = () => {
  return window.preload.path.join(getDataFolder(), 'project')
}
