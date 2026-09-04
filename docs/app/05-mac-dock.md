# 05 - macOS Dock 跟随窗口可见性

> 2026-09-04 落地。Windows 任务栏随窗口生灭，macOS Dock 则应用运行即常驻；本功能对齐 Windows 体验——**任一窗口可见才显示 Dock，全部隐藏即隐藏 Dock**，并按可见窗口分流 Dock 点击行为。

## 行为规则（仅 darwin 生效，Windows / Linux 完全不变）

| 场景 | 行为 |
|------|------|
| 任一窗口可见 | 显示 Dock |
| 两个窗口都隐藏 | 隐藏 Dock（应用转为 accessory 纯托盘形态） |
| Dock 点击：仅 AI 可见 / 双开 / 兜底（全隐，防御） | 唤起 AI 窗口 |
| Dock 点击：仅伙伴窗口可见 | 唤起伙伴窗口 |
| 启动时 | AI 窗口默认隐藏（防闪退，见 01 文档）、伙伴未创建 → Dock 立即隐藏 |
| 窗口最小化 | 不算隐藏（`isVisible()` 仍为 true），Dock 保持显示，点 Dock 走 `restore()` |

Dock 隐藏后图标消失，`activate` 不再触发——**托盘菜单是全隐态下唯一唤醒入口**（「显示 AI 窗口 / 打开伙伴」）。

## 实现

### 新模块 `src/main/src/app/macDock.ts`（只依赖 electron，零 app 内部 import 防循环依赖）

| 导出 | 职责 |
|------|------|
| `trackMacDockWindow(name, win)` | 建窗时登记进 `dockWindows`（`Map<'ai'\|'buddy', BrowserWindow>`，联合 type 独立命名 `MacDockWindowName`）；监听 `show`/`hide` 驱动 `syncMacDock`，`closed`（退出真销毁）时移除 |
| `ensureMacDockVisible()` | 显示窗口**前**调用；Dock 隐藏态则 `app.dock.show()` + `app.focus({ steal: true })` |
| `syncMacDock()` | 任一登记窗口可见 → `dock.show()`；全隐 → `dock.hide()`；状态不变则跳过（幂等） |
| `isMacDockWindowVisible(name)` | 只读查询，供 index.ts activate 分流 |

### 接线点（3 处）

- `aiWindow.ts`：`createAiWindow` 建窗后 `trackMacDockWindow('ai', win)`；`showAiWindow` 首行 `ensureMacDockVisible()`
- `buddyWindow.ts`：`createBuddyWindow` 建窗后 `trackMacDockWindow('buddy', win)`；`showBuddyWindow` 首行 `ensureMacDockVisible()`（首行同时覆盖「首次创建」分支）
- `index.ts`：`whenReady` 中 `createAiWindow()` 后 `syncMacDock()` 启动归位；`app.on('activate')` 按可见性分流（不再直接 `showAiWindow`）

### 数据流闭环

- 隐藏路径：close 拦截 → `win.hide()` → `hide` 事件 → `syncMacDock()` → 全隐则 `dock.hide()`
- 显示路径：托盘 / activate → `showXxxWindow()` → `ensureMacDockVisible()` → `show()+focus()` → `show` 事件 → `syncMacDock()`（幂等）

## 关键陷阱与注意

1. **accessory 焦点陷阱**：`app.dock.hide()` 会把应用切成 accessory（后台应用），此状态下直接 `win.show()` / `win.focus()` 窗口可见但拿不到键盘焦点。必须先 `app.dock.show()`（激活策略转回 Regular）再 show；策略切换存在时序差，追加 `app.focus({ steal: true })` 保证可立即键入。**新增显示窗口的代码路径必须走 `showAiWindow` / `showBuddyWindow`，勿绕过。**
2. **`app.dock` 类型为 `Dock | undefined`**（仅 macOS 存在）：平台判断无法让 tsc 收窄，经 `getDock()`（`process.platform === 'darwin' ? app.dock : undefined`）局部变量收窄，禁止 `as` 断言。
3. **循环依赖防线**：`macDock.ts` 只 import electron；窗口模块单向 import 它。activate 分流需要的 `showAiWindow` / `showBuddyWindow` 留在 index.ts 注入调用，勿搬进 macDock。
4. **新增窗口纳入联动**：扩展 `MacDockWindowName` 联合 + 建窗处 `trackMacDockWindow` + activate 分流规则三处同步。
5. 启动瞬间 Dock 图标会闪现一下（app 启动 → `whenReady` 里 `syncMacDock()` 隐藏），属预期。

## 相关文档

- [01-app-shell.md](./01-app-shell.md) —— 应用外壳生命周期（close 只隐藏 / before-quit 放行）
- [02-buddy-window.md](../hardware/02-buddy-window.md) —— 伙伴窗口（默认隐藏、托盘唯一入口）
