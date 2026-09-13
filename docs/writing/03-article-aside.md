# 03 文章侧边栏（以文档为中心的写作工作台）

> writing 侧边栏按「大类型（chatType）→ 小类型（writingScene）」两层拆分组件。article 子场景定位为**以文档为中心的写作工作台**：一个聊天 = 一篇文章（主题），文章下可有多个「类型」（发布平台），每个类型独立的版本序列；正文恒可编辑，AI 写完自动呈现，版本是文档演进史（时间线），配图直接插进正文。

2026-09-13 彻底重构（旧版「文章管理器」形态的文章下拉 / 配图 Tab / 风格 Tab / 版本 chips 已废弃）；同日二次迭代：**类型 = 发布平台**，每类型独立版本，风格/体裁维度整体删除（含「深度长文」），旧数据不迁移。同日三次迭代（用户拍板）：**状态字段整体删除**（无作用）、**类型改由 AI 设定**（自由命名、标题+类型唯一，用户端仅查看/切换，删除「添加类型」入口）、**刷新外显**为头部按钮（移出更多菜单）。

## 设计原则（重构拍板）

- **文档即主界面**：头部直接呈现文档——**标题位 = t-select 下拉切换文章**（六轮拍板：标题用户不可修改，只能让 AI 调 `article_update` 改，用户端标题编辑能力已删）；类型同样 AI 专属设定，旁侧下拉切换。
- **类型 = 平台，AI 专属设定**：类型名是自由字符串（推荐 公众号/知乎/小红书 等，仅提示词层面引导），由 AI 经 article_write 自动创建；头部类型 tag 组只读展示 + 点击切换（active 高亮），无添加/删除入口。
- **无状态维度**：status 字段已从数据模型、AI 工具（article_update）、UI 三处整体删除，旧数据读时剔除。
- **恒可编辑**：窄栏 / 全屏共用同一套布局，编辑器始终 editable（仅去 AI 味流式期间锁定）。
- **写完即呈现 + 刷新常驻**：AI 正文走 `article_write`（store 通道）即时驱动 UI；`file_write` 直写由 mtime 轮询兜底；头部刷新按钮（RefreshIcon）一键以磁盘为准重载（保留当前选中的文章/类型/版本，丢弃未落盘编辑并冲刷防抖写回）。
- **版本 = 演进史**：时间线下拉（第 N 版 · 来源），点击条目即切换（无「设为当前」按钮），删除按钮 hover 显示；手动编辑永不自动建版。
- **配图并入编辑器**：工具栏插图（上传）/ 生图（AI 直出）直接插入光标处；封面收敛为头部缩略位（16:9，随类型走）。
- 风格/体裁维度已删除：平台差异化文风由提示词内置模板按 type 承担，动作条「AI 重写」按当前类型惯用文风生成新版本。

## 组件结构

```
src/components/chat/aside/writing/
├── WritingAside.vue                 # writingScene 分发壳（article / novelShort）
└── article/
    ├── ArticleAside.vue             # 外壳：文档布局编排 + 类型切换接线 + 空态（≤300 行）
    ├── useArticleDoc.ts             # 数据层：store 共享、自动联动（id diff + contentRevs + mtime 轮询）、类型/正文/版本读写、元信息
    ├── useArticleAssist.ts          # 去 AI 味动作编排（按类型产出 humanize 新版本，流式期间 suspended 锁定）
    ├── promptInputBridge.ts         # PROMPT_INPUT_KEY：指令 → 聊天输入框桥（支持 autoSend 自动发送）
    └── components/
        ├── ArticleDocHeader.vue     # 文档头部：封面缩略 + 文章标题下拉（t-select，切换文章；标题仅 AI 可改）+ 类型下拉（t-select 切换）+ 刷新按钮 + 更多菜单
        ├── ArticleCoverThumb.vue    # 封面缩略位：t-popup（AI 生成 / 上传 / 移除，16:9）
        ├── ArticleToolbar.vue       # 工具栏：版本下拉触发 + 格式按钮（B/I/H2/列表/引用）+ 插图 / 生图
        ├── ArticleVersionPanel.vue  # 版本时间线：t-timeline 倒序（第N版·来源），点击即切换，hover 删除
        ├── ArticleDocActions.vue    # 底部动作条：去 AI 味（或停止）/ AI 重写 · N 字 · 复制（正文 markdown 到剪贴板）
        ├── ArticleEditor.vue        # tiptap WYSIWYG（恒可编辑），expose insertImage + 格式命令，emit image-added
        ├── ArticleImageGenDialog.tsx + ArticleImageGenContent.vue  # AI 生图命令式弹窗（封面横版/插图方形）
        ├── HumanizeDepthDialog.tsx + HumanizeDepthContent.vue      # 去 AI 味深度选择（1~10，默认 5）
        ├── ArticleImage.ts          # 图片节点：相对路径存 src，渲染时解析 file:// 显示
        └── ArticleSlash.ts          # 斜杠命令
```

