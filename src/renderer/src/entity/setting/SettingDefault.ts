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
   * 记忆模型
   * > 提取与整理记忆时使用的模型（设置-记忆）；字段名为历史命名，实际语义已收敛为记忆系统专用
   */
  defaultSummaryModel: string
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
   * 默认图像模型
   * > 生图时使用的模型（服务端生图档位 code）
   */
  defaultImageModel: string
  /**
   * 扫描 Skill 目录时忽略的文件夹名
   */
  skillIgnoreDirs: string[]
}

export function buildSettingDefault(): SettingDefault {
  return {
    defaultAssistantModel: '',
    defaultQuickModel: '',
    defaultSummaryModel: '',
    defaultTranslateModel: '',
    defaultVectorModel: '',
    defaultImageModel: 'economy',
    skillIgnoreDirs: [
      '.git',
      '.svn',
      'node_modules',
      '.hg',
      '.idea',
      '.vscode',
      'dist',
      '.next',
      'build'
    ]
  }
}
