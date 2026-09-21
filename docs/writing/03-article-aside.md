# 03 文章侧边栏（以文档为中心的写作工作台）

> writing 侧边栏按「大类型（chatType）→ 小类型（writingScene）」两层拆分组件。article 子场景定位为**以文档为中心的写作工作台**：一个聊天 = 一篇文章（主题），文章下可有多个「类型」（发布平台），每个类型独立的版本序列；正文恒可编辑，AI 写完自动呈现，版本是文档演进史（时间线），配图直接插进正文。

2026-09-13 彻底重构（旧版「文章管理器」形态的文章下拉 / 配图 Tab / 风格 Tab / 版本 chips 已废弃）；同日二次迭代：**类型 = 发布平台**，每类型独立版本，风格/体裁维度整体删除（含「深度长文」），旧数据不迁移。同日三次迭代（用户拍板）：**状态字段整体删除**（无作用）、**类型改由 AI 设定**（自由命名、标题+类型唯一，用户端仅查看/切换，删除「添加类型」入口）、**刷新外显**为头部按钮（移出更多菜单）。
2026-09-14 迭代：**单元模型**（「标题+类型+版本」= 唯一单元、版本 id 即单元标识，见 02 号文档）——AI 写入/读取只认单元 id，侧边栏 `loadContent` 改按激活版本 id 调 `readArticle`；版本号显式化（`ArticleVersion.no`，时间线标签不再按数组索引推算）；头部新增**简介/提纲下拉面板**（信息按钮 + t-popup，由 AI 经 `article_update` 维护——此前 summary/outline 落库但无任何展示位）。
**标题可编辑（2026-09-14）**：面板顶部新增**标题项（t-input）**，用户可直接改标题（本地草稿，失焦/回车提交，中文输入法组合态不提交，空标题不提交并回滚）。这**推翻了此前「标题用户不可修改、仅 AI 可改」的六轮拍板**——摘要/提纲仍只读、由 AI 维护。写回走新增的 `store.updateArticle(id, {title})`（按文章 id 寻址，见 02 号文档）。

## 设计原则（重构拍板）

- **文档即主界面**：头部直接呈现文档——**标题位 = t-select 下拉切换文章**（六轮拍板：标题用户不可修改，只能让 AI 调 `article_update` 改；**2026-09-14 推翻**：标题改在 ⓘ 面板内用 t-input 直接编辑，头部 t-select 仍只负责切换文章）；类型同样 AI 专属设定，旁侧下拉切换。
- **类型 = 平台，AI 专属设定**：类型名是自由字符串（推荐 公众号/知乎/小红书 等，仅提示词层面引导），由 AI 经 article_write 自动创建；头部类型 tag 组只读展示 + 点击切换（active 高亮），无添加/删除入口。
- **无状态维度**：status 字段已从数据模型、AI 工具（article_update）、UI 三处整体删除，旧数据读时剔除。
- **恒可编辑**：窄栏 / 全屏共用同一套布局，编辑器始终 editable（仅去 AI 味流式期间锁定）。
- **写完即呈现 + 刷新常驻**：AI 正文走 `article_write`（store 通道）即时驱动 UI；`file_write` 直写由 mtime 轮询兜底；头部刷新按钮（RefreshIcon）一键以磁盘为准重载（保留当前选中的文章/类型/版本，丢弃未落盘编辑并冲刷防抖写回）。
- **版本 = 演进史**：时间线下拉（第 N 版 · 来源），点击条目即切换（无「设为当前」按钮），删除按钮 hover 显示；手动编辑永不自动建版。
- **配图并入编辑器**：工具栏插图（上传）/ 生图（AI 直出）直接插入光标处；封面收敛为头部缩略位（16:9，随类型走）。
- 风格/体裁维度已删除：平台差异化文风由提示词内置模板按 type 承担。**「AI 重写」按钮已删（2026-09-13 七轮拍板）**：重写锁定当前类型，而类型由 AI 专属设定，重写入口应收敛到聊天（用户直接对 AI 说，`article_write` + `newVersion=true`）；`PROMPT_INPUT_KEY` 桥（promptInputBridge.ts / useChatSession provide / LChatSender addTextPrompt·sendTextPrompt）随之整体删除。

