# 05 短篇小说场景（novelShort）

> writing 第二子场景：短篇小说创作。每篇小说一个子目录，含正文 + 角色 / 大纲 / 背景设定 / 文风四个设定文件；相对长篇小说精简掉伏笔 / 暗线 / 时间线 / 多卷分层等机制。

## 场景定义

`writingScene = 'novelShort'`（`src/modules/chat/writingScene.ts`），label「短篇小说」，icon `BookOpenIcon`。
项目根：`{workspace}/novels/`（有工作空间）或 `{sandbox}/outputs/novels/`（无工作空间），与未来 `novelLong` 共用 `novels/` 根目录。

## 目录结构（每篇小说一个子目录）

```
novels/                       # 项目根
├── project.json              # 项目索引（结构化）
└── {novelId}/                # 每篇小说一个子目录
    ├── story.md              # 正文（分章可选，用一级标题 #）
    ├── outline.md            # 故事大纲（核心冲突 + 起承转合）
    ├── characters.md         # 角色卡（每个角色一个「## 角色名」段落）
    ├── setting.md            # 背景设定 + 主题与核心冲突
    └── style.md              # 写作风格 / 文风（叙事视角 / 语言风格 / 节奏）
```

`NOVEL_FILES` 常量为文件键单一数据源（`novelTypes.ts`），`NovelFileKey = keyof typeof NOVEL_FILES`。
`NOVEL_FILE_SKELETONS`（`novelStore.ts`）为 `novel_create` 落盘的骨架模板，给 AI 明确结构指引，之后用 `file_write` 覆盖。

## 数据模型（novelTypes.ts）

```ts
type NovelStatus = 'draft' | 'writing' | 'done'

interface NovelItem {
  id: string
  title: string
  genre: string          // 题材（科幻 / 言情 / 悬疑...）
  status: NovelStatus
  dir: string            // 子目录相对 novels/ 根，即 {id}
  summary?: string       // 一句话创意
  words?: number         // 预留
}

interface NovelProject { schema: 1; title: string; updatedTime: number; novels: NovelItem[] }
```

## Store（novelStore.ts）

- 按 **root 键控** 全局单例（`getNovelStore(root)`），工具与侧边栏共享同一响应式实例（仿 ArticleStore）。
- `refresh()` 幂等、每次变更自动落盘 project.json。
- 方法：`init` / `createNovel`（建子目录 + 5 骨架文件）/ `updateNovel` / `removeNovel`（删整个子目录）/ `readNovelFile` / `writeNovelFile` / `readStory` / `readSetting` / `upsertCharacter`。
- **角色卡 upsert**：`## {name}` 段已存在则整体替换（到下一个 `##` 或文件尾），否则追加到 characters.md 末尾（`replaceSection` 实现）。
- `buildNovelRoot(workspace, sandboxDir)` / `buildNovelFilePath(root, id, file)` 供工具与侧边栏复用。

## 工具契约（novelTools.ts）

场景级注入（`WRITING_SCENE_CONFIG.novelShort.tools`），`internal: true`、安全策略 allow（只读写项目根可信区）。

| 工具 | 参数 | 说明 |
|---|---|---|
| `novel_init` | title? | 初始化项目（幂等），可命名 |
| `novel_list` | — | 列出全部小说（标题/题材/状态/摘要） |
| `novel_create` | title / genre / summary? | 建子目录 + 5 骨架文件，返回 id 与文件路径列表 |
| `novel_update` | id / title? / genre? / status? / summary? | 更新元信息（白名单，排除 id/dir/words） |
| `novel_read` | id | 读正文 story.md |
| `novel_read_setting` | id | 汇总读 4 个设定文件，正文写作前注入上下文 |
| `novel_character_upsert` | id / name / content | 角色卡增改（## 段替换或追加） |
| `novel_remove` | id | 删除登记 + 整个子目录 |

设定文件（outline / setting / style）由 AI 用 `file_write` 直接写对应路径，工具面最小化（与 article 正文写法的既有模式一致）。

## 提示词要点（novelPrompt.ts）

- 定位：短篇完整叙事（数千~数万字）、单核心冲突、起承转合结构完整、角色精简（2~6 个）、设定服务情节。
- 工作流：`novel_init` → 定题材/主题/核心冲突 → `novel_create` → 建设定（角色 `novel_character_upsert` + `file_write` 三个设定文件）→ 正文前 `novel_read_setting` 加载 → 写 story.md → `novel_update` done。
- **相对长篇差异（写进提示词）**：单线推进，不建伏笔/暗线/时间线；设定轻量只取服务本篇的部分；结尾收束干净。

## 侧边栏（NovelAside.vue）

```
src/components/chat/aside/writing/novelShort/
├── NovelAside.vue              # 容器：header 下拉选小说 + 双布局切换 + 自动刷新
└── components/
    ├── NovelEditor.vue         # 全屏编辑：tiptap markdown 编辑器（复用 ArticleEditor，不启用图片）
    ├── NovelSettingTabs.vue    # 非全屏：t-tabs 五页签（正文/角色/大纲/设定/文风），ChatContent 渲染
    └── NovelSettingTree.vue    # 全屏：左侧设定导航树（含角色卡列表），右侧编辑器
```

- **header**：小说下拉（标题 + 题材 tag + 状态 tag）/ 刷新 / 在文件夹中显示（复用 ArticleAside 交互）。
- **非全屏**：t-tabs 五页签，内容用 `ChatContent`（`@tdesign-vue-next/chat`，marked + hljs 高亮）做 markdown 渲染，滚动预览。
- **全屏**：「左设定树 + 右编辑器」双栏（仿 DesignAside split），右侧 tiptap `mode=edit`，切换文件前先落盘待写内容再重读。

### AI 联动自动刷新

- **自动选中新小说**：`watch` project.novels 增量（以 `reload` 后 id 集合为基线），AI `novel_create` 新增且当前未选中时自动选中最新一部。
- **当前文件自动刷新**：`setInterval` 3s 轮询当前文件 `stat().mtime`，变化则重读并更新内容（AI `file_write` / `novel_*` 写入后自动反映到侧边栏）。
- **编辑保护**：`dirtyFile` 标记当前文件是否有未落盘编辑；编辑中跳过自动刷新，避免覆盖用户输入；切换小说 / 文件前 `flushPendingSave()` 显式落盘。
- 列表元信息（标题 / 题材 / 状态）走 store 响应式（`novel_*` 变更实时驱动），无需轮询。

## 接入点

- `writingScene.ts`：`WritingScene` 增 `novelShort` + `WRITING_SCENE_OPTIONS` 选项。
- `ChatTypeConfig.ts`：`WRITING_SCENE_CONFIG.novelShort = { prompt: NOVEL_SCENE_PROMPT, tools: createNovelTools }`。
- `WritingAside.vue`：按 `writingScene` 分发 ArticleAside / NovelAside。
- `ChatService.aiChatSandbox`：`writing + novelShort` 预建 `outputs/novels/`（小说子目录由 `novel_create` 创建）。

## 关键文件

- `src/modules/tool/components/novel/novelTypes.ts` / `novelStore.ts` / `novelTools.ts` / `novelPrompt.ts`
- `src/components/chat/aside/writing/novelShort/NovelAside.vue` 及 `components/`
