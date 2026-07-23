export interface SettingDefault {
  /**
   * 默认助手模型
   * > 创建新助手时使用的模型
   */
  defaultAssistantModel: string
  /**
   * 默认快速模型
   * > 执行话题明明/搜索关键字提炼等简单任务时使用的模型
   */
  defaultQuickModel: string
  /**
   * 默认翻译模型
   * > 翻译服务使用的模型
   */
  defaultTranslateModel: string
  /**
   * 默认向量模型
   * > 全局记忆使用的模型
   */
  defaultVectorModel: string
  /**
   * 默认视频模型
   * > 视频服务使用的模型
   */
  defaultVideoModel: string
  /**
   * 默认音频模型
   * > 音频服务使用的模型
   */
  defaultAudioModel: string
  /**
   * 扫描 Skill 目录时忽略的文件夹名
   */
  skillIgnoreDirs: string[]
}

export function buildSettingDefault(): SettingDefault {
  return {
    defaultAssistantModel: '',
    defaultQuickModel: '',
    defaultTranslateModel: '',
    defaultVectorModel: '',
    defaultVideoModel: '',
    defaultAudioModel: '',
    skillIgnoreDirs: ['.git', '.svn', 'node_modules', '.hg', '.idea', '.vscode', 'dist', '.next', 'build']
  }
}
