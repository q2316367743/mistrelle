# 06 文章编辑器（TipTap 能力面：工具栏联动 / 悬浮框 / 溢出收起）

> 文章场景正文编辑器（`article/components/`）的编辑器能力层。2026-09-14 落地：修复「工具栏与光标不联动、按钮过少、图片无悬浮操作」三项问题；同日按用户要求**移除块级拖拽手柄**（依赖代价过大，见 §6）。
> 面向后续 AI：改编辑器格式 / 命令 / 悬浮框 / 手柄前先读本文，尤其注意「**markdown 落盘约束**」与「**状态快照单向推送**」两条铁律。

## 一、硬约束：正文以 Markdown 落盘

正文经 `@tiptap/markdown` 双向转换（`ArticleEditor.vue` 的 `contentType: 'markdown'` + `getMarkdown()`），磁盘上是 `.md` 文件。由此推出：

- **只上 markdown 能表达的格式**：加粗 / 斜体 / 下划线 / 删除线 / 行内代码 / 链接 / 标题 / 引用 / 代码块 / 有序无序列表 / 分割线 / 表格 / 图片。
- **刻意不纳入**：文字颜色、高亮、对齐、任务清单、上下标——无 markdown 语法，重新打开时大概率丢失（官方只承诺「解析 markdown 里内嵌的 HTML」，未承诺序列化回落）。
- 表格在 markdown 侧是 GFM 表格，`TableKit` 已注册；**表格存得住**，故已上工具栏。

## 二、组件结构

```
article/
├── ArticleAside.vue                  # 外壳（244 行）：布局编排 + 接线，业务逻辑已下沉
├── useArticleEditorBridge.ts         # 编辑器↔数据层接线：命令转发 / 快照持有 / 图片登记与生图
└── components/
    ├── articleEditorCommands.ts      # 【核心】状态快照 / 命令派发 / 块类型（纯函数）
    ├── articleEditorImages.ts        # 图片落盘 / 图片节点寻址（选中·替换·删除·计数）
    ├── ArticleEditor.vue             # TipTap 实例 + 扩展注册 + 两个浮层挂载点
    ├── ArticleFormatButtons.vue      # 格式区：内联按钮 + 「更多」触发（按宽度自适应）
    ├── ArticleToolbar.vue            # 顶部工具栏（版本面板 + 格式区 + 内联插图/生图）
    ├── ArticleBubbleMenu.vue         # 选中文字的悬浮格式框（BubbleMenu）
    ├── ArticleImageMenu.vue          # 选中图片的悬浮框（复制/换图/重新生成/删除）
    ├── ArticleFormatPanel.vue        # 「更多」溢出面板（块类型 / 格式 / 插入 三区）
    ├── articleFormatButtons.ts       # 按钮元数据表 + 宽度常量（内联行与面板共用）
    ├── LinkDialog.tsx                # 链接弹窗外壳（DialogPlugin 命令式）
    └── LinkDialogContent.vue         # 链接弹窗内容（t-input + 归一化）
```

## 三、工具栏与光标联动（原问题 ①②）

**旧问题根因**：`ArticleToolbar.vue` 从不读编辑器状态，H2 是写死的字面量按钮；命令经 `ArticleAside.vue` 的 if/else 梯子逐个转发给编辑器 8 个 toggle 方法。

**新机制：状态快照单向推送**（`articleEditorCommands.ts`）

1. 编辑器每次 `onTransaction` 调 `readEditorState(editor)` 生成快照。
2. 与上次快照 `isSameEditorState` 浅比较，**仅确有变化时** emit `state-change`（避免每敲一键就重渲染工具栏）。
3. 快照经 `useArticleEditorBridge` 落到 `editorState` → 绑定给 `ArticleFormatButtons`。

```ts
interface ArticleEditorState {
  bold/italic/underline/strike/code/link: boolean   // 行内标记
  blockType: ArticleBlockType                        // 光标所在块形态（下拉选中项）
  bulletList/orderedList: boolean                    // 列表（与 blockType 正交）
  inTable/imageSelected: boolean
  canUndo/canRedo: boolean                           // 撤销/重做按钮可用性
}
```

**块类型下拉**即「光标放标题上显示标题等级、放正文显示『正文』」的实现：`readBlockType()` 逐级探测 `isActive('heading', { level })`，无匹配回落 `paragraph`（列表项内、单元格内都是 paragraph）。

