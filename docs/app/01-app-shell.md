# 应用外壳生命周期：托盘常驻 + AI 主窗口

> 2026-08-29 落地，同日两轮重构（窗口模块化 → 双窗口启动即建/关闭只隐藏）；同日工作条（uTools 式快速启动条）整体移除，现为单窗口：**AI 主窗口默认显示、关闭只隐藏**。托盘为常驻入口。

## 启动编排（src/main/index.ts）

```
registerLocalSchemes()              // app ready 前：mistrelle:// 特权 scheme
app.whenReady:
  setAppUserModelId
  optimizer.watchWindowShortcuts    // browser-window-created 钩子
  registerIpc()                     // 全部业务 IPC
  registerLocalProtocol()
  registerAppTray()                 // 托盘常驻入口
  createAiWindow()                  // AI 主窗口：创建即显示（ready-to-show 后 show）
  app.on('activate', showAiWindow)  // macOS Dock 点击打开 AI 主窗口
before-quit → markQuitting()        // 放行 close 拦截，允许真退出
window-all-closed: 空实现           // 关闭=隐藏，几乎不触发；退出走托盘菜单
```

## 窗口模块

| 模块 | 职责 |
|------|------|
| `src/main/src/app/aiWindow.ts` | AI 主窗口：`createAiWindow()` 启动即建 + `showAiWindow()`（还原/聚焦，意外销毁则重建）；**`close` 拦截为只隐藏**（`isQuitting` 置位后放行真关闭）；`markQuitting()` 由 index.ts 在 `before-quit` 调用；will-navigate 守卫、webview 弹窗转发内聚在创建逻辑 |
| `src/main/src/app/tray.ts` | 托盘：菜单**显示 AI 窗口 / 退出**；**单击不做动作**（macOS 挂菜单后单击即弹菜单，Windows/Linux 单击无动作） |

## 闪退修复要点

- **关闭只隐藏（不 destroy）**：AI 窗口的 webContents 常驻，销毁后 IPC / 流式回调打到空引用（`webContents destroyed` 一类崩溃）不再发生；重建窗口的 `ready-to-show` 竞态也一并消除。
- **`before-quit → markQuitting()`**：close 拦截若不做放行，托盘退出 / Cmd+Q 会被 `preventDefault` 拦死，表现为「退不掉」；放行后正常销毁退出。
- **`closed` 事件置空窗口引用**：窗口挂 `closed → ref = null`，防御销毁后 `isDestroyed`/引用误用。
- **`app.getFileIcon` 原生崩溃（2026-08-29 两次崩溃报告实锤，全库禁用）**：macOS 26.5 × Electron 39.8.10 上该 API 在 Chromium 线程池（ThreadPoolForegroundWorker）内做 NSImage 操作，触发 `NSImage recache` 断言崩溃（SIGTRAP brk 0；两次崩溃同一原生偏移与寄存器，**串行化亦无效**——内部并发不受 JS 控制）。**今后任何模块取应用图标均不得调用 `app.getFileIcon`**（此前工作条改读 `.app/Contents/Resources/*.icns` 自解析，该模块已随工作条移除）；无调用方的 `os:getFileIcon` 孤儿通道已四连删（electronIpc/channels/inject/inject.d.ts）。

## 注意事项

- **入口约定**：托盘「显示 AI 窗口」与 macOS Dock 点击都走 `showAiWindow()`（纯显示，创建由 `createAiWindow()` 承担）。
- 主窗口「ready-to-show 后 show」在创建逻辑内自持，`showAiWindow()` 只做 restore/show/focus。
- 托盘图标用 `@resources/icon16.png?asset`（electron.vite.config.ts main 段 `@resources` 别名指向 `resources/`）。
- 模板残留的 `ping/pong` IPC 测试代码已随首轮重构移除。
- **工作条已整体移除（2026-08-29）**：`window.workbar`、`mistrelle://icon` 协议路由、`Alt+Space` 全局快捷键、`src/main/src/toolbar/`、`src/preload/toolbar.ts`、`toolbarChannels.ts`、`toolbarIpc.ts`、`src/renderer/toolbar.html`、`windows/toolbar/`、`types/toolbar.d.ts` 与 `pinyin-pro` 依赖均已删净；`window-all-closed` 空实现为托盘常驻防御，保留。勿再引用 docs/toolbar。

## 演进史（同日）

1. 首轮：窗口模块化 + 默认无窗口启动 + 托盘只有「打开工具条」；AI 窗口唯一入口=工作条。
2. 二轮：双窗口启动即建，AI 窗口默认显示、关闭只隐藏；托盘双入口（工具条 / AI 窗口）；补退出放行修复闪退。
3. 三轮（当前）：工作条整体移除，单窗口 + 托盘常驻；Dock 点击改为打开 AI 主窗口。
