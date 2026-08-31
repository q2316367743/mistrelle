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
}

export function buildSettingAccount(): SettingAccount {
  return {
    skillhub: '',
    zhihu: ''
  }
}
