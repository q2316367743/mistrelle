# 05 短篇小说场景（novelShort）

> writing 第二子场景：短篇小说创作。每篇小说一个子目录，含正文 + 角色 / 大纲 / 背景设定 / 文风四个设定文件；相对长篇小说精简掉伏笔 / 暗线 / 时间线 / 多卷分层等机制。
>
> **本场景为纯文本创作，工具面经过收窄**：file 类 / shell / 绘图 / 读图 / 生图型子 Agent 全部剔除，一切读写收敛到 `novel_*` 专用工具。封面改由侧边栏直呼生图接口。

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
    ├── style.md              # 写作风格 / 文风（叙事视角 / 语言风格 / 节奏）
    └── assets/               # 封面图（侧边栏生图 / 上传产物，按需创建）
```

`NOVEL_FILES` 常量为文件键单一数据源（`novelTypes.ts`），`NovelFileKey = keyof typeof NOVEL_FILES`；
`NOVEL_SETTING_FILE_KEYS`（`outline` / `setting` / `style`）为 AI 可写设定文件的子集。
`NOVEL_FILE_SKELETONS`（`novelStore.ts`）为 `novel_create` 落盘的骨架模板，给 AI 明确结构指引，之后用 `novel_write_setting` 覆盖。

## 数据模型（novelTypes.ts）

```ts
interface NovelItem {
  id: string
  title: string
  genre: string          // 题材（科幻 / 言情 / 悬疑...）
  dir: string            // 子目录相对 novels/ 根，即 {id}
  summary?: string       // 一句话创意
  words?: number         // 正文字数（novel_write / novel_stats 回写）
  cover?: string         // 封面相对 novels/ 的路径（{id}/assets/cover-xxx.png）
}