## 组件结构

```
src/renderer/src/windows/main/components/chat/aside/writing/
├── WritingAside.vue                 # writingScene 分发壳（article / novelShort）
└── article/
    ├── ArticleAside.vue             # 外壳：文档布局编排 + 类型切换接线 + 空态（≤300 行）
    ├── useArticleDoc.ts             # 数据层：store 共享、自动联动（id diff + contentRevs + mtime 轮询）、类型/正文/版本读写、元信息
    ├── useArticleAssist.ts          # 去 AI 味动作编排（按类型产出 humanize 新版本，流式期间 suspended 锁定）
    └── components/
        ├── ArticleDocHeader.vue     # 文档头部：封面缩略 + 文章标题下拉（t-select，切换文章）+ 类型下拉（t-select 切换）+ 信息面板（t-popup：标题可编辑 t-input + 简介/提纲只读）+ 刷新按钮
        ├── ArticleCoverThumb.vue    # 封面缩略位：t-popup（AI 生成 / 上传 / 复制图片 / 文件夹 / 移除，16:9）
        ├── ArticleToolbar.vue       # 工具栏：版本下拉 + 格式区 + 插图/生图（恒一行，按宽度自适应）
        ├── ArticleFormatButtons.vue # 格式区：内联按钮 + 「更多」触发（2026-09-14 新增）
        ├── ArticleFormatPanel.vue   # 「更多」溢出面板：块类型 / 格式 / 插入 三区（2026-09-14 新增）
        ├── articleFormatButtons.ts  # 按钮元数据表 + 宽度常量（内联行与面板共用）
        ├── ArticleBubbleMenu.vue    # 选中文字的悬浮格式框（BubbleMenu）（2026-09-14 新增）
        ├── ArticleImageMenu.vue     # 选中图片的悬浮框：复制/文件夹/换图/AI 重新生成/删除（2026-09-14 新增）
        ├── LinkDialog.tsx / LinkDialogContent.vue  # 链接地址输入弹窗（命令式）
        ├── ArticleVersionPanel.vue  # 版本时间线：t-timeline 倒序（第N版·来源），点击即切换，hover 删除
        ├── ArticleDocActions.vue    # 底部动作条：去 AI 味（或停止）+「更多」分组下拉（内容/文件/版本）+ #extra 插槽；右侧 = N 字
        ├── ArticleEditor.vue        # tiptap WYSIWYG（恒可编辑），expose runCommand/setBlockType/insertImage 等
        ├── articleEditorCommands.ts # 编辑器状态快照 / 命令派发 / 块类型（纯函数）
        ├── articleEditorImages.ts   # 图片落盘 + 图片节点寻址（选中/替换/删除/计数）
        ├── ArticleImage.ts          # 图片节点：相对路径存 src，渲染时解析 file:// 显示
        └── ArticleSlash.ts          # 斜杠命令
```

> 编辑器能力层（工具栏联动 / 悬浮框 / 溢出收起 / markdown 落盘约束）详见 [06-article-editor.md](./06-article-editor.md)。
> `useArticleEditorBridge.ts`（同级）承载编辑器↔数据层接线，使本外壳保持 ≤300 行。

共用弹窗（2026-09-14 上移至 `writing/components/`，article 与 novelShort 共用）：
`ImageGenDialog.tsx` + `ImageGenContent.vue`（AI 生图命令式弹窗，封面横版 / 插图方形）、
`HumanizeDepthDialog.tsx` + `HumanizeDepthContent.vue`（去 AI 味深度选择 1~10，默认 5）。
生图描述起草的主进程实现同批上移至 `tool/components/writing/imagePrompt.ts`（`draftImagePrompt` / `ImagePromptContext`），
原 `article/articleImagePrompt.ts` 已删除。

已删除（旧形态）：`ArticleAsideHeader.vue`、`ArticleVersionBar.vue`、`ArticleImagePanel.vue`、`ArticleStylePanel.vue`、`useArticleImageEvents.ts`。

