export interface SettingAccount {
  /**
   *
   */
  avatar: string
  /**
   * 用户名
   */
  nickname: string
  /**
   * SkillHub 的 API keys
   * @see <https://skillhub.cn/dashboard/keys>
   */
  skillhub: string
  /**
   * Context7 的 API Key（可选）
   * 用于代码开发类型下获取第三方类库最新文档；留空则使用免 key 的匿名额度（限流更紧）
   * @see <https://context7.com>
   */
  context7: string
}

export function buildSettingAccount(): SettingAccount {
  return {
    avatar: '',
    nickname: '用户',
    skillhub: '',
    context7: ''
  }
}