interface NovelProject { schema: 1; title: string; updatedTime: number; novels: NovelItem[] }
```

**status 三态已删除**（2026-09-14）：短篇流程中信息量低，与文章场景删除 status 口径一致；存量 `project.json` 中的该字段自然忽略，不做迁移。

## 工具契约（novelTools.ts）

场景级注入（`WRITING_SCENE_CONFIG.novelShort.tools`），`internal: true`、安全策略 allow（只读写项目根可信区）。
另在场景工具后追加 `humanize_text`（登录后注入，与 design 场景同源）。

| 工具 | 参数 | 说明 |
|---|---|---|
| `novel_init` | title? | 初始化项目（幂等），可命名 |
| `novel_list` | — | 列出全部小说（标题 / 题材 / 摘要 / 字数） |
| `novel_create` | title / genre / summary? | 建子目录 + 5 骨架文件，返回 id 与文件路径列表 |
| `novel_update` | id / title? / genre? / summary? | 更新元信息（白名单，排除 id/dir/words/cover） |
| `novel_write` | id / content / mode? | **写入正文 story.md**：`replace`（默认）整体覆盖，`append` 追加到末尾（续写用，避免重述全文），返回 words |
| `novel_write_setting` | id / file / content | 写入设定文件，`file` ∈ outline / setting / style，每次写完整内容 |
| `novel_read` | id | 读正文 story.md |
| `novel_read_setting` | id / file? | 不传 file 汇总读全部设定；传 file 单选（省 token） |
| `novel_stats` | id | 统计正文字数（去空白）并回写登记 |
| `novel_character_upsert` | id / name / content | 角色卡增改（## 段替换或追加） |
| `novel_remove` | id | 删除登记 + 整个子目录 |

**写入职责划分**：正文 → `novel_write`；设定（大纲/背景/文风）→ `novel_write_setting`；角色卡 → `novel_character_upsert`。三个入口互不重叠，降低模型选错工具的概率。

## 工具面收窄（本场景核心约定）

`ChatTypeConfig.ts` 的 `NOVEL_EXCLUDED_TOOLS` 声明本场景剔除的常驻工具，机制如下：

| 剔除项 | 原因 |
|---|---|
| `file_list` / `file_read` / `file_write` / `file_delete` / `file_mkdir` / `file_stat` / `file_glob` / `file_grep` | 写作只走 `novel_*`；file 类让模型有两个都能写文件的入口，显著拉低工具选择准确率 |
| `file_read_docx` / `file_read_xlsx` / `file_read_pdf` / `file_write_xlsx` | 纯文本创作场景用不上 |
| `cli_run` | **关键**：策略上可信区内免审批，重定向 / heredoc 可绕过 file 类的全部限制——只剔 file 类等于白做 |
| `load_tool_collection` | 会给模型一份 date / clipboard / browser / doc 的可装载目录，全是写作无关噪音 |
| `http_download` | 下载能力与写作无关（`http_request` / `any_search` / `browser_fetch` 保留作查资料） |
| `design_draw` | 纯文本体裁，写作会话内不需要绘图 |
| `image_read` | 无配图需求，读图能力用不上 |

**过滤必须同时作用于两层**（`agentFunctions.ts`）：
1. 请求侧 `buildBaseFunctions` / `applyLoadedCollections` —— 不下发被剔工具的 schema
2. 执行期 `resolveForExecution` 的注册表兜底 —— 被剔名字**不走 `toolRegistry` 查找、不自动复装其所属集合**

只做前者会让黑名单形同虚设：模型凭历史记忆直呼 `file_write_xlsx` 时，注册表兜底会把整个 `doc` 组放回来。

**配套：子 Agent 收窄为仅 research**（`subAgentAllow: ['research']`）。
`getSceneSubAgentAllow(chatType, writingScene)` 统一裁决，`agentFunctions.ts`（下发 type 枚举）与 `agentTools.ts`（执行期校验）共用；`ToolPolicyContext.writingScene` 由 `AgentChat.buildPolicyContext` 注入。
封面生图改由侧边栏直呼接口（见下），写作会话内不提供生图通道。

**提示词一致性**：`NOVEL_SCENE_PROMPT` 与 `CHAT_TYPE_CONFIG.writing.prompt`（按场景分流）已同步改写，不再出现 `file_write` / `design_draw` 指引——否则会诱导模型调用不存在的工具。
`agentPrompts.ts` 在场景剔除含 `load_tool_collection` 时，一并抑制 `<available_tool_collections>` 目录注入。

## Store（novelStore.ts）

- 按 **root 键控** 全局单例（`getNovelStore(root)`），工具与侧边栏共享同一响应式实例（仿 ArticleStore）。
- `refresh()` 幂等、每次变更自动落盘 project.json。
- 方法：`init` / `createNovel`（建子目录 + 5 骨架文件）/ `updateNovel` / `removeNovel` / `readNovelFile` / `writeNovelFile` / `readFile` / `readStory` / `readSetting` / **`writeStory`**（replace / append）/ **`countWords`** / `upsertCharacter` / **`buildAssetsDir`**。
- **`contentRevs`**（`reactive(Map)`，内存态不落盘）：写入后按 `${id}::${fileKey}` 递增，侧边栏 watch 该值即时重读，实现「AI 写完 → 侧边栏自动呈现」（对照 `ArticleStore.contentRevs`）。`writeNovelFile` / `writeStory` / `upsertCharacter` 均 bump。
- **角色卡 upsert**：`## {name}` 段已存在则整体替换（到下一个 `##` 或文件尾），否则追加到 characters.md 末尾（`replaceSection` 实现）。
- `buildNovelRoot(workspace, sandboxDir)` / `buildNovelFilePath(root, id, file)` 供工具与侧边栏复用。

## 提示词要点（novelPrompt.ts）

- 定位：短篇完整叙事（数千~数万字）、单核心冲突、起承转合结构完整、角色精简（2~6 个）、设定服务情节。
- 工具用法段落逐条说明 `novel_*` 与 `humanize_text`（与实际工具面严格对齐）。
- 工作流：`novel_init` → 定题材/主题/核心冲突 → `novel_create` → 建设定（角色 `novel_character_upsert` + `novel_write_setting` 三个设定文件）→ 正文前 `novel_read_setting` 加载 → `novel_write`（首次 replace、续写 append）→ `novel_stats` 汇报。
- **相对长篇差异（写进提示词）**：单线推进，不建伏笔/暗线/时间线；设定轻量只取服务本篇的部分；结尾收束干净。

## 侧边栏（novelShort/）

```
src/components/chat/aside/writing/novelShort/
├── NovelAside.vue              # 容器（只做装配，逻辑在 composable）
├── useNovelDoc.ts              # 数据层：store / 列表 / 当前文件 / 加载落盘 / 即时刷新 / 轮询兜底
├── useNovelAssist.ts           # 去 AI 味动作编排（流式覆盖当前文件）
└── components/
    ├── NovelHeader.vue         # 头部：封面缩略 + 小说下拉 + 文件夹 + 刷新
    ├── NovelCoverThumb.vue     # 封面：AI 生成 / 上传 / 移除（落 {id}/assets/）
    ├── NovelActions.vue        # 动作条：去 AI 味 / 文件夹 / 复制 / 实时字数
    ├── NovelEditor.vue         # 全屏编辑：tiptap markdown 编辑器（复用 ArticleEditor，不启用图片）
    ├── NovelSettingTabs.vue    # 非全屏：t-tabs 五页签（正文/角色/大纲/设定/文风），ChatContent 渲染
    └── NovelSettingTree.vue    # 全屏：左侧设定导航树（含角色卡列表），右侧编辑器
```

