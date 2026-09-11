# 03 文章侧边栏（长文创作全能面板）

> writing 侧边栏按「大类型（chatType）→ 小类型（writingScene）」两层拆分组件。当前子场景为 article（文章创作）与 novelShort，`WritingAside` 分发。文章侧边栏定位为长文创作工作台：正文 / 封面 / 插图 / 写作风格一体化管理。

## 组件结构

```
src/components/chat/aside/writing/
├── WritingAside.vue                 # writingScene 分发壳（article / novelShort）
└── article/
    ├── ArticleAside.vue             # 外壳：双布局自适应 + 分段切换 + 面板编排（≤300 行）
    ├── useArticleDoc.ts             # 数据层 composable：store 共享实例、选择/正文读写/版本切换/文件操作
    ├── useArticleAssist.ts          # 去 AI 味动作编排（产出新版本）
    ├── useArticleImageEvents.ts     # 配图 / 风格面板元数据事件写回（cover/images 文章级）
    ├── promptInputBridge.ts         # PROMPT_INPUT_KEY：快捷指令 → 聊天输入框注入桥
    └── components/
        ├── ArticleAsideHeader.vue   # header：文章下拉（平台/状态/字数 option）+ 定位/刷新/导出
        ├── ArticleVersionBar.vue    # 版本条：版本 chips（源/时间/删除）+ 去 AI 味 + AI 检测
        ├── ArticleEditor.vue        # tiptap WYSIWYG（编辑/预览），expose insertImage、emit image-added
        ├── ArticleImagePanel.vue    # 配图面板：封面（平台比例预览）+ 插图网格
        ├── ArticleStylePanel.vue    # 风格面板：平台/风格/状态 + 按当前风格重写按钮
        ├── ArticleImageGenDialog.tsx + ArticleImageGenContent.vue  # AI 生图命令式弹窗
        ├── HumanizeDepthDialog.tsx + HumanizeDepthContent.vue      # 去 AI 味深度选择（1~10，默认 5）
        ├── ArticleImage.ts          # 图片节点：相对路径存 src，渲染时解析 file:// 显示
        └── ArticleSlash.ts          # 斜杠命令
```

> 去 AI 味流式客户端已下沉到 `@/windows/main/modules/ai/humanize.ts`（`HUMANIZE_ENABLED` + `requestHumanizeStream`），由写作侧边栏与设计创意 `humanize_text` 工具共用，见 tool/13。

## 版本模型（一篇文章的多个版本）

- 右侧主维度是**同一篇文章的版本迭代**（原稿 / 去 AI 味 / 重写…），顶部文章下拉仅作跨文章切换入口；数据模型见 02 号文档「版本契约」。
- **归属分层**：封面 / 插图（`cover` / `images`）与平台 / 风格 / 状态是文章级，跨版本共享 —— 版本条只在「正文」维度出现，配图 / 风格面板无版本概念。
- `ArticleItem.file` 恒等于激活版本的 file：AI 工具（`article_read` / `file_write` / `article_stats`）与导出 zip 永远作用于激活版本。
- 编辑器 `:key = activeId:activeVersionId`：切文章 / 切版本都重挂编辑器（tiptap 内容只在挂载时初始化）。

## 双布局（随 fullscreen 自适应）

- **窄栏（非全屏，180–640px）**：header → 分段切换（`t-radio-group variant="default-filled"`：正文/配图/风格）→ 当前分段内容。正文分段 = 版本条 + 编辑器（`v-show` 保活，分段切换不丢内容），配图/风格 `v-if` 惰性挂载。
- **全屏**：左正文（版本条 + 编辑器，edit 模式）+ 右侧创作面板常驻（`__side` 300px 滚动列：配图面板 + 风格面板上下排布）。编辑时插入插图 / 调风格无需切页签。
- 编辑/预览模式仍由 `fullscreen` 派生：`mode = fullscreen ? 'edit' : 'preview'`（窄栏正文只读预览，配图/风格面板两态均可操作）。
- 与 NovelAside「全屏分栏 / 窄栏切换」同模式。

## 数据流

- 场景来源：`ChatSession.writingScene` → `LChatEngine` → `LChatAside` → `WritingAside` 分发。
- 项目定位：`useArticleDoc(props)` 内 `buildArticleRoot(workspace, sandbox)` → `getArticleStore(root)` 共享响应式实例（与 article_* 工具同源，AI 变更实时驱动 UI）。
- 编辑落盘：`ArticleEditor` 变更 → 防抖 800ms 写回**激活版本**的正文 md。刷新语义不变：点「刷新」重载索引并从磁盘重读正文（AI 用 `file_write` 改写后点一次刷新可见）。
- **版本切换**：版本条 emit `select` → `handleSwitchVersion`（useArticleDoc）——先 `saveDoc.flush()` 冲刷未落盘编辑（防旧内容经防抖写进新版本文件），再 `store.switchVersion`（`file` 同步）并重读正文；删除版本同路径，激活版本被删时 store 回落到最后一个版本。
- 图片落盘：粘贴/拖入 → 写 `assets/` → 插入相对路径节点，**同时 emit `image-added` 自动登记进 `images[]`**（归一为 `assets/{文件名}` 相对 articles/ 路径，去重；`useArticleImageEvents`）。
- 面板元数据写回：配图/风格面板 emit（`cover` / `add-images` / `remove-image` / `patch`）→ `patchArticle` → `store.updateArticle`（每次变更自动落盘 project.json）。
- 插图插入正文：面板 emit `insert(rel)` → 窄栏先切回正文分段，`nextTick` 后调 `ArticleEditor.insertImage(rel)`（`defineExpose`）。

