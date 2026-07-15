export function isDarkColors(): boolean {
  return window.preload.inject.os.isDarkColors()
}

interface UserProfile {
  avatar: string
  nickname: string
  // 是否是会员
  type: 'member' | 'user'
}

export const getUserProfile = (): UserProfile => {
  if (window.preload.inject.getPlatform() === 'ZTools') {
    return { avatar: './logo.png', nickname: '用户', type: 'user' }
  }
  const user = window.preload.inject.os.getUser()
  return {
    avatar: user?.avatar || './logo.png',
    nickname: user?.nickname || '用户',
    type: (user?.type as 'member') || 'user'
  }
}

export const copyText = (text: string) => window.preload.inject.clipboard.copyText(text)