## 布局（窄栏 / 全屏统一）

```
Row1 封面缩略 56px（16:9）+ 文章标题下拉（t-select，切换文章）+ 类型下拉（t-select，AI 设定后在此切换）+ 信息ⓘ（标题可编辑 + 简介/提纲只读）+ 刷新⟳
工具栏（第N版·来源 ▾ │ [正文▾] B I … ⋯ │ 插图 生图）——恒为一行；窄栏时装不下的收进 ⋯ 面板
tiptap 编辑器（flex:1，恒可编辑）
底部动作条（去AI味/停止 · 更多 ▾ ·        N 字）
```

- `fullscreen` prop 保留入参但不再切换布局（仅宽度随容器变化）；编辑能力与全屏解耦。
- 三种空态：①无文章 → 「开始写作」引导卡；②文章存在但无类型（旧数据/手动清空）→ 提示「在左侧聊天让 AI 设定类型」；③有类型无正文 → 编辑器空文档。

## 数据流与自动联动（useArticleDoc）

- 项目定位：`buildArticleRoot(workspace, sandbox)` → `getArticleStore(root)` 共享响应式实例（与 article_* 工具同源）。
- **通道一（主）**：AI `article_write` → `store.writeContent(unitId, content, ...)` → bump `contentRevs["${articleId}::${type}"]`（内存 reactive Map，不落盘）→ useArticleDoc watch 即时重读正文。`newVersion=true` 走 `createVersion(source:'rewrite')` 返回新 id，写入的版本同时设为激活版本（侧边栏自动切过去）。
- **通道二（兜底）**：3s `stat` 轮询当前类型激活版本文件 mtime（仿 NovelAside），变化即重读——兼容 AI 用通用 `file_write` 直写的历史路径。
- **自动选中**：文章 id 集合增量 watcher（仿 NovelAside `seenNovelIds`）——AI 新建且当前无选中 → 自动激活最新一篇（取其首个类型）；当前文章被删 → 回落最新一篇；重开聊天（reload）无选中 → 自动呈现最新一篇。类型集合 watcher：AI 追加类型（article_write 带 type 自动创建）时自动选中新类型。
- **类型切换**：`selectType` 先 `flushSave()` 冲刷旧类型未落盘编辑，再切换并重读；编辑器 `:key = activeId:activeType:activeVersionId` 切换即重挂。
- **冲突保护**：本地有未落盘编辑（`dirty`）时轮询跳过（不覆盖输入）；AI 显式写入（contentRevs / 轮询命中）时以磁盘为准覆盖本地并 `saveDoc.cancel()`；去 AI 味流式期间 `suspended=true` 暂停轮询与外部重读。
- 编辑落盘：`ArticleEditor` change → 防抖 800ms 写回当前类型激活版本文件；**永不自动建版**。
- 实时字数：底部动作条 `words` 由外壳按 `content` 即时统计（去空白字符），不依赖 `article_stats` 落盘值。

## 重写入口（已收敛到聊天）

- 侧边栏**无「AI 重写」按钮**（2026-09-13 删除，含 PROMPT_INPUT_KEY 桥整链）：重写锁定当前类型，与「类型由 AI 专属设定」冲突，入口收敛到聊天——用户直接对 AI 说重写要求，AI 用 `article_write`（大改 / 重写带 `newVersion=true`）产出新版本。
- `ARTICLE_SCENE_PROMPT` 已明确：正文一律 `article_write`（`file_write` 直写侧边栏感知不到）；改一改默认覆盖同 id、重写 / 大改传 `newVersion=true` 拿新 id 后续写新 id；追加平台版 = `article_create` 同标题 + 新类型创建新单元。

## 版本时间线（ArticleVersionPanel）

