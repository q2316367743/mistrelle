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
  return { avatar: './logo.png', nickname: '用户', type: 'user' }
}

export const copyText = (text: string) => window.preload.inject.clipboard.copyText(text)

export const openUrlByBrowser = (url?: string) => {
  if (!url) return
  window.preload.inject.shell.openExternal(url)
}
