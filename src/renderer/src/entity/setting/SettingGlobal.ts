export interface BgConfig {
  type: 'solid' | 'gradient' | 'image' | 'video'
  value: string
  opacity?: number
}

export interface SettingGlobal {
  bgNewLight: BgConfig
  bgChatLight: BgConfig
  bgNewDark: BgConfig
  bgChatDark: BgConfig
}

export function buildSettingGlobal(): SettingGlobal {
  const def: BgConfig = { type: 'solid', value: '' }
  return {
    bgNewLight: { ...def },
    bgChatLight: { ...def },
    bgNewDark: { ...def },
    bgChatDark: { ...def }
  }
}
