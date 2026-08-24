# 文件预览弹窗（公共组件 FilePreviewDialog）

> 关键文件：`src/renderer/src/components/preview/FilePreviewDialog.tsx`（外壳 + 分发）+ `FilePreviewContent.vue`（内容）
> 依赖：`LinkPreviewDrawer`（同目录，处理 http 链接预览）；主进程 `src/main/src/protocol.ts`（mistrelle:// MIME 表）
> 演进：原 `components/chat/chat-assistant/modals/FilePreviewDialog.tsx`（纯 tsx，违反弹窗拆分约定）提升为公共组件并拆分为外壳 + 内容

## 实现思路

文件预览从聊天产物卡片专用入口提升为公共组件：DP 外壳负责按入口类型分发、读取文本、开弹窗，`.vue` 内容组件承载各类预览 body。同时新增两个能力：**http(s) 链接预览**（复用 `LinkPreviewDrawer` 抽屉）与**本地 html 渲染预览**（webview 直接加载 `mistrelle://` 地址，替代原先 Monaco 看源码）。

## 契约与分发

```ts
export interface FilePreviewItem {
  fileName?: string   // 展示标题；缺省取文件名
  fullPath?: string   // 本地文件绝对路径：与 url 二选一
  url?: string        // http(s) 链接：与 fullPath 二选一（url 优先）
}
export function openFilePreview(item: FilePreviewItem): void
```

分发顺序（`FilePreviewDialog.tsx#openFilePreview`）：

| 输入 | 预览形态 | 说明 |
|---|---|---|
| `url`（http/https） | `openLinkPreview(url)` → 网页浏览抽屉 | 不弹 Dialog，直接开抽屉 |
| `.md` | Dialog + 「预览/源码」切换 | 预览 = ChatContent 渲染，源码 = Monaco（markdown） |
| `.html` / `.htm` | Dialog + 「预览/源码」切换 | 预览 = `<webview>` 加载 `pathToHref(fullPath)`，源码 = Monaco（懒读取文本） |
| CODE_EXTS（含 .html） | Dialog + Monaco | 语言映射 `EXT_LANG`，缺省 plaintext |
| IMAGE / VIDEO / AUDIO | Dialog + 原生标签 | src 均为 `mistrelle://local/<encoded>`（`net.pathToHref`） |
| 其余 | `showInFolder` | 无预览分支，兜底在文件管理器中定位 |

- footer 统一：使用默认程序打开（`shell.openPath`）/ 在文件夹中显示（`shell.showItemInFolder`）。
- 文本类（markdown / code）由外壳预读 `fs.readTextFile`，读取失败 toast 后不弹窗；html 源码按需懒读。
- 内容组件通过 props 收 `kind`（判别联合）与 `content` / `src` / `language`；`destroyOnClose: true` 卸载即回收 webview guest。

## 本地 html 预览的关键事实

1. **webview 不写 partition**：`protocol.handle('mistrelle', ...)` 只在**默认 session** 注册（`src/main/index.ts#registerLocalProtocol`），带 partition 的 webview 是独立 session，拿不到自定义协议。因此 html 预览 webview 走默认 session；`mistrelle://` 与 app origin 隔离，无 cookie / localStorage 串扰。
2. **MIME 表已补**：`src/main/src/protocol.ts` 的 `MIME_BY_EXT` 原只覆盖字体 / 图片，`.html` 回退 `application/octet-stream` 无法渲染；现补充 `.html/.htm → text/html`、`.js/.mjs → text/javascript`、`.css → text/css`、`.json → application/json`，本地页面及其相对资源均可正常加载。
3. **失败态**：webview `did-fail-load` 忽略 -3（导航中断）与非主框架错误，仅主框架失败显示重试面板；重试通过 v-if 重建 webview 实现（`src` 重新绑定即重新加载）。
4. **源码切换会重建 webview**：「预览 ↔ 源码」来回切换时页面状态丢失（重新加载），本地静态页场景可接受。

## 消费方

- 聊天产物卡片 `FileProductList.vue`（类型分组 EXT 集合与 `getExt` 改为从本模块 import，去除重复定义）
- `OfficeAside.vue` 产物列表、`AssetPage.vue` 资产文件
- http 链接入口：`openFilePreview({ url })` 或直接 `openLinkPreview(url)`

## 注意事项

- `CODE_EXTS` 仍含 `.html`（供图标选择等复用），但分发时 `.html/.htm` 在命中 code 分支**之前**先路由到 html 渲染分支。
- 弹窗拆分遵循 AGENTS.md 约定：`.tsx` 外壳（DialogPlugin 命令式、footer false 逻辑在壳内 renderFooter）+ `.vue` 内容（`FilePreviewContent.vue`）。