- 触发器：`第N版 · {来源label}`（**N 取显式 `ArticleVersion.no`**，创建时分配、删除中间版本不影响既有编号；`ARTICLE_VERSION_SOURCE_OPTIONS` 中文映射），流式生成中显示 loading +「生成中…」。
- 面板：t-timeline 倒序（最新在上），每项 = 第N版 · 来源 / 时间（label）/ 字数；**点击条目即切换**（无「设为当前」按钮），删除按钮 hover 显示（popconfirm，store 保证至少保留 1 个）。humanizing 期间禁用。
- 去 AI 味的产出进入当前类型的时间线，聊天中让 AI 重写（newVersion=true）的产出同样进入时间线，旧版可随时切回（内容保留不删）。

## 封面与插图（随类型走）

- **封面（ArticleCoverThumb）**：头部 56px 缩略位（固定 16:9），t-popup 内 AI 生成 / 上传 / 复制图片 / 文件夹 / 移除（仅已有封面时显示后三者）；`cover` 为类型级字段，变更经 `patchType({ cover })`。
  - **复制图片**：走 `clipboard.copyImageByPath(绝对路径)`（main 侧 `nativeImage.createFromPath` + `clipboard.writeImage`）——把封面**图片本体**写入系统剪贴板，可直接粘进微信 / 文档；与「复制路径」语义不同，用 `copyImage` 而非 `copyFile`（后者是文件引用，粘贴为文件而非图像）。
  - **文件夹**（2026-09-20 新增）：`shell.showItemInFolder(绝对路径)` 在系统文件管理器中定位封面文件（与底部动作条的「文件夹」同款）。
- **插图（工具栏）**：「插图」= 系统选图 → `copyImageToAssets` → `resolveAssetRel`（相对 md 目录）→ 插入 + 归一为 `assets/{文件名}` 登记进当前类型 `images[]`（去重）；「生图」= `openImageGen`（直出接口 `image.generate record:false`，落 `assets/`，封面横版/插图方形默认尺寸）成功后自动插入并登记；正文粘贴 / 拖入图片（编辑器内置）同样落盘并 emit `image-added` 登记。
- **⚠️ 插图生图以「选中文字」为前提（2026-09-14 用户拍板）**：
  - **未选中文字时「生图」按钮禁用**，tooltip 提示「请先选中要配图的文字」；选中后解除禁用，tooltip 变「根据选中文字生图」。
  - 理由：没有选中就无从确定「画什么、插到哪」——早期版本用「无选区回退正文全文」兜底，结果模型画成泛泛的全文配图，被用户否决。**因此 `ArticleImageContext` 不含正文全文兜底字段**（`selection` 是插图起草的唯一内容依据；封面才用标题/摘要/提纲）。
  - 选中状态经 `ArticleEditor` 的 `selection-change` 事件（`onSelectionUpdate` / `onCreate` 上报 `getSelection()`）流到 `ArticleAside.selection` → `ArticleToolbar.hasSelection`。版本/文章切换时编辑器 `:key` 重挂载，`onCreate` 上报空串自然复位。
- **⚠️ 插图插入不吞选中文字**：图片是块级节点，直接 `insertContent` 会**替换掉选中内容**——而选中正是用户用来指明位置的。故 `ArticleEditor.insertImage` 有选区时用 `insertContentAt($to.after(1))` 插到**选中块之后**，仅在无选区时才插在光标处（上传与生图两条路径共用此函数）。
- **弹窗的 AI 代写生图描述（2026-09-14 新增）**：`ImageGenContent` 打开即调 `draftImagePrompt(kind, context)`
  （`tool/components/writing/imagePrompt.ts`）——走 `createChatCompletion` + 设置里的快速模型（`defaultQuickModel || defaultAssistantModel`），
  按语境起草一段**英文画面描述**回填 textarea，用户可直接改或点「换一版」；无可用模型时静默退回手写（提示「AI 起草不可用」，不报错、不挡流程）。
  - **语境的来源**：封面 → `ArticleDocHeader` 把文章 `title/summary/outline` 透传给 `ArticleCoverThumb` → 弹窗；
    插图 → `ArticleAside.buildImageContext()` = 文章 `title/summary/outline`（仅供理解背景）+ **编辑器选中文字**（画面主体以此为准）。
  - 提示词里选中片段置于最前并标注「画面的主体内容以此为准」，提纲标注「仅供理解上下文，不要照提纲画全景」。
  - 单个语境字段按 1200 字符截断（`MAX_FIELD_CHARS`）。
