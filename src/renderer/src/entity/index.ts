export * from './BaseEntity'

export * from './setting'
export * from './ai'

/*
## 工作目录

~/.mistrelle

|- soul                      # 记忆系统（@see modules/memory）+ 个性化设定（@see modules/personalize）
  |- MEMORY.md               # 长期记忆：LLM 每日合并短期记忆生成，≤ 4000 字
  |- IDENTITY.md             # 个性化：身份与风格（所有对话）
  |- DESIGN.md               # 个性化：设计偏好（design / ppt 对话）
  |- WRITE.md                # 个性化：写作偏好（writing 对话）
  |- AGENT.md                # 个性化：行为准则（所有对话）
  |- USER.md                 # 个性化：用户画像（所有对话）
  |- memory                  # 短期记忆：按天累积的提取条目与对话主动记录
    |- 2026-08-18.md
    |- 2026-08-19.md
    |- ...
  |- state.json              # 记忆状态：开关 / 合并边界 / 各会话提取进度
|- workspace                  # 工作空间 @see ai
|- design                     # 设计风格 @see AiDesignStyle
  |- index.json               # 索引文件，记录着列表中需要展示的信息
  |- design-20260812103316.json

*/
