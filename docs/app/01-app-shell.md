# 应用外壳生命周期：托盘常驻 + 双窗口启动即建

> 2026-08-29 落地，同日两轮重构（窗口模块化 → 双窗口启动即建/关闭只隐藏）。应用启动即创建两个窗口：**AI 主窗口默认显示、关闭只隐藏**；**工作条默认隐藏、快捷键唤起、失焦隐藏、无控制按钮**。托盘为常驻入口。

## 启动编排（src/main/index.ts）

```
registerLocalSchemes()              // app ready 前：mistrelle:// 特权 scheme
app.whenReady:
  setAppUserModelId
  optimizer.watchWindowShortcuts    // browser-window-created 钩子
  registerIpc()                     // 全部业务 IPC
  registerLocalProtocol()
  registerAppTray()                 // 托盘常驻入口
  registerToolbarShortcut()         // Alt+Space 工作条
  createToolbarWindow()             // 工作条：创建即隐藏
  createAiWindow()                  // AI 主窗口：创建即显示（ready-to-show 后 show）
  app.on('activate', showToolbar)   // macOS Dock 点击唤起工具条
before-quit → markQuitting()        // 放行 close 拦截，允许真退出
window-all-closed: 空实现           // 关闭=隐藏，几乎不触发；退出走托盘菜单
will-quit → 注销全局快捷键
```

## 窗口模块

| 模块 | 职责 |
|------|------|
| `src/main/src/aiWindow/aiWindow.ts` | AI 主窗口：`createAiWindow()` 启动即建 + `showAiWindow()`（还原/聚焦，意外销毁则重建）；**`close` 拦截为只隐藏**（`isQuitting` 置位后放行真关闭）；`markQuitting()` 由 index.ts 在 `before-quit` 调用；will-navigate 守卫、webview 弹窗转发内聚在创建逻辑 |
| `src/main/src/toolbar/toolbarWindow.ts` | 工作条：`createToolbarWindow()` 启动即建默认隐藏；`showToolbar()` 只开不关（托盘菜单/Dock 用）、`toggleToolbar()` 切换（快捷键用）；`ready-to-show` 只置就绪标记不自动弹窗；**失焦即隐藏（devtools 打开豁免）**、多屏跟随、frameless 无控制按钮；`present()` 显示即聚焦（darwin `app.focus({steal:true})` + moveTop，launcher 语义） |
| `src/main/src/tray/appTray.ts` | 托盘：菜单**显示工具条 / 显示 AI 窗口 / 退出**；**单击不做动作**（macOS 挂菜单后单击即弹菜单，Windows/Linux 单击无动作） |

## 闪退修复要点

- **关闭只隐藏（不 destroy）**：AI 窗口的 webContents 常驻，销毁后 IPC / 流式回调打到空引用（`webContents destroyed` 一类崩溃）不再发生；重建窗口的 `ready-to-show` 竞态也一并消除。
- **`before-quit → markQuitting()`**：close 拦截若不做放行，托盘退出 / Cmd+Q 会被 `preventDefault` 拦死，表现为「退不掉」；放行后正常销毁退出。
- **`closed` 事件置空窗口引用**：两窗口都挂 `closed → ref = null`，防御销毁后 `isDestroyed`/引用误用。
- **`app.getFileIcon` 原生崩溃（2026-08-29 两次崩溃报告实锤，闪退根因）**：macOS 26.5 × Electron 39.8.10 上该 API 在 Chromium 线程池（ThreadPoolForegroundWorker）内做 NSImage 操作，触发 `NSImage recache` 断言崩溃（SIGTRAP brk 0；两次崩溃同一原生偏移与寄存器，**串行化亦无效**——内部并发不受 JS 控制）。根治：**全库不再调用 `app.getFileIcon`**——工作条图标改读 `.app/Contents/Resources/*.icns` 自解析内嵌 PNG（纯 Buffer）；无调用方的 `os:getFileIcon` 孤儿通道四连删（electronIpc/channels/inject/inject.d.ts）。详见 docs/toolbar/01。

## 注意事项

- **入口约定**：托盘 / Dock / 工作条内置「AI」都能打开 AI 主窗口；`showAiWindow()` 已是纯显示（不负责创建语义，创建由 `createAiWindow()` 承担）。
- 主窗口「ready-to-show 后 show」在创建逻辑内自持，`showAiWindow()` 只做 restore/show/focus。
- 托盘图标用 `@resources/icon16.png?asset`（electron.vite.config.ts main 段 `@resources` 别名指向 `resources/`）。
- 模板残留的 `ping/pong` IPC 测试代码已随首轮重构移除。

## 演进史（同日）

1. 首轮：窗口模块化 + 默认无窗口启动 + 托盘只有「打开工具条」；AI 窗口唯一入口=工作条。
2. 本轮（当前）：双窗口启动即建，AI 窗口默认显示、关闭只隐藏；托盘双入口（工具条 / AI 窗口）；补退出放行修复闪退。