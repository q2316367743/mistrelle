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
    ├── components/
    │   ├── ArticleToolbar.vue       # 项目标题 + 根目录标签 + 新建 / 刷新
    │   ├── ArticleList.vue          # 文章列表（标题 / 平台 tag / 状态 tag / 字数）
    │   └── ArticleEditor.vue        # 编辑 / 预览切换（Monaco + ChatContent）
    └── modals/
        ├── ArticleModal.tsx         # 新建文章弹窗外壳（DialogPlugin 命令式）
        └── ArticleContent.vue       # 弹窗内容：标题 / 平台 / 摘要 / 提纲表单
```

## 数据流

- 场景来源：`ChatSession.writingScene` → `LChatEngine` → `LChatAside`（`:writing-scene`）→ `WritingAside` 分发。
- 项目定位：`ArticleAside` 内 `buildArticleRoot(workspace, sandbox)` 计算 root；
  `getArticleStore(root)` 获取共享 store（与 article_* 工具同一响应式实例）。
- 编辑落盘：`ArticleEditor` 变更 → `ArticleAside` 防抖 800ms 写回 `{root}/{file}`（与自由写作一致）。
- 新建文章：`openArticleModal` 弹窗 → `ArticleContent` 表单 → 外壳 `store.createArticle` → `onCreated` 回调查选新文章。
- 工作空间切换：watch root → `destroyArticleStore(旧)` + 重载新项目（释放内存、避免失效状态）。

## 弹窗规范

`ArticleModal.tsx` 遵循弹窗约定：`.tsx` 外壳 + `DialogPlugin`（placement center / destroyOnClose / footer false）+ `.vue` 内容组件
（`body: () => h(ArticleContent, props)`），提交由内容组件内部完成并经 `onSubmit` 通知外壳落库。

## 待后续模块

- 模块 5：`ArticlePreview` 相对路径图片解析（`resolveArticleMarkdown`）+ 导出按钮（`exportArticle`）。
- 文章元信息编辑弹窗（复用 ArticleModal 扩展为编辑模式，可选）。