已删除（旧形态）：`ArticleAsideHeader.vue`、`ArticleVersionBar.vue`、`ArticleImagePanel.vue`、`ArticleStylePanel.vue`、`useArticleImageEvents.ts`。

## 布局（窄栏 / 全屏统一）

```
Row1 封面缩略 56px（16:9）+ 文章标题下拉（t-select，切换文章；标题仅 AI 可改）+ 类型下拉（t-select，AI 设定后在此切换）+ 刷新⟳ + 更多⋯
工具栏（第N版·来源 ▾ │ B I H2 列表 引用 │        插图 生图）
tiptap 编辑器（flex:1，恒可编辑）
底部动作条（去AI味/停止 · AI 重写 ·        N 字 · 复制）
```

- `fullscreen` prop 保留入参但不再切换布局（仅宽度随容器变化）；编辑能力与全屏解耦。
- 三种空态：①无文章 → 「开始写作」引导卡；②文章存在但无类型（旧数据/手动清空）→ 提示「在左侧聊天让 AI 设定类型」；③有类型无正文 → 编辑器空文档。

## 数据流与自动联动（useArticleDoc）

- 项目定位：`buildArticleRoot(workspace, sandbox)` → `getArticleStore(root)` 共享响应式实例（与 article_* 工具同源）。
- **通道一（主）**：AI `article_write` → `store.writeContent(id, type, ...)` → bump `contentRevs["${id}::${type}"]`（内存 reactive Map，不落盘）→ useArticleDoc watch 即时重读正文。`asNewVersion=true` 走 `createVersion(source:'rewrite')`。
- **通道二（兜底）**：3s `stat` 轮询当前类型激活版本文件 mtime（仿 NovelAside），变化即重读——兼容 AI 用通用 `file_write` 直写的历史路径。
- **自动选中**：文章 id 集合增量 watcher（仿 NovelAside `seenNovelIds`）——AI 新建且当前无选中 → 自动激活最新一篇（取其首个类型）；当前文章被删 → 回落最新一篇；重开聊天（reload）无选中 → 自动呈现最新一篇。类型集合 watcher：AI 追加类型（article_write 带 type 自动创建）时自动选中新类型。
- **类型切换**：`selectType` 先 `flushSave()` 冲刷旧类型未落盘编辑，再切换并重读；编辑器 `:key = activeId:activeType:activeVersionId` 切换即重挂。
- **冲突保护**：本地有未落盘编辑（`dirty`）时轮询跳过（不覆盖输入）；AI 显式写入（contentRevs / 轮询命中）时以磁盘为准覆盖本地并 `saveDoc.cancel()`；去 AI 味流式期间 `suspended=true` 暂停轮询与外部重读。
- 编辑落盘：`ArticleEditor` change → 防抖 800ms 写回当前类型激活版本文件；**永不自动建版**。
- 实时字数：底部动作条 `words` 由外壳按 `content` 即时统计（去空白字符），不依赖 `article_stats` 落盘值。

## AI 重写（自动发送执行）

- 底部「AI 重写」：组装指令（文章 id、当前类型，要求 `article_write` 带 type 且 `newVersion=true`）→ `PROMPT_INPUT_KEY(text, { autoSend: true })` → `LChatSender.sendTextPrompt`（填入后立即 `handleSend`）→ AI 流式改写 → 产 rewrite 新版本 → 版本时间线可查。过程在聊天可见、可停止。
- `PROMPT_INPUT_KEY` 签名：`(text, options?: { autoSend?: boolean })`；默认仅填入不发送。
- `ARTICLE_SCENE_PROMPT` 已明确：正文一律 `article_write`（`file_write` 直写侧边栏感知不到）；大改 / 重写必须 `newVersion=true`；收到侧边栏重写指令必须生成新版本；为已有文章追加平台版直接 `article_write` 带 type（自动创建，先 `article_read` 已有版本保持选题一致）。