**命令面收敛**：编辑器 `defineExpose` 由 8 个独立方法改为 5 个语义方法 —— `insertImage` / `getSelection` / `getImageContext` / `replaceImageAt` / `runCommand` / `setBlockType`。新增格式只需在 `ArticleEditorCommand` 联合与 `applyCommand` 的 switch 各加一处。

## 四、悬浮框（原问题 ③）

用 TipTap 官方 **BubbleMenu**（`@tiptap/vue-3/menus`，无需手动注册扩展，组件自注册插件；零新增依赖）。两个实例按 `shouldShow` 分流：

| 组件 | 显示条件 | 内容 |
|---|---|---|
| `ArticleBubbleMenu.vue` | 有非空文字选区且未选中图片 | 加粗/斜体/下划线/删除线/行内代码/链接/引用 |
| `ArticleImageMenu.vue` | `editor.isActive('image')` | 缩略图 + 复制图片/换图/AI 重新生成/删除 |

- 两个浮层**不走 emit 上抛**（除图片重新生成需父级语境），直接持有 editor 调命令，减少接线。
- 图片操作**按位置寻址**：`findSelectedImage()` 记录节点 `pos`，弹窗交互期间选区漂移也不影响目标。
- **复制图片**复用 `clipboard.copyImageByPath(绝对路径)`（与封面 `ArticleCoverThumb.vue` 同一套），main 侧按路径读盘写剪贴板；路径由 `imageRef.ts` 新增的 `resolveArticleImagePath(baseDir, src)` 解析。
- **删除图片**仅当 `countImageRefs() === 0`（全文已无同图引用）才上报父级清理 `entry.images`，避免别处还用着却从插图列表摘掉。
- **AI 重新生成**以**图片所在段落的文字**为语境（`getImageContext()`），成功后按 pos 回填 `replaceImageAt`。

## 五、工具栏溢出收起（一行永不换行）

**旧问题根因**：`.fmt { flex-wrap: wrap }` + 默认侧栏仅 232px（内容区 208px）装不下 15 个按钮 → 必然折成两行。实测：版本按钮 ~100px、块类型下拉、按钮 28px/个、插图+生图带文字 ~110px，光这三项就已超过 208px。

**机制**（`ArticleToolbar.vue` 的 `layout` computed）：工具栏 `flex-wrap: nowrap` **恒为一行**，用 `ResizeObserver` 实测可用宽度，按预算决定哪些内联、哪些收进「更多」popup。

- 宽度取自 `contentRect`（**已排除 padding**），故预算里不再扣 padding——这是第一版算错、导致默认宽度把一个按钮都排不进去的原因。
- 版本按钮可收缩（`min-width: 56px`），预算按**最小值**扣除；实际更宽时由 flex 自行收缩补足差额，因此不会溢出。
- **无循环依赖**：全程只用常量，与「谁被收进面板」无关（插图是否内联不反过来影响可用宽度）。
- 全部内容装得下时**不预留**「更多」按钮宽度（此时它根本不显示）。
- 块类型下拉之后的那个分隔线**只在有按钮跟随时才渲染**，故 0 按钮时按 `BLOCK_TYPE_WIDTH` 计费、≥1 按钮才补计分隔线；否则 232px 下会误判成「放不下」。
- 极端窄栏（< 200px）若保块类型就一个按钮都放不下，则让块类型进面板、把位置留给按钮（避免工具栏空得只剩一个下拉）。

**内联优先级**（`ARTICLE_FORMAT_BUTTONS` 数组顺序，靠前优先留在工具栏）：
块类型下拉 → 加粗 → 斜体 → 无序列表 → 引用 → 下划线 → 删除线 → 链接 → 有序列表 → 行内代码 → 代码块 → 表格 → 分割线 → 撤销 → 重做 → 清除格式。

**实测各宽度表现**（内容区 = 侧栏 − 24）：

| 侧栏 | 内容区 | 内联内容 |
|---|---|---|
| 232px（默认） | 208px | 块类型 + 加粗 |
| 320px | 296px | 块类型 + 4 个按钮 |
| 400px | 376px | 块类型 + 4 个按钮 + 插图/生图 |
| 640px | 616px | 块类型 + 12 个按钮 + 插图/生图 |
| ≥700px | 676px | 全部内联，无「更多」按钮 |

**「更多」面板三区**（`ArticleFormatPanel.vue`）：「块类型」（仅当它没内联时出现）/「格式」（按行内·段落·历史分组，仅列未内联的按钮）/「插入」（仅当插图生图没内联时出现）。三区皆空则不显示「更多」按钮。