### AI 联动自动刷新（双通道）

- **即时通道**：watch `store.contentRevs.get(\`${id}::${fileKey}\`)` → AI 经 `novel_*` 写入后立即重读当前文件（编辑器内容若 dirty 则跳过，避免覆盖用户输入）。
- **轮询兜底**：3s 轮询当前文件 `stat().mtime`，覆盖用户用外部工具手改文件的场景。
- **自动选中新小说**：watch project.novels 增量（以 reload 后 id 集合为基线），AI `novel_create` 新增且当前未选中时自动选中最新一部。
- 列表元信息（标题 / 题材 / 字数）走 store 响应式，无需轮询。

### 工作台能力

- **封面**：头部缩略图 popup，AI 生成（登录门控，直呼 `window.preload.image.generate`，不建页面记录）/ 本地上传（`copyImageToAssets`）/ 移除；登记路径为相对 `novels/` 的 `{id}/assets/xxx.png`。
- **去 AI 味**：动作条按钮 + 深度弹窗（1~10，记住上次选择），流式改写当前文件并落盘；`humanize_text` 工具同步注入场景（AI 也可主动调用）。
- **复制**：复制当前文件 Markdown 到剪贴板。
- **实时字数**：编辑器内容即时统计（去空白），区别于 `novel_stats` 回写的落盘字数。

### 共用弹窗（已上移）

`ArticleImageGenDialog` / `ArticleImageGenContent` / `HumanizeDepthDialog` / `HumanizeDepthContent` 已上移至
`src/components/chat/aside/writing/components/`，中性化命名为 `ImageGenDialog.tsx` / `ImageGenContent.vue` / `HumanizeDepthDialog.tsx` / `HumanizeDepthContent.vue`，article 与 novelShort 共用（仅 `assetsDir` 与 `context` 不同）。
生图描述起草主进程实现上移至 `modules/tool/components/writing/imagePrompt.ts`（`draftImagePrompt` / `ImagePromptContext`），原 `article/articleImagePrompt.ts` 已删除。

## 接入点

- `writingScene.ts`：`WritingScene` 含 `novelShort` + `WRITING_SCENE_OPTIONS` 选项。
- `ChatTypeConfig.ts`：`WRITING_SCENE_CONFIG.novelShort = { prompt, tools, excludedTools, subAgentAllow }`；`CHAT_TYPE_CONFIG.writing.tools` 按场景决定是否追加 `design_draw`，`writing.prompt` 按场景分流。
- `agentFunctions.ts`：场景剔除过滤（请求侧 + 执行期）+ `getSceneSubAgentAllow` 裁剪 `spawn_agent`。
- `agentPrompts.ts`：装载器被剔除时抑制 `<available_tool_collections>` 目录。
- `WritingAside.vue`：按 `writingScene` 分发 ArticleAside / NovelAside。
- `ChatService.aiChatSandbox`：`writing + novelShort` 预建 `outputs/novels/`（小说子目录由 `novel_create` 创建）。

## 关键文件

- `src/modules/tool/components/novel/novelTypes.ts` / `novelStore.ts` / `novelTools.ts` / `novelPrompt.ts`
- `src/modules/tool/components/writing/imagePrompt.ts`（写作域共用生图描述起草）
- `src/components/chat/aside/writing/novelShort/`（含 `useNovelDoc.ts` / `useNovelAssist.ts`）
- `src/components/chat/aside/writing/components/`（article 与 novelShort 共用弹窗）

## 注意事项

- **不要给本场景加回 file 类 / shell**：一旦加回，模型就有绕过 `novel_*` 直接写文件的路径，本场景的收窄设计即失效。确需新能力时，写成 `novel_*` 语义工具。
- **过滤必须两层同步**：新增剔除项只改 `NOVEL_EXCLUDED_TOOLS` 即可（两处消费同一函数），但**不要**在 `resolveForExecution` 之外单独加黑名单，会造成两层口径漂移。
- **提示词与工具面严格对齐**：工具面变动必须同步改 `NOVEL_SCENE_PROMPT`，否则提示词会提到不存在的工具。
