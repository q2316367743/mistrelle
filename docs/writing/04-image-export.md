# 04 md 图片引用与导出

> 文章正文引用本地配图使用相对路径，保证预览可显示、导出可移植。核心逻辑集中在 `imageRef.ts`。

## 约定

正文内图片一律相对路径（相对 md 所在目录），如 `../assets/xxx.png`：

- **预览**：渲染前把相对路径解析为 `file://` 绝对链接（不改源文件）。
- **导出**：保持相对结构拷贝 md + 图片到目标目录，相对引用在导出目录依然有效。
- 禁止绝对路径（不可移植）；禁止在提示词 / 编辑器写入 file:// 链接。

## 核心函数（src/modules/tool/components/article/imageRef.ts）

### `resolveArticleMarkdown(md, mdDir): string`
预览预处理：把 md 中相对路径图片替换为 `pathToHref` 链接（`file://`）。
- 跳过外链（http/data/file/blob）、绝对路径（`/` 开头、Windows 盘符）。
- 不改源文件，返回新字符串。
- 背景：ChatContent 的 marked 引擎不支持自定义 image renderer，故渲染前预处理。

### `collectArticleAssets(md, mdDir): ArticleAssetRef[]`
收集 md 引用的本地图片（仅相对路径，按绝对路径去重）。返回 `{ relToMd, absPath }`。

### `exportArticle({ root, articleFile, targetDir }): Promise<{ mdPath, assets }>`
把文章（含引用的本地图片）导出到目标目录：
- 保持相对 root 的结构：`drafts/xxx.md` → `{targetDir}/drafts/xxx.md`、`assets/y.png` → `{targetDir}/assets/y.png`。
- 因此 md 内 `../assets/xxx.png` 在导出目录解析正确。
- 图片逃出项目根（如 `../../` 引用外部文件）跳过；不存在的图片跳过。
- `PathApi` 无 `relative`，用 `relToRoot`（基于 `normalizePath` 字符串）计算相对位置。

## 接入点

- **预览**：`ArticleEditor.vue` 新增 `baseDir` prop → `previewContent = resolveArticleMarkdown(content, baseDir)`。
  `ArticleAside` 传 `activeMdDir`（当前文章 md 所在目录）。
- **导出**：`ArticleToolbar.vue` 新增导出按钮（`canExport` / `exporting` 状态）；`ArticleAside.handleExport`
  选目标目录 → `exportArticle` → `MessageUtil` 提示成功 / 失败。

## 导出目录结构示例

```
{targetDir}/
├── drafts/xxx.md          # md 内图片引用 ../assets/xxx.png
└── assets/xxx.png
```

## 关键文件

- `src/modules/tool/components/article/imageRef.ts`
- `src/components/chat/aside/writing/article/components/ArticleEditor.vue`
- `src/components/chat/aside/writing/article/components/ArticleToolbar.vue`
- `src/components/chat/aside/writing/article/ArticleAside.vue`
