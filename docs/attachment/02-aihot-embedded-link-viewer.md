# 内嵌网页浏览抽屉（公共组件 LinkPreviewDrawer）

> 关键文件：`src/renderer/src/components/preview/LinkPreviewDrawer.tsx`（外壳）+ `LinkPreviewContent.vue`（内容）
> 启用开关：`src/main/index.ts` webPreferences `webviewTag: true`；`did-attach-webview` 给 guest 挂 window.open 转发
> 演进：原 aihot 页内组件（`AihotLinkDrawer`）已提升为公共组件，aihot 各链接出口改调 `openLinkPreview`

## 实现思路

aihot 模块所有外部链接出口（列表卡片 / 热点榜兜底 / 事件「去原站」/ 报道时间线 / 日报条目）统一改为应用内抽屉浏览，不再跳系统浏览器；抽屉工具栏保留「用系统浏览器打开」作为退路。该能力现由公共组件 `LinkPreviewDrawer` 提供，全局（含 FilePreviewDialog 的 url 分支）复用。

### 方案选型：`<webview>` 标签 vs `WebContentsView`（2026-08 调研结论）

| 维度 | `<webview>` 标签（已采用） | `WebContentsView` |
|------|---------------------------|-------------------|
| 官方态度 | 文档明确 "We currently recommend to not use the webview tag"（Chromium 上游 MVEmbed 架构变动风险） | 官方推荐路径 |
| 布局 | 普通 DOM 元素，抽屉动画 / 裁剪 / 层级零成本 | 主进程原生视图，浮在全部 DOM 之上，会盖住抽屉遮罩与阴影 |
| 边界同步 | 无需 | 手动 setBounds：抽屉滑入动画需每帧 IPC 同步（issue #37330 竞态）、resize 需持续同步、无法被父容器裁剪、焦点坑（#28163/#42578） |
| 实战背书 | VS Code 扩展 UI 系统、Obsidian 内置浏览器 | Slack / Notion 特定浮层 |

结论：本场景是**次要阅读面板**而非主浏览界面，webview 的 DOM 集成价值远大于长期架构风险；workbuddy / codex 等闭源产品无公开实现可引证。iframe 方案被多数新闻站 X-Frame-Options 直接拦死，不可行。

## 数据流与契约

```
调用方 ── openLinkPreview(url, options?) ──→ DrawerPlugin（header/footer: false, size clamp(500px, 70%, 960px), destroyOnClose）
                                                └─ LinkPreviewContent.vue
                                                    ├─ <webview :src :partition="persist:link-preview" :useragent>
                                                    ├─ 工具栏：后退 / 前进 / 刷新(加载中变停止) / 系统浏览器打开 / 关闭
                                                    └─ 事件 → UI：did-start/stop-loading(进度条+按钮切换)
                                                        did-navigate / did-navigate-in-page(地址栏+canGoBack/Forward)
                                                        did-fail-load(主框架且 code≠-3 → 错误面板 + 重试 + 系统浏览器退路)
```

- 外壳唯一导出 `openLinkPreview(url: string, options?: { partition?: string })`：`options.partition` 指定 webview 持久化会话名（缺省 `persist:link-preview`）；内容组件 emit `close` 由外壳销毁抽屉。
- 新增调用方零额外成本：`webviewTag: true` 与 `did-attach-webview` 弹窗转发均为全局能力。
- aihot 五处出口统一替换为该函数：`AihotItemCard.vue`、`AihotHotTopicsView.vue`、`AihotStoryDrawerContent.vue`(openOnSite)、`AihotStoryReports.vue`(original || aihot)、`AihotDailyReport.vue`(openLink)。

## 注意事项

1. **UA 覆写**：站点普遍按 UA 拦截 Electron 流量导致白屏。内容组件基于宿主 Chromium 版本拼标准 Chrome UA（截取到 `(KHTML, like Gecko)` 后接 Chrome 版本 + Safari 尾缀）；UA 结构不符时退化为仅剔除 `Electron/x.y.z` 标记。
2. **partition 语义**：默认 `persist:link-preview` 持久化会话，与应用主 session 隔离，cookie / 登录态跨打开保留；换名即弃用旧数据（升级自原 `persist:aihot-webview`，aihot 站点 cookie / 登录态会重置一次）。
3. **src 只绑初值**：`:src="initialUrl"`（props 快照），若跟随地址栏变化会在每次跳转时触发重复加载；地址栏展示走 `getURL()` 单向同步。
4. **导航守卫与 _blank 链接**：主窗口 `will-navigate` 只作用于主 webContents，webview 不受影响。webview 内 `_blank` / `window.open` 走系统浏览器需两处配合：webview 带 `allowpopups` 属性（否则弹窗请求在任何 handler 前就被静默拦死）；Electron 22+ 已移除 `new-window` 事件且宿主 `setWindowOpenHandler` 不覆盖 guest，须在主进程 `did-attach-webview` 时给 guest 单独挂 handler → `shell.openExternal(url)` + deny。
5. **did-fail-load code -3** 是导航中断（如加载中再次跳转），必须忽略不算失败。
6. **销毁即回收**：`destroyOnClose` 卸载内容组件连带卸载 webview，guest 页面随之销毁，无泄漏残留。
7. **本地 html / mistrelle:// 不适用本抽屉**：`protocol.handle` 仅在默认 session 注册，带 partition 的 webview 取不到自定义协议；本地 html 渲染预览走 FilePreviewDialog 的 html 分支（无 partition webview），见 `docs/attachment/04`。