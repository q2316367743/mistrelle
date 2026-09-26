export interface SettingAccount {
  /**
   * SkillHub 的 API keys
   * @see <https://skillhub.cn/dashboard/keys>
   */
  skillhub: string
  /**
   * 知乎数据开放平台 Access Secret（zhihu_search 等接口鉴权）
   * @see <https://developer.zhihu.com/>
   */
  zhihu: string
  /**
   * 红狐 API Key（小红书热门笔记取数 xhs_hot_notes 鉴权）
   * @see <https://redfox.hk/settings/api-keys>
   */
  redfox: string
}

export function buildSettingAccount(): SettingAccount {
  return {
    skillhub: '',
    zhihu: '',
    redfox: ''
  }
}
