# 04 md 图片引用

> 文章正文引用本地配图使用相对路径，保证编辑器可显示、文件可移植。核心逻辑集中在 `imageRef.ts`。
> 2026-09-13：zip 导出功能已删除（用户拍板：正文本来就是项目内本地文件，无需导出，侧边栏改为「复制」正文到剪贴板）。

## 约定

正文内图片一律相对路径（相对 md 所在目录），如 `../assets/xxx.png`：

- **显示**：tiptap 图片节点渲染时把相对路径解析为 `file://` 链接（节点 `src` 属性始终存相对路径）。
- 禁止绝对路径（不可移植）；禁止在提示词 / 编辑器写入 file:// 链接。

## 核心函数（src/modules/tool/components/article/imageRef.ts）

### `resolveArticleImage(baseDir, src): string`
编辑器显示用：把相对路径图片解析为 `file://` 链接（不改节点 `src`）。
- 跳过外链（http/data/file/blob）、绝对路径（`/` 开头、Windows 盘符）。
- 由 `ArticleImage.ts` 节点 `renderHTML` 调用。

### `resolveAssetRel(mdDir, assetPath): string`
计算 md 到资产文件（assets 目录下）的相对引用，供粘贴 / 拖入图片后插入节点（如 `../assets/x.png`）。
- `PathApi` 无 `relative`，用 `relPath`（基于 `normalizePath` 字符串）计算。

### `copyImageToAssets(assetsDir, srcPath, prefix): Promise<string>`
把本地图片（绝对路径）复制进项目 assets 目录并返回绝对路径，文件名 `{prefix}-{时间戳}{原扩展名}`。
- 供封面 / 插图上传与编辑器粘贴共用，统一命名避免互相覆盖。

## 接入点

- **显示**：`ArticleEditor.vue` 的 `ArticleImage` 节点（`baseDir` prop = 当前 md 目录，`ArticleAside` 传 `activeMdDir`）。
- **图片落盘**：`ArticleEditor.vue` `handlePaste` / `handleDrop` 把图片写入 `assetsDir`（`{root}/assets`）后插入节点。
- **复制正文**：`ArticleAside.handleCopy` 把当前类型激活版本 markdown 原文复制到剪贴板（`copyText`）。

## 关键文件

- `src/modules/tool/components/article/imageRef.ts`
- `src/renderer/src/windows/main/components/chat/aside/writing/article/components/ArticleEditor.vue`
- `src/renderer/src/windows/main/components/chat/aside/writing/article/components/ArticleImage.ts`
- `src/renderer/src/windows/main/components/chat/aside/writing/article/ArticleAside.vue`
