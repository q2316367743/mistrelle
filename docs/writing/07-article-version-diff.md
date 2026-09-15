# 07 - 文章版本对比（monaco diff 弹窗）

> 2026-09-15 落地。底部动作条新增「版本对比」：下拉列出除当前版本外的其他版本，点击弹 `t-dialog` 内嵌 monaco diff 双栏只读对比，左=当前版本、右=所选版本。

## 实现思路

- 入口在 `ArticleDocActions.vue`（底部动作条）：组件保持「哑组件」约定，只挂 `t-dropdown` 并 `emit('compare', versionId)`，正文读取与弹窗打开都由 `ArticleAside.vue` 编排。
- 弹窗走命令式 `DialogPlugin` 两件套（`.tsx` 外壳 + `XxxContent.vue` 内容），同 `LinkDialog.tsx` 先例。
- monaco diff：`createDiffEditor` + `setModel({ original, modified })`，monaco 约定 **original 左、modified 右**，因此 original=当前版本、modified=所选版本，天然满足「左当前/右所选」。
- 左侧内容用编辑器实时 `content`（与用户所见一致，不 flush 落盘）；右侧用 `store.readArticle(版本id)` 读落盘正文。

## 关键文件

| 文件 | 职责 |
|---|---|
| `src/renderer/src/windows/main/modules/tool/components/article/articleTypes.ts` | 新增共享助手 `articleVersionLabel(v)`（label 优先，缺省按 source）与 `articleVersionTitle(v)`（`第N版 · 展示名`） |
| `article/components/VersionDiffDialog.tsx` | 弹窗外壳：`openVersionDiffDialog(options)`，`DialogPlugin({ header: '版本对比', width: 'min(1100px, 94vw)', footer: false, destroyOnClose: true })` |
| `article/components/VersionDiffContent.vue` | 弹窗内容：双栏标签行 + monaco diff（高 62vh）+ 底部「关闭」按钮 |
| `article/components/ArticleDocActions.vue` | 「版本对比」下拉按钮；新 props `versions` / `activeVersionId`，新 emit `compare(versionId)` |
| `article/components/ArticleVersionPanel.vue` | 版本名展示改用共享助手（删本地重复实现） |
| `article/ArticleAside.vue` | `handleCompareVersion(versionId)`：读所选版本正文 → 打开弹窗；失败 `MessageUtil.error` |

## API 契约

```ts
// VersionDiffDialog.tsx
export interface OpenVersionDiffDialogOptions {
  currentLabel: string   // 左侧标题，如「第2版 · 去 AI 味」
  targetLabel: string    // 右侧标题
  currentContent: string // 当前版本正文（实时）
  targetContent: string  // 所选版本正文（落盘）
}
export const openVersionDiffDialog = (options: OpenVersionDiffDialogOptions): void
```

```ts
// articleTypes.ts —— 版本名统一出口（VersionPanel / DocActions 下拉 / 弹窗标签共用）
export const articleVersionLabel = (v: ArticleVersion): string  // 自定义 label ?? source 映射 ?? '版本'
export const articleVersionTitle = (v: ArticleVersion): string  // `第${no}版 · ${articleVersionLabel(v)}`
```

- `ArticleDocActions` 新增 props：`versions?: ArticleVersion[]`、`activeVersionId?: string`；无其他版本时渲染禁用按钮（tooltip「暂无其他版本可对比」），不挂空 dropdown；`humanizing` 时禁用。
- 下拉菜单项 = 除 `activeVersionId` 外的版本，倒序（新在上），文案 `articleVersionTitle`。

## 注意事项

- **monaco 主题是全局态**：`IDiffEditorOptions` 不含 `theme`（typecheck 实证），diff 编辑器设置主题用 `monaco.editor.setTheme(...)`，跟随 `isDark`（`@/global/BeanFactory`）。
- **只高亮变化字符、不高亮整行**（用户拍板）：monaco 无开关，靠主题色实现——`defineTheme` 派生 `word-diff-light/dark`（base 继承 vs / vs-dark），把 `diffEditor.insertedLineBackground` / `removedLineBackground` 置 `#00000000` 透明，字符级 `insertedTextBackground` / `removedTextBackground` 继承内置主题；弹窗卸载时还原全局主题为 vs / vs-dark。
- **worker 零配置**：diff 计算走 default 分支的 editor worker，`src/renderer/src/plugin/monaco.ts` 已全局初始化。
- **资源释放**：`VersionDiffContent` 卸载时 dispose diffEditor 与两个 text model；外壳 `destroyOnClose: true` 保证每次对比重建。
- 布局用 `automaticLayout: true` 自适应弹窗开启动画，无需手动监听尺寸。
