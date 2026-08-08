# 03 文章侧边栏（侧边栏按大小类型拆分）

> writing 侧边栏按「大类型（chatType）→ 小类型（writingScene）」两层拆分组件。当前唯一子场景为 article（文章创作），`WritingAside` 直接渲染文章项目管理侧边栏。

## 组件结构

```
src/components/chat/aside/writing/
├── WritingAside.vue                 # writingScene 分发壳（当前仅 article，保留 prop 供未来扩展）
└── article/
    ├── ArticleAside.vue             # 文章项目管理主容器
    └── components/
        ├── ArticleEditor.vue        # 内容区：tiptap WYSIWYG（编辑 / 预览 = editable 切换）
        └── ArticleImage.ts          # 图片节点：相对路径存 src，渲染时解析 file:// 显示
```

## 布局（常驻顶部 select）

- **header 一行**：文章下拉 select（`flex:1`）→ 在文件夹中显示 / 刷新 / 导出为 ZIP 按钮。
- **select 下拉选项**：自定义 option 展示标题 + 平台 tag + 状态 tag（草稿 / 写作中 / 已完稿）+ 字数；选中后 select 显示标题。
- **正文区**：当前选中文章的编辑 / 预览内容；未选中时显示空态提示。
- 文章由 AI 生成（`article_create` 工具），**不提供手动新建按钮**；「在文件夹中显示」按钮定位当前文章文件（未选中时打开项目根目录）。
- 编辑 / 预览由**侧边栏全屏状态**驱动（无手动切换）：全屏（`fullscreen`）= 编辑态，非全屏 = 预览态。

## 数据流

- 场景来源：`ChatSession.writingScene` → `LChatEngine` → `LChatAside`（`:writing-scene`）→ `WritingAside` 分发。
- 编辑/预览模式：`LChatEngine.fullscreen` → `LChatAside` → `WritingAside` → `ArticleAside` 逐层透传 `:fullscreen`；
  `ArticleAside` 派生 `mode = fullscreen ? 'edit' : 'preview'` 传给 `ArticleEditor`（`editable` 切换）。
- 项目定位：`ArticleAside` 内 `buildArticleRoot(workspace, sandbox)` 计算 root；
  `getArticleStore(root)` 获取共享 store（与 article_* 工具同一响应式实例）。
- 文章选择：header 下拉 `select`（`:value` + `@change` 手动加载，清空复位），自定义 option 展示平台 / 状态 / 字数；
  `<article-editor :key="activeId">` 切换文章时重挂载编辑器。
- 编辑落盘：`ArticleEditor` 变更（`editor.getMarkdown()`）→ `ArticleAside` 防抖 800ms 写回 `{root}/{file}`。
- 图片落盘：粘贴 / 拖入图片 → 写入 `assetsDir`（`{root}/assets`）→ 插入相对路径节点（`../assets/xxx.png`）。
- 文章创建：由 AI 通过 `article_create` 工具完成，侧边栏「刷新」后在下拉中可见。
- 工作空间切换：watch root → `destroyArticleStore(旧)` + 重载新项目（释放内存、避免失效状态）。

## 编辑器（tiptap）

- 依赖：`@tiptap/markdown`（md ↔ 编辑器双向）、`@tiptap/extension-image`、`@tiptap/extension-table`；tiptap 全家桶 `^3.29.2`（markdown 序列化规格在 3.29 才进入各 extension 包，勿回退）。
- `contentType: 'markdown'` + `content: props.content` 加载；`onUpdate` 用 `editor.getMarkdown()` 输出保存，源文件始终为 md。
- 图片节点（`ArticleImage.ts`）：`src` 属性存相对路径（源真相），`renderHTML` 渲染时用 `baseDir` 解析成 `file://` 显示，序列化仍输出相对路径。
- 表格用 `TableKit`（table/row/cell/header 四节点，带 markdown 规格），AI 生成表格可正常往返。
- 斜杠命令：`ArticleSlash.ts` 基于 `@tiptap/suggestion` 实现，输入 `/` 唤起命令菜单（标题/加粗/列表/引用/代码块/分割线/表格/图片），
  弹层复用通用渲染器 `@/utils/suggestionRenderer`（`makeSuggestionRenderer`，纯 DOM + tdesign Token）。「图片」命令从本地选图拷入 `assetsDir` 后插入相对路径节点。
- 预览模式：`editor.setEditable(false)`，同一编辑器只读渲染。
- 排版样式在 `ArticleEditor.vue` 全局 style 中维护（`.article-editor__pm`），颜色一律 tdesign CSS Token。

### markdown 往返限制

`@tiptap/markdown` 为官方早期版本，往返有边界：脚注、数学公式、HTML 注释、多子节点单元格等高级语法可能丢失或退化，文章正文应使用标准 markdown。

## 弹窗规范

`ArticleModal.tsx` 遵循弹窗约定：`.tsx` 外壳 + `DialogPlugin`（placement center / destroyOnClose / footer false）+ `.vue` 内容组件
（`body: () => h(ArticleContent, props)`），提交由内容组件内部完成并经 `onSubmit` 通知外壳落库。

## 待后续模块

- 文章元信息编辑弹窗（复用 ArticleModal 扩展为编辑模式，可选）。