## 封面与插图（ArticleImagePanel）

- **封面**：按平台比例预览（公众号 900/383、小红书 3/4、知乎与其他 16:9，`object-fit: cover`）；操作 = AI 生成 / 本地上传 / 移除（仅清字段，不删文件）。
- **插图**：`images[]` 缩略图网格（1:1 三列），悬停操作 = 插入正文 / 设为封面 / 移除（仅取消登记）；来源三渠道统一登记：AI 生成、本地上传（`dialog.open` + `copyImageToAssets`）、正文粘贴/拖入（`image-added`）。
- 展示 URL：`window.preload.net.pathToHref(join(root, rel))`（本地事件服务 /file 资源面）。
- 登记路径一律相对 articles/（`assets/xxx.png`）；正文中引用相对 md 目录（`../assets/xxx.png`），两种约定并存（见 02/04 号文档）。

## AI 生图（直出接口，不经 Agent）

- 入口：封面/插图的「生成」按钮 → `openArticleImageGen`（`.tsx` 外壳 + DialogPlugin + `.vue` 内容，标准弹窗约定）。
- 链路：`window.preload.image.generate({ prompt, model, size, record: false, path })` **工具直出模式**——不建页面记录、不广播，产物落盘 `assets/{cover|image}-{ts}.png` 等终态返回；与 image_generate 工具（Agent 侧）同一 ImageService 通道，积分由服务端扣减。
- 模型：默认「设置 → 默认生图模型」回退档位列表首项（`ImageModelStore`）；尺寸用与生图页同源的安全值（1024×1024 / 1024×1536 / 1536×1024），封面按平台取向默认横版/竖版，支持 `creatable` 自定义。
- 门控：`useAuthStore().status === 'signed-in'`，未登录禁用生成按钮 + tooltip 引导；弹窗内 `needLogin` 显示登录入口（`openLogin`）。

## 写作风格（ArticleStylePanel）

- 数据模型：`ArticleItem.style?: string`（预设名或自定义描述），`ARTICLE_STYLE_PRESETS`（articleTypes.ts）按平台给预设：公众号（深度长文/干货科普/情感故事/热点评述）、知乎（专业解析/个人经验/观点辩论/科普长文）、小红书（种草分享/干货教程/经验复盘/测评清单）、其他（通用写作）。
- UI：平台 select、风格 select（预设 + `creatable` 自定义 + `clearable` 未设置）、状态 select；变更即经 `patch` 写回 store。
- AI 侧联动：`article_create` / `article_update` 白名单支持 `style`；`ARTICLE_SCENE_PROMPT` 要求撰写/改写前先 `article_list` 确认 platform + style 并严格遵循（style 与平台模板叠加）。
- 快捷指令：「按当前风格重写正文」按钮 → 组装指令文本 → `PROMPT_INPUT_KEY`（useChatSession provide → LChatSender `addTextPrompt` expose）填入聊天输入框，**不自动发送**；与画布节点 / HTML 元素注入同一 DI 模式。全屏态下输入框被遮挡，发送前需退出全屏（toast 已提示）。

## 版本条与去 AI 味（ArticleVersionBar / modules/ai/humanize.ts）

footer 两个占位按钮已删除，动作收进正文维度顶部的版本条（`ArticleVersionBar.vue`）。

- **去 AI 味**（`HUMANIZE_ENABLED = true`）：需登录；点击后先弹深度选择（1~10，默认 5，记住上次选择）→ 确认后立刻 `createVersion({ source: 'humanize', content: '' })` 并激活 → `requestHumanizeStream`（经 `window.preload.relay.rewriteStream` → 服务端 `/api/rewrite` SSE，携带 `depth`）流式增量写入 `content` → 完成落盘并 `patchVersion` 字数。生成中按钮变为「停止」（`AbortController` → `streamAbort`）；**改写期间页面其它操作全部锁定**（header / 分段 / 版本切换删除 / AI 检测 / 配图与风格面板），仅「停止」可用；编辑器强制 preview；失败且无增量则删空版本回滚原稿，有增量则保留部分成果。
- **AI 检测 / 朱雀**：腾讯朱雀 AIGC 检测仅面向**企业认证接入**，本项目不集成检测接口；点击「AI 检测」经 `openUrlByBrowser`（`window.preload.inject.shell.openExternal`）在系统默认浏览器打开朱雀官网 `https://matrix.tencent.com/ai-detect/ai_gen_txt`，由用户在官网手动检测。按钮仅在去 AI 味改写期间禁用（`humanizing`）。

## 编辑器（tiptap）

- 依赖：`@tiptap/markdown`（md ↔ 编辑器双向）、`@tiptap/extension-table`；tiptap 全家桶 `^3.29.2`（markdown 序列化规格在 3.29 才进入各 extension 包，勿回退）。
- `contentType: 'markdown'` 加载，`onUpdate` 用 `editor.getMarkdown()` 输出保存；图片节点（`ArticleImage.ts`）`src` 存相对路径（源真相），渲染时经 `baseDir` 解析。
- 斜杠命令：`ArticleSlash.ts` 基于 `@tiptap/suggestion`，弹层复用 `@/utils/suggestionRenderer`。
- 预览模式：`editor.setEditable(false)`；排版样式在 `ArticleEditor.vue` 全局 style（`.article-editor__pm`），颜色一律 tdesign CSS Token。
- markdown 往返限制：脚注、数学公式、HTML 注释等高级语法可能丢失，正文用标准 markdown。
