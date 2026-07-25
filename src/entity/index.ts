export * from './BaseEntity'

export * from './setting'
export * from './note'
export * from './ai'
export * from './project'

/*
## 工作目录

~/.mistrelle

|- awareness                  # 意识
  |- main
    |- AGENTS.md              # 全局上下文：定义助手的工作规范和行为准则
    |- memory                 # 短期记忆：按天记录的对话摘要和临时笔记
      |- 2026-07-21.md
      |- 2026-07-22.md
      |- ...
    |- MEMORY.md              # 长期记忆：跨会话持久保存的重要指示和结论
    |- USER.md                # 用户信息
|- project                    # 项目目录 @see project
|- workspace                  # 工作空间 @see ai

*/
