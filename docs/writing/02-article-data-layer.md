# 02 文章数据层与工具

> 文章创作场景的数据层：结构化索引（project.json）+ 正文（drafts/*.md）+ 配图（assets/），以 article_* 工具驱动，store 与侧边栏共享响应式。

## 目录结构

```
articles/                       # 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/
├── project.json                # 项目管理索引（结构化）
├── drafts/                     # 正文 .md（drafts/{id}.md）
└── assets/                     # 配图（design 子 Agent 导出于此）
```

## 数据模型（articleTypes.ts）

```ts
type ArticlePlatform = '公众号' | '知乎' | '小红书' | '其他'
type ArticleStatus = 'draft' | 'writing' | 'done'

interface ArticleItem {
  id: string
  title: string
  platform: ArticlePlatform
  status: ArticleStatus
  file: string                    // 相对 articles/ 的正文路径，如 drafts/xxx.md
  summary?: string                // 一句话选题 / 摘要
  outline?: string                // 提纲
  words?: number                  // 字数（article_stats 回写）
  cover?: string                  // 封面相对路径
  images?: string[]               // 配图相对路径列表
}

interface ArticleProject { schema: 1; title: string; updatedTime: number; articles: ArticleItem[] }
```

## Store（articleStore.ts）

- 按 **root 键控** 的全局单例（`getArticleStore(root)`），工具与侧边栏共享同一响应式实例（仿 CanvasStore）。
- `refresh()` 幂等：project.json 不存在时自动创建空项目落盘，侧边栏挂载即可用。
- 每次变更自动落盘 project.json，重启聊天可恢复。
- 变更方法：`init` / `createArticle` / `updateArticle` / `removeArticle` / `readArticle` / `countWords`。
- `buildArticleRoot(workspace, sandboxDir)`：项目根定位（有 workspace 用 workspace，否则沙盒 outputs/），供工具与侧边栏复用。

## 工具契约（articleTools.ts）

场景级注入（`WRITING_SCENE_CONFIG.article.tools`），`internal: true`、不进 toolMap，只经场景注入到主 Agent。

| 工具 | 参数 | 说明 |
|---|---|---|
| `article_init` | title? | 初始化项目（幂等），可命名 |
| `article_list` | — | 列出全部文章（含平台/状态/字数/封面/配图） |
| `article_create` | title / platform? / summary? / outline? | 新建文章：创建 drafts/{id}.md + 登记，返回 id 与 file |
| `article_update` | id / title? / platform? / status? / summary? / outline? / cover? / images? | 更新元信息（白名单字段，排除 id/file/words） |
| `article_read` | id | 读取正文 markdown |
| `article_stats` | id | 统计字数（去空白字符数）并回写 words |
| `article_remove` | id | 删除登记 + 正文文件 |

**安全策略**：`article_*` 只读写项目根可信区，mode=0 默认放行（仿 canvas）；模式 / 黑名单覆盖层仍生效。

## 创作工作流 prompt（articlePrompt.ts）

- 流程：`article_init` → 选题/平台 → `article_create` → `file_write` 正文 → `spawn_agent(type=design)` 配图 → `article_update` 登记 cover/images → `article_stats` + 状态 done。
- 平台差异化模板：公众号（钩子标题/小标题/金句加粗）、知乎（观点+案例）、小红书（emoji/短段/话题标签）。
- 相对路径约定：正文内图片一律 `../assets/xxx.png`（相对 drafts/），禁止绝对路径，保证导出可移植。

## 接入点

- `writingScene.ts`：`article.prompt = ARTICLE_SCENE_PROMPT`；`article.tools = createArticleTools`。
- `chatType.ts`：`ChatTypeToolContext` 新增 `getWorkspace`（文章项目优先落工作空间）。
- `AgentChat.ts`：`typeToolsContext()` 统一构造 ctx（getSandboxDir / getWorkspace / writingScene）。

## 关键文件

- `src/modules/tool/components/article/articleTypes.ts` / `articleStore.ts` / `articleTools.ts` / `articlePrompt.ts`
