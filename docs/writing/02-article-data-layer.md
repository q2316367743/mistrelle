# 02 文章数据层与工具

> 文章创作场景的数据层：结构化索引（project.json）+ 正文（drafts/*.md）+ 配图（assets/），以 article_* 工具驱动，store 与侧边栏共享响应式。
> **模型（2026-09-13，schema=2；同日三次迭代）**：一篇文章 = 一个主题，可有多个「类型」（发布平台，AI 自由命名，标题+类型唯一）；每个类型拥有独立的版本序列与正文。**status 字段已整体删除**（用户拍板无作用，旧数据读时剔除不迁移）；类型由 AI 设定，用户端只能查看与切换。旧结构不迁移（读时 types 置空，AI 重建）。

## 目录结构

```
articles/                       # 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/
├── project.json                # 项目管理索引（结构化，schema=2）
├── drafts/                     # 正文 .md（drafts/{id}.md 或 drafts/{id}-{nanoid}.md，每类型每版本一个文件）
└── assets/                     # 配图（design 子 Agent 导出于此）
```

## 数据模型（articleTypes.ts）

```ts
const ARTICLE_TYPES: string[] = ['公众号', '知乎', '小红书', '其他']  // 推荐平台名（仅供工具描述/提示词文案，非类型约束）
type ArticleVersionSource = 'original' | 'humanize' | 'rewrite' | 'manual'  // 附 ARTICLE_VERSION_SOURCE_OPTIONS 中文映射

/** 文章版本（单个类型内的正文迭代快照） */
interface ArticleVersion {
  id: string                    // 初稿确定性 id：{articleId}-base；迭代版本 nanoid
  file: string                  // 相对 articles/，初稿 drafts/{id}.md 或 drafts/{id}-{nanoid}.md
  source: ArticleVersionSource
  label?: string                // 自定义名（缺省按 source 显示：原稿/去 AI 味/重写/手动）
  createdTime: number
  words?: number
}

/** 类型条目：一个平台 = 独立的版本序列与正文 */
interface ArticleTypeEntry {
  type: string                  // 平台名，AI 自由命名（normalizeType：trim + 空值回落「其他」），同一文章内唯一
  file: string                  // 恒等于该类型激活版本的 file（见下方契约）
  cover?: string                // 封面相对路径（16:9，随类型走）
  images?: string[]             // 配图相对路径列表（随类型走）
  versions?: ArticleVersion[]   // 版本列表（读时归一化兜底）
  activeVersionId?: string      // 激活版本 id（缺省回落最后一个）
  words?: number                // 字数（article_stats 回写）
}

/** 文章条目 = 一个主题 */
interface ArticleItem {
  id: string
  title: string
  summary?: string              // 一句话选题 / 摘要
  outline?: string              // 提纲（文章级，各类型写作共用）
  types: ArticleTypeEntry[]     // 类型列表（空 = 待创建）
}

