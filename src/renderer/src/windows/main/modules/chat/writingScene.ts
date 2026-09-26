/**
 * 写作子场景（writing 家族内部分层，新建对话时选定，创建后锁定；存储于聊天 content JSON）：
 * - article：文章创作（项目管理：文章列表 / 状态 / 平台 / 配图，writing 家族默认场景）
 * - novelShort：短篇小说创作（项目管理：每篇小说含角色 / 大纲 / 设定 / 文风五个设定文件）
 * - gzh：微信公众号创作（与 article 共享文章项目库，公众号体裁 skill + 排版 / 质检侧边栏）
 * - xhs：小红书创作（与 article 共享文章项目库，图文产出走画布画板 + 小红书 skill 与画板侧边栏）
 * 未来可扩展 novelLong（长篇小说）等场景：在 chat/scenes/ 增加叶子定义并在注册表登记。
 */
export type WritingScene = 'article' | 'novelShort' | 'gzh' | 'xhs'