## 版本时间线（ArticleVersionPanel）

- 触发器：`第N版 · {来源label}`（versions[0] 为第 1 版原稿；`ARTICLE_VERSION_SOURCE_OPTIONS` 中文映射），流式生成中显示 loading +「生成中…」。
- 面板：t-timeline 倒序（最新在上），每项 = 第N版 · 来源 / 时间（label）/ 字数；**点击条目即切换**（无「设为当前」按钮），删除按钮 hover 显示（popconfirm，store 保证至少保留 1 个）。humanizing 期间禁用。
- 去 AI 味与 AI 重写的产出都进入当前类型的时间线，旧版可随时切回（内容保留不删）。

## 封面与插图（随类型走）

- **封面（ArticleCoverThumb）**：头部 56px 缩略位（固定 16:9），t-popup 内 AI 生成 / 上传 / 移除；`cover` 为类型级字段，变更经 `patchType({ cover })`。
- **插图（工具栏）**：「插图」= 系统选图 → `copyImageToAssets` → `resolveAssetRel`（相对 md 目录）→ 插入光标处 + 归一为 `assets/{文件名}` 登记进当前类型 `images[]`（去重）；「生图」= `openArticleImageGen`（直出接口 `image.generate record:false`，落 `assets/`，封面横版/插图方形默认尺寸）成功后自动插入光标处并登记；正文粘贴 / 拖入图片（编辑器内置）同样落盘并 emit `image-added` 登记。
- 展示 URL：`window.preload.net.pathToHref(...)`（本地事件服务 /file 资源面）。
- 两种路径约定并存：正文引用相对 md 目录（`../assets/xxx.png`），登记相对 articles/（`assets/xxx.png`），见 02/04 号文档。

## 更多菜单 / AI 检测 / 复制

- 头部更多菜单（MoreIcon 下拉）：AI 检测 / 在文件夹中显示。**刷新已移出菜单**，为头部常驻图标按钮（RefreshIcon）：`reload()` 重读 project.json 与正文，保留当前选中的文章/类型/版本，以磁盘为准覆盖并 `saveDoc.cancel()`（丢弃未落盘编辑）。
- **AI 检测**：复制当前正文到剪贴板（`copyText`）→ 系统通知「正文内容已复制」→ `openUrlByBrowser` 打开腾讯朱雀官网 `https://matrix.tencent.com/ai-detect/ai_gen_txt`（朱雀仅企业接入，不集成检测接口）。
- **复制（2026-09-13 拍板替代导出）**：正文本来就是项目内本地文件，zip 导出已整体删除（`exportArticleZip`/`collectArticleAssets` 已从 imageRef.ts 移除）；底部动作条「复制」= 当前类型激活版本 markdown 原文进剪贴板。

## 编辑器（tiptap）

- 依赖：`@tiptap/markdown`、`@tiptap/extension-table`；全家桶 `^3.29.2`（markdown 序列化规格在 3.29 才进入各 extension 包，勿回退）。
- props：`editable?: boolean`（默认 true；去 AI 味流式期间传 false；NovelEditor 复用时按自身 mode 映射）。
- expose：`insertImage(rel)` + 格式命令 `toggleBold / toggleItalic / toggleHeading2 / toggleBulletList / toggleBlockquote`（工具栏按钮经外壳转发调用）。
- `contentType: 'markdown'` 加载，`onUpdate` 用 `editor.getMarkdown()` 输出；图片节点（`ArticleImage.ts`）`src` 存相对路径（源真相），渲染时经 `baseDir` 解析。
- 斜杠命令：`ArticleSlash.ts` 基于 `@tiptap/suggestion`，弹层复用 `@/utils/suggestionRenderer`。
- markdown 往返限制：脚注、数学公式、HTML 注释等高级语法可能丢失，正文用标准 markdown。
