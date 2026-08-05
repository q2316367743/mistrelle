# 03 文章侧边栏（侧边栏按大小类型拆分）

> writing 侧边栏按「大类型（chatType）→ 小类型（writingScene）」两层拆分组件。free 场景迁移为独立组件，article 场景新增项目管理侧边栏。

## 组件结构

```
src/components/chat/aside/writing/
├── WritingAside.vue                 # writingScene 分发壳（free / article）
├── free/
│   └── FreeWritingAside.vue         # 自由写作：文件树 + Monaco 编辑 + md 预览（原 WritingAside 逻辑迁移）
└── article/
    ├── ArticleAside.vue             # 文章项目管理主容器
    └── components/
        └── ArticleEditor.vue        # 纯内容区（Monaco 编辑 / md 预览，模式由 header 控制）
```

## 布局（常驻顶部 select）

- **header 一行**：文章下拉 select（`flex:1`）→ 编辑/预览切换（radio）→ 在文件夹中显示 / 刷新 / 导出按钮。
- **select 下拉选项**：自定义 option 展示标题 + 平台 tag + 状态 tag（草稿 / 写作中 / 已完稿）+ 字数；选中后 select 显示标题。
- **正文区**：当前选中文章的编辑 / 预览内容；未选中时显示空态提示。
- 文章由 AI 生成（`article_create` 工具），**不提供手动新建按钮**；「在文件夹中显示」按钮定位当前文章文件（未选中时打开项目根目录）。
- 默认进入**预览**模式，点「编辑」切换 Monaco 编辑器。

## 数据流

- 场景来源：`ChatSession.writingScene` → `LChatEngine` → `LChatAside`（`:writing-scene`）→ `WritingAside` 分发。
- 项目定位：`ArticleAside` 内 `buildArticleRoot(workspace, sandbox)` 计算 root；
  `getArticleStore(root)` 获取共享 store（与 article_* 工具同一响应式实例）。
- 文章选择：header 下拉 `select`（`:value` + `@change` 手动加载，清空复位），自定义 option 展示平台 / 状态 / 字数。
- 编辑落盘：`ArticleEditor` 变更 → `ArticleAside` 防抖 800ms 写回 `{root}/{file}`（与自由写作一致）。
- 文章创建：由 AI 通过 `article_create` 工具完成，侧边栏「刷新」后在下拉中可见。
- 工作空间切换：watch root → `destroyArticleStore(旧)` + 重载新项目（释放内存、避免失效状态）。

## 弹窗规范

`ArticleModal.tsx` 遵循弹窗约定：`.tsx` 外壳 + `DialogPlugin`（placement center / destroyOnClose / footer false）+ `.vue` 内容组件
（`body: () => h(ArticleContent, props)`），提交由内容组件内部完成并经 `onSubmit` 通知外壳落库。

## 待后续模块

- 模块 5：`ArticlePreview` 相对路径图片解析（`resolveArticleMarkdown`）+ 导出按钮（`exportArticle`）。
- 文章元信息编辑弹窗（复用 ArticleModal 扩展为编辑模式，可选）。
