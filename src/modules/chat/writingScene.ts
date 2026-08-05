import type { ToolFunction } from '@/domain'
import type { ChatTypeToolContext } from '@/modules/chat/chatType'

/**
 * 写作子场景（writing 聊天类型内部分层，新建对话时选定，创建后锁定）：
 * - free：自由写作（文档树 + 编辑器，现状行为）
 * - article：文章创作（项目管理：文章列表 / 状态 / 平台 / 配图）
 * 未来可扩展 novel（小说创作）等场景，只改本配置表。
 */
export type WritingScene = 'free' | 'article'

export const WRITING_SCENE_LABEL: Record<WritingScene, string> = {
  free: '自由写作',
  article: '文章创作'
}

export interface WritingSceneConfig {
  /** 具体名字，eg. 文章创作 */
  label: string
  /** 场景固定提示词（场景创建后锁定 → 可进稳定 system 前缀，不影响 prompt 缓存） */
  prompt: string
  /** 场景工具工厂（article → article_* 管理工具；free 无场景工具） */
  tools: (ctx: ChatTypeToolContext) => ToolFunction[]
}

/**
 * 写作子场景单一数据源（类 CHAT_TYPE_CONFIG 风格）。
 * 场景提示词场景内固定、创建后锁定，可安全进入稳定 system 前缀保证缓存命中。
 */
export const WRITING_SCENE_CONFIG: Record<WritingScene, WritingSceneConfig> = {
  free: {
    label: '自由写作',
    // 自由写作无额外场景指令，保持既有行为
    prompt: '',
    tools: () => []
  },
  article: {
    label: '文章创作',
    prompt: [
      '## 文章创作模式',
      '你是专业自媒体内容创作助手，面向公众号 / 知乎 / 小红书等平台的文章写作。',
      '',
      '### 创作工作流',
      '1. 明确选题、目标平台与读者定位，产出文章提纲（标题 / 结构 / 核心要点）',
      '2. 撰写正文，保存为项目 articles/drafts/ 目录下的 .md 文件',
      '3. 文章需要配图时，调用 spawn_agent(type="design") 委托设计型子 Agent 创作，图片保存到项目 articles/assets/ 目录',
      '4. 完成后告知文章完整路径与配图清单',
      '',
      '### 文件约定',
      '- 正文统一写入 articles/drafts/ 下的 .md',
      '- 配图统一保存到 articles/assets/',
      '- 正文中引用配图必须用相对路径（如 ../assets/xxx.png），禁止写入绝对路径，保证文章可导出、可移植'
    ].join('\n'),
    tools: () => []
  }
}
