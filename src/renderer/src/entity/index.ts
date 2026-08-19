export * from './BaseEntity'

export * from './setting'
export * from './ai'
export * from './project'

/*
## 工作目录

~/.mistrelle

|- soul                      # 记忆系统（@see modules/memory）
  |- MEMORY.md               # 长期记忆：LLM 每日合并短期记忆生成，≤ 4000 字
  |- memory                  # 短期记忆：按天累积的提取条目与对话主动记录
    |- 2026-08-18.md
    |- 2026-08-19.md
    |- ...
  |- state.json              # 记忆状态：开关 / 合并边界 / 各会话提取进度
|- project                    # 项目目录 @see project
|- workspace                  # 工作空间 @see ai
|- design                     # 设计风格 @see AiDesignStyle
  |- index.json               # 索引文件，记录着列表中需要展示的信息
  |- design-20260812103316.json

*/