interface ArticleProject { schema: 2; title: string; updatedTime: number; articles: ArticleItem[] }
```

**版本契约（重要）**：

- `ArticleTypeEntry.file` **恒等于该类型当前激活版本的 file** —— `article_read` / `article_stats` / `article_write`（覆盖模式）全部沿 `file` 走，AI 工具永远作用于激活版本。
- 去 AI 味 / 重写等迭代**每次产生新版本**（新 md 文件），原版本内容不动；**用户手动编辑永不自动建版**（防抖覆盖保存到激活版本文件），版本只由显式动作产生。
- 读时归一化：某类型条目无 `versions` 时自动合成 V1 原稿（`{articleId}-base`），激活版本失效回落最后一个，仅真正变化时落盘一次。
- **旧数据不迁移**（用户拍板）：无 `types` 数组的 schema=1 文章读时置 `types = []`（保留 title/summary/outline，遗留 platform/file/versions 等字段序列化时剔除），版本需 AI 重建；类型条目上遗留的 `status` 键同样读时剔除（字段已废弃）。

## Store（articleStore.ts）

- 按 **root 键控** 的全局单例（`getArticleStore(root)`），工具与侧边栏共享同一响应式实例（仿 CanvasStore）。
- `refresh()` 幂等：project.json 不存在时自动创建空项目落盘；解析后执行读时归一化（含旧结构清退）。
- 每次变更自动落盘 project.json，重启聊天可恢复。
- `contentRevs`：内存 reactive `Map<"${id}::${type}", number>`（不落盘）——`writeContent` 写入后递增，侧边栏 watch 即时重读（详见 03 号文档「数据流与自动联动」）。
- 文章级方法：`init` / `createArticle`（以 type 建首个类型条目，缺省「其他」）/ `updateArticle`（title/summary/outline）/ `removeArticle`（删除登记 + **全部类型全部版本** md 文件）。
- 类型级方法：`updateType`（cover/images，类型不存在自动创建）/ `readArticle(id, type)` / `countWords(id, type)`。`addType` 已删（用户端不再新增类型，AI 经 `writeContent` 自动创建）。
- 版本方法（均带 type）：`createVersion` / `switchVersion` / `removeVersion`（至少保留 1 个；删激活版本回落最后一个）/ `patchVersion`。
- `writeContent(id, type, content, asNewVersion?)`：**AI 写正文主通道**（article_write）。默认覆盖激活版本文件并同步 `words`；`asNewVersion=true` 走 `createVersion(source:'rewrite')`。完成即 bump `contentRevs`。
- `buildArticleRoot(workspace, sandboxDir)`：项目根定位（有 workspace 用 workspace，否则沙盒 outputs/），供工具与侧边栏复用。

## 工具契约（articleTools.ts）

场景级注入（`WRITING_SCENE_CONFIG.article.tools`），`internal: true`、不进 toolMap，只经场景注入到主 Agent。

| 工具 | 参数 | 说明 |
|---|---|---|
| `article_init` | title? | 初始化项目（幂等），可命名 |
| `article_list` | — | 列出全部文章（标题/摘要/提纲/类型列表，每类型含平台/字数/封面/配图） |
| `article_create` | title / type? / summary? / outline? | 新建文章：以 type（缺省其他）建首个类型条目 + drafts/{id}.md，返回 id |
| `article_write` | id / content / type? / newVersion? | **写正文主通道**：默认覆盖该类型当前版本；大改/重写必须 newVersion=true；**类型不存在自动创建**（为已有文章追加平台版，type 自由命名、同名复用）。写完 bump contentRevs 驱动侧边栏即时呈现 |
| `article_update` | id / title? / summary? / outline? / type? / cover? / images? | title/summary/outline 文章级；cover/images 类型级（作用于 type，缺省第一个类型，不存在自动创建）。status 参数已删 |
| `article_read` | id / type | 读取该类型当前激活版本正文 markdown（type 必填，article_list 可查已有类型） |
| `article_stats` | id / type | 统计该类型字数（去空白字符数）并回写 words |
| `article_remove` | id | 删除登记 + 全部类型全部版本正文文件 |

**安全策略**：`article_*` 只读写项目根可信区，mode=0 默认放行（仿 canvas）；模式 / 黑名单覆盖层仍生效。

## 创作工作流 prompt（articlePrompt.ts）

- 流程：`article_init` → 选题 → `article_create`（首个类型）→ `article_write` 正文（首次直接覆盖）→ 修改：小修覆盖、大改 `newVersion=true` → 追加平台版：`article_write` 带 type（自动创建，先 `article_read` 已有版本保持选题一致）→ `spawn_agent(type=design)` 配图 → `article_update(type, cover/images)` 登记 → `article_stats` 收尾。
- **侧边栏联动约定（prompt 已强调）**：正文一律 `article_write`，不要用 `file_write` 直写正文文件（侧边栏感知不到）；用户在侧边栏点「AI 重写」发来的指令，必须 `article_write` 且 `newVersion=true`。
- 平台差异化模板绑定 type：公众号（钩子标题/小标题/金句加粗）、知乎（观点+案例）、小红书（emoji/短段/话题标签）、其他（通用结构化）。
- 相对路径约定：正文内图片一律 `../assets/xxx.png`（相对 drafts/），禁止绝对路径，保证导出可移植。

## 接入点

- `writingScene.ts`：`article.prompt = ARTICLE_SCENE_PROMPT`；`article.tools = createArticleTools`。
- `chatType.ts`：`ChatTypeToolContext` 新增 `getWorkspace`（文章项目优先落工作空间）。
- `AgentChat.ts`：`typeToolsContext()` 统一构造 ctx（getSandboxDir / getWorkspace / writingScene）。

## 关键文件

- `src/modules/tool/components/article/articleTypes.ts` / `articleStore.ts` / `articleTools.ts` / `articlePrompt.ts`
