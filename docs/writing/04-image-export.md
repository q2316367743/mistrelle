# 04 md 图片引用与 zip 导出

> 文章正文引用本地配图使用相对路径，保证编辑器可显示、导出可移植。核心逻辑集中在 `imageRef.ts`。

## 约定

正文内图片一律相对路径（相对 md 所在目录），如 `../assets/xxx.png`：

- **显示**：tiptap 图片节点渲染时把相对路径解析为 `file://` 链接（节点 `src` 属性始终存相对路径）。
- **导出**：暂存成 `{name}/drafts/ + {name}/assets/` 结构后压缩为 zip，相对引用解压后依然有效。
- 禁止绝对路径（不可移植）；禁止在提示词 / 编辑器写入 file:// 链接。

## 核心函数（src/modules/tool/components/article/imageRef.ts）

### `resolveArticleImage(baseDir, src): string`
编辑器显示用：把相对路径图片解析为 `file://` 链接（不改节点 `src`）。
- 跳过外链（http/data/file/blob）、绝对路径（`/` 开头、Windows 盘符）。
- 由 `ArticleImage.ts` 节点 `renderHTML` 调用。

### `resolveAssetRel(mdDir, assetPath): string`
计算 md 到资产文件（assets 目录下）的相对引用，供粘贴 / 拖入图片后插入节点（如 `../assets/x.png`）。
- `PathApi` 无 `relative`，用 `relPath`（基于 `normalizePath` 字符串）计算。

### `collectArticleAssets(md, mdDir): ArticleAssetRef[]`
收集 md 引用的本地图片（仅相对路径，按绝对路径去重）。返回 `{ relToMd, absPath }`。

### `exportArticleZip({ root, articleFile, targetZip, name }): Promise<{ assets }>`
把文章（含引用的本地图片）导出为 zip 压缩包：
- 暂存到系统临时目录：`{name}/drafts/xxx.md` + `{name}/assets/y.png`（只拷引用到的图片，按 basename）。
- `window.preload.zip.compress(targetZip, [暂存目录])`（adm-zip：目录以 basename 为根打包整棵树）。
- 因此 md 内 `../assets/xxx.png` 在解压后解析正确。
- 图片逃出项目根（如 `../../` 引用外部文件）跳过；不存在的图片跳过。
- `finally` 清理暂存目录。

## 接入点

- **显示**：`ArticleEditor.vue` 的 `ArticleImage` 节点（`baseDir` prop = 当前 md 目录，`ArticleAside` 传 `activeMdDir`）。
- **图片落盘**：`ArticleEditor.vue` `handlePaste` / `handleDrop` 把图片写入 `assetsDir`（`{root}/assets`）后插入节点。
- **导出**：`ArticleAside.handleExport` 用 `dialog.save` 选 zip 路径 → `exportArticleZip` → `MessageUtil` 提示成功 / 失败。

## 导出 zip 结构示例

```
{name}.zip
└── {name}/
    ├── drafts/xxx.md          # md 内图片引用 ../assets/xxx.png
    └── assets/xxx.png
```

## 关键文件

- `src/modules/tool/components/article/imageRef.ts`
- `src/components/chat/aside/writing/article/components/ArticleEditor.vue`
- `src/components/chat/aside/writing/article/components/ArticleImage.ts`
- `src/components/chat/aside/writing/article/ArticleAside.vue`
