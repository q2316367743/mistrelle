# 02 文章数据层与工具

> 文章创作场景的数据层：结构化索引（project.json）+ 正文（drafts/*.md）+ 配图（assets/），以 article_* 工具驱动，store 与侧边栏共享响应式。
> **模型（2026-09-13，schema=2；同日三次迭代）**：一篇文章 = 一个主题，可有多个「类型」（发布平台，AI 自由命名，标题+类型唯一）；每个类型拥有独立的版本序列与正文。**status 字段已整体删除**（用户拍板无作用，旧数据读时剔除不迁移）；类型由 AI 设定，用户端只能查看与切换。旧结构不迁移（读时 types 置空，AI 重建）。
> **单元模型（2026-09-14，用户拍板）**：**「标题 + 类型 + 版本」= 唯一单元，版本 id 即单元标识**——`article_create` 创建单元返回 id，`article_write` / `article_read` / `article_stats` / `article_update` / `article_remove` 只认 id（不传 type）；新建版本返回新 id，后续写入新 id。`ArticleVersion.no` 为显式版本号（删除中间版本不影响既有编号）。

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

/** 文章版本（单个类型内的正文迭代快照）；版本 id 即「标题+类型+版本」单元标识 */
interface ArticleVersion {
  id: string                    // nanoid（全局唯一）；旧数据 {articleId}-base 跨类型撞 id，读时归一化去重重发
  no: number                    // 显式版本号（同类型内递增，创建时 max+1；缺失按索引补齐）
  file: string                  // 相对 articles/，如 drafts/{articleId}-{nanoid}.md
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

- **工具面按版本 id（单元 id）寻址**：`article_write` 覆盖写该版本 file、`newVersion=true` 在所属类型下建 rewrite 新版本并返回新 id；写入后该版本设为激活版本 + bump `contentRevs`（侧边栏自动切过去呈现）。
- `ArticleTypeEntry.file` **恒等于该类型当前激活版本的 file**（侧边栏展示与用户手动编辑沿 `file` 走）。
- 去 AI 味 / 重写等迭代**每次产生新版本**（新 md 文件），原版本内容不动；**用户手动编辑永不自动建版**（防抖覆盖保存到激活版本文件），版本只由显式动作产生。
- 读时归一化：某类型条目无 `versions` 时自动合成 V1 原稿，激活版本失效回落最后一个，`no` 缺失按索引补齐，**版本 id 全局去重**（旧 `{articleId}-base` 跨类型撞 id 时重发 nanoid 并同步激活引用），仅真正变化时落盘一次。
- **旧数据不迁移**（用户拍板）：无 `types` 数组的 schema=1 文章读时置 `types = []`（保留 title/summary/outline，遗留 platform/file/versions 等字段序列化时剔除），版本需 AI 重建；类型条目上遗留的 `status` 键同样读时剔除（字段已废弃）。

## Store（articleStore.ts）

- 按 **root 键控** 的全局单例（`getArticleStore(root)`），工具与侧边栏共享同一响应式实例（仿 CanvasStore）。
- `refresh()` 幂等：project.json 不存在时自动创建空项目落盘；解析后执行读时归一化（含旧结构清退）。
- 每次变更自动落盘 project.json，重启聊天可恢复。
- `contentRevs`：内存 reactive `Map<"${id}::${type}", number>`（不落盘）——`writeContent` 写入后递增，侧边栏 watch 即时重读（详见 03 号文档「数据流与自动联动」）。
- 文章级方法：`init` / `createArticle`（**创建「标题+类型+版本」单元**：按标题找/建文章、按类型找/建条目（缺省「其他」）、版本号缺省自动（新条目=1、已有条目=最新 no+1，同号已存在幂等复用返回已有 id），返回 `{id, title, type, version}`）/ `updateUnit`（按单元 id 更新：title/summary/outline 文章级、cover/images 类型级）/ `removeArticle`（按单元 id 解析所属文章，删除登记 + **全部类型全部版本** md 文件）。
- 类型级方法：`updateType`（cover/images，类型不存在自动创建；侧边栏 patchType 用）。`addType` / `updateArticle` 已删（前者用户端不新增类型；后者被 `updateUnit` 取代）。
- 单元方法（按版本 id）：`writeContent(id, content, asNewVersion?)`（**AI 写正文主通道**）、`readArticle(id)`（侧边栏 loadContent 也走它）、`countWords(id)`（回写 version.words，激活版本同步 entry.words）。
- 版本方法（articleId + type，侧边栏用）：`createVersion` / `switchVersion` / `removeVersion`（至少保留 1 个；删激活版本回落最后一个）/ `patchVersion`。
- `resolveVersion(id)`（私有）：全项目按版本 id 解析 `{article, entry, version}`，找不到抛错提示 article_list；`writeContent` / `readArticle` / `countWords` / `updateUnit` / `removeArticle` 均经它寻址。
- `buildArticleRoot(workspace, sandboxDir)`：项目根定位（有 workspace 用 workspace，否则沙盒 outputs/），供工具与侧边栏复用。

## 工具契约（articleTools.ts）

场景级注入（`WRITING_SCENE_CONFIG.article.tools`），`internal: true`、不进 toolMap，只经场景注入到主 Agent。

| 工具 | 参数 | 说明 |
|---|---|---|
| `article_init` | title? | 初始化项目（幂等），可命名 |
| `article_list` | — | 列出全部文章：标题/摘要/提纲/各类型（平台/封面/配图）及版本列表（每版本含单元 id、版本号、来源、字数）。AI 从这里拿单元 id |
| `article_create` | title / type? / version? / summary? / outline? | 创建「标题+类型+版本」单元返回 id：同标题归入同一篇文章（可更新 summary/outline）；类型缺省「其他」；版本缺省自动（新类型=1、已有类型=最新+1、同号幂等复用） |
| `article_write` | id / content / newVersion? | **写正文主通道（无需 type）**：默认覆盖该版本（原文上改）；newVersion=true 另存 rewrite 新版本并**返回新 id**，后续写新 id。写完 bump contentRevs 驱动侧边栏即时呈现并切到该版本 |
| `article_update` | id / title? / summary? / outline? / cover? / images? | 按单元 id 定位：title/summary/outline 文章级；cover/images 作用于单元所属类型。status 参数已删 |
| `article_read` | id | 读取该单元（版本）正文 markdown |
| `article_stats` | id | 统计该单元字数（去空白字符数）并回写 version.words |
| `article_remove` | id | 删除单元所属整篇文章（同标题全部类型与版本：登记 + 正文 md 文件） |

**安全策略**：`article_*` 只读写项目根可信区，mode=0 默认放行（仿 canvas）；模式 / 黑名单覆盖层仍生效。

## 创作工作流 prompt（articlePrompt.ts）

- 流程：`article_init` → 选题 → `article_create`（标题+类型+版本，拿单元 id）→ `article_write`（id + content）正文（首次直接覆盖）→ 修改：默认覆盖同 id、要保留原稿 `newVersion=true` 拿新 id 后续写新 id → 追加平台版：`article_create` 同标题 + 新类型（版本 1）拿新 id（先 `article_read` 已有版本保持选题一致）→ `spawn_agent(type=design)` 配图 → `article_update(id, cover/images)` 登记 → `article_stats(id)` 收尾。
- **侧边栏联动约定（prompt 已强调）**：正文一律 `article_write`，不要用 `file_write` 直写正文文件（侧边栏感知不到）。重写 / 换平台迭代由用户在聊天中直接提出（侧边栏无重写按钮）。
- 平台差异化模板绑定 type：公众号（钩子标题/小标题/金句加粗）、知乎（观点+案例）、小红书（emoji/短段/话题标签）、其他（通用结构化）。
- 相对路径约定：正文内图片一律 `../assets/xxx.png`（相对 drafts/），禁止绝对路径，保证导出可移植。

## 接入点

- `writingScene.ts`：`article.prompt = ARTICLE_SCENE_PROMPT`；`article.tools = createArticleTools`。
- `chatType.ts`：`ChatTypeToolContext` 新增 `getWorkspace`（文章项目优先落工作空间）。
- `AgentChat.ts`：`typeToolsContext()` 统一构造 ctx（getSandboxDir / getWorkspace / writingScene）。

## 关键文件

- `src/modules/tool/components/article/articleTypes.ts` / `articleStore.ts` / `articleTools.ts` / `articlePrompt.ts`