- 展示 URL：`window.preload.net.pathToHref(...)`（本地事件服务 /file 资源面）。
- 两种路径约定并存：正文引用相对 md 目录（`../assets/xxx.png`），登记相对 articles/（`assets/xxx.png`），见 02/04 号文档。
- **AI 配图**（聊天侧）不走本弹窗：由生图型子 Agent（`spawn_agent(type="image")`）产出后经 `article_update` 登记，见 02 号文档。

## 底部动作条（去 AI 味 + 「更多」分组下拉）

- **分组收拢（2026-09-21）**：可见主按钮仅「去 AI 味 / 停止」；AI 检测 / 复制 / 文件夹 / 版本对比收进「更多」`t-dropdown`（`trigger="click"`、`placement="top-left"`，贴底向上弹），用分隔线分三段：**内容**（AI 检测、复制正文）｜**文件**（在文件夹中显示）｜**版本**（平铺列出除当前外的其他版本，`articleVersionTitle` 为文案；无其他版本时显示禁用项「版本对比（暂无其他版本）」）。`humanizing` 期间「更多」整体禁用。
  - ⚠️ 版本对比**不采用悬停子菜单**：窄侧栏内子菜单易被挤出屏幕、且无版本时整项消失（用户反馈「对比不见了」），故平铺直列，保证可发现。
- **`#extra` 插槽**：动作条预留具名插槽供下游注入额外按钮（gzh 经 `GzhDocActions.vue` 薄包装注入「排版预览 / 正文质检」面板入口）；共享组件 `props` / `emits` 未变，`ArticleAside` 零改动。
- **历史**：2026-09-14 曾撤销「更多」并把 AI 检测 / 文件夹平铺进动作条；本次（2026-09-21）因 gzh 复用需要重新以「更多」分组收拢。
- **AI 检测**：复制当前正文到剪贴板（`copyText`）→ 系统通知「正文内容已复制」→ `openUrlByBrowser` 打开腾讯朱雀官网 `https://matrix.tencent.com/ai-detect/ai_gen_txt`（朱雀仅企业接入，不集成检测接口）。
- **复制（2026-09-13 拍板替代导出）**：正文本来就是项目内本地文件，zip 导出已整体删除（`exportArticleZip`/`collectArticleAssets` 已从 imageRef.ts 移除）；「复制」= 当前类型激活版本 markdown 原文进剪贴板。
- **版本对比**：子菜单选中某版本 → 读取该版本落盘正文，与当前激活版本实时正文在 monaco diff 弹窗对比（`openVersionDiffDialog`）。

## 编辑器（tiptap）

- 依赖：`@tiptap/markdown`、`@tiptap/extension-table`；全家桶 `^3.29.2`（markdown 序列化规格在 3.29 才进入各 extension 包，勿回退）。
- props：`editable?: boolean`（默认 true；去 AI 味流式期间传 false；NovelEditor 复用时按自身 mode 映射）。
- expose：`insertImage(rel)`（有选区插到选中块之后、无选区插光标处，不吞选中文字）/ `getSelection()`（读取当前选区文本，供插图弹窗起草描述与工具栏启用判定）+ 格式命令 `toggleBold / toggleItalic / toggleHeading2 / toggleBulletList / toggleBlockquote`（工具栏按钮经外壳转发调用）。
- emits：`change`（markdown 输出）/ `image-added`（粘贴拖入落盘后登记）/ `selection-change`（选区变化携带选中文本，驱动插图生图启用）。
- `contentType: 'markdown'` 加载，`onUpdate` 用 `editor.getMarkdown()` 输出；图片节点（`ArticleImage.ts`）`src` 存相对路径（源真相），渲染时经 `baseDir` 解析。
- 斜杠命令：`ArticleSlash.ts` 基于 `@tiptap/suggestion`，弹层复用 `@/utils/suggestionRenderer`。
- markdown 往返限制：脚注、数学公式、HTML 注释等高级语法可能丢失，正文用标准 markdown。