**插图 / 生图在工具栏内联时为纯图标 + tooltip**（原带文字，占 ~110px）。

## 六、块级操作（已整体移除）

2026-09-14 曾用官方 `@tiptap/extension-drag-handle-vue-3` 实现块级拖拽排序 + 块菜单，**同日按用户要求整体删除**（评价「做得十分垃圾」）。删除原因与教训：

⚠️ **依赖代价不可接受**：`@tiptap/extension-drag-handle` 的构建产物对 `@tiptap/extension-collaboration`、`@tiptap/y-tiptap`、`@tiptap/extension-node-range` 全是**值导入**（非 type-only，已核实 `dist/index.js`，删不掉也 tree-shake 不掉）；`y-tiptap` 在 dist 里又**裸导入 `y-protocols/awareness`**，且 peer 依赖 `yjs`。为**一个拖拽手柄**被迫装入 7 个包（`yjs` / `y-protocols` / `lib0` / `isomorphic.js` + 4 个 tiptap 包，约 9MB），而本项目**不做协同编辑**，这些代码一行都用不上。

**两条教训**：
1. **工具库的真实依赖面必须以 `dist` 打包产物为准**，不能只看 TS 源码（`drag-handle-plugin.ts` 里确实没有 node-range，但 dist 里有）。
2. **`yarn add` 的 unmet peer 警告不能一律忽略**：`y-protocols` 只以警告出现，却是运行时裸导入，漏装会让 dev server 依赖预优化直接报 `Could not resolve "y-protocols/awareness"`。

若日后仍需块级操作，优先自研（零依赖）：块菜单式（复制/上移/下移/转类型/删除）即可覆盖绝大多数诉求，`Ctrl+Z` 可撤销，比拖拽更精准。

## 七、扩展注册与已知坑

`ArticleEditor.vue` 扩展清单：`StarterKit`（`heading.levels: [1,2,3,4]`、`link: { openOnClick: false }`）+ `Markdown` + `ArticleImage` + `ArticleSlash` + `TableKit`。

- **`link.openOnClick: false` 必配**：v3 的 StarterKit 默认含 Link 且点击即跳转，编辑时误点会跳走。
- StarterKit v3 已内置 **Undo/Redo、Underline、Strike、Link、Code、CodeBlock、OrderedList、HorizontalRule**，这些都是零新增依赖即可上工具栏的（此前只是没暴露）。
- **编辑器实例不自带 Vue 响应式**：`ArticleBubbleMenu` 需自行订阅 `editor.on('transaction')` 维护 active 态；顶部工具栏靠 `state-change` 事件推送。
- 编辑区容器 `.article-editor` 设了 `position: relative` 供浮层定位参考。
- ⚠️ **导出常量名不要以大写 `T` 开头**：`TDesignResolver`（unplugin-auto-import）把 `T` 开头的大写标识符误判为 tdesign 组件并**剥掉首字母**，会往 `auto-imports.d.ts` / `.eslintrc-auto-import.json` 写入假全局（实例：`TOOLBAR_GAP_TOTAL` 被生成为 `tdesign-vue-next['OOLBAR_GAP_TOTAL']`）。本项目曾因此把该常量改名 `FLEX_GAP_TOTAL`。

## 八、新增一种格式的清单

1. `articleEditorCommands.ts`：`ArticleEditorCommand` 加字面量 → `applyCommand` 的 switch 加分支 → 若有激活概念则在 `readCommandActive` 加映射。
2. `ArticleEditorState` 加字段 + `readEditorState` 读取 + `isSameEditorState` 比较 + `EMPTY_EDITOR_STATE` 初值（**四处必须同步**，漏掉比较项会导致状态不更新）。
3. `articleFormatButtons.ts` 的 `ARTICLE_FORMAT_BUTTONS` 加一项（**数组位置即内联优先级**，越靠前越优先留在工具栏；图标取自 `tdesign-icons-vue-next`）——内联行与「更多」面板共用此表，无需改两处。
4. 若 markdown 存不住，**先确认是否值得加**（见 §1）。

## 九、关联文档

- 文章侧边栏与数据层：[03-article-aside.md](./03-article-aside.md)、[02-article-data-layer.md](./02-article-data-layer.md)
- 图片相对路径约定与资产复制：[04-image-export.md](./04-image-export.md)
