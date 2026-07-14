export function isDarkColors(): boolean {
  return utools.isDarkColors()
}

interface UserProfile {
  avatar: string
  nickname: string
  // 是否是会员
  type: 'member' | 'user'
}

export const getUserProfile = (): UserProfile => {
  if (window.preload.getPlatform() === 'ZTools') {
    return { avatar: './logo.png', nickname: '用户', type: 'user' }
  }
  const user = utools.getUser()
  return {
    avatar: user?.avatar || './logo.png',
    nickname: user?.nickname || '用户',
    type: (user?.type as 'member') || 'user'
  }
}

export const copyText = (text: string) => utools.copyText(text)
