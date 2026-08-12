export async function isDarkColors(): Promise<boolean> {
  return window.preload.inject.os.isDarkColors()
}

export interface UserProfile {
  avatar: string
  nickname: string
  // 是否是会员
  type: 'member' | 'user'
}

export const getUserProfile = async (): Promise<UserProfile> => {
  if (window.preload.inject.getPlatform() === 'ZTools') {
    return { avatar: './logo.png', nickname: '用户', type: 'user' }
  }
  const user = await window.preload.inject.os.getUser()
  return {
    avatar: user?.avatar || './logo.png',
    nickname: user?.nickname || '用户',
    type: (user?.type as 'member') || 'user'
  }
}

export const copyText = (text: string) => window.preload.inject.clipboard.copyText(text)

export const openUrlByBrowser = (url?: string) => {
  if (!url) return
  if (window.preload.inject.getPlatform() === 'ZTools') return
  window.preload.inject.shell.openExternal(url)
}
