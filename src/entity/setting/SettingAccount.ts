export interface SettingAccount {
  /**
   * 用户名
   */
  nickname: string
  /**
   * SkillHub 的 API keys
   * @see <https://skillhub.cn/dashboard/keys>
   */
  skillhub: string
}

export function buildSettingAccount(): SettingAccount {
  return {
    nickname: '用户',
    skillhub: ''
  }
}
