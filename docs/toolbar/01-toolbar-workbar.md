# 工作条（uTools 式快速启动条）

> 2026-08-29 落地，同日类型化改造。参考 uTools：全局快捷键唤起屏幕顶部悬浮搜索条，拼音/首字母/名称搜索条目，Enter 激活。条目分类型：应用程序 / 内置应用（网页快开、拓展插件为预留类型）。

## 实现思路

- **窗口**：`BrowserWindow` 懒创建（首次 `Alt+Space` 才建窗，`ready-to-show` 前忽略连按防透明窗闪烁），之后 `hide/show` 秒开。frameless + 透明 + `alwaysOnTop` + `skipTaskbar`，每次唤起定位到光标所在屏幕 `workArea` 顶部居中（多显示器跟随）。**显示即聚焦**（darwin `app.focus({steal:true})` + moveTop），**失焦自动隐藏**（devtools 打开豁免）。窗口模块详见 [docs/app/01-app-shell.md](../app/01-app-shell.md)。
- **条目模型（类型化）**：`ToolbarItem { type, name, target, icon }`，`type: ToolbarItemType = 'app' | 'builtin'`（独立命名联合，网页快开/拓展插件预留）。列表 = 内置应用（排最前）+ 系统应用（按名称排序）。
  - **内置应用**：`src/main/src/toolbar/builtinItems.ts`，目前仅 `AI` 一项（target='ai'，图标用应用图标）；激活 → `showAiWindow()` 懒创建主窗口。
  - **应用程序（仅 darwin）**：`appScanner.ts` 扫描 `/System/Applications` → `/Applications` → `~/Applications`（后扫覆盖先扫=用户目录优先）；图标 `app.getFileIcon(path, { size: 'large' })` → `toDataURL()`，8 个一批并发，单个失败降级空串。**进程内缓存一次**，应用重启前不重扫。
  - **激活分发**（toolbarIpc）：`builtin` 按 target 分发（'ai' → 主窗口）；`app` 先校验 target 来自扫描列表（防渲染层伪造任意路径）再 `shell.openPath`。返回空串成功 / 错误信息。
- **搜索匹配在渲染层**：仅启动时 1 次 `getItems` IPC 拉全量条目，`pinyin-pro` 动态 `import`（词典大，不阻塞首屏）预建「归一化名称 / 全拼 / 首字母」三字段索引；键入本地过滤（`includes` 三路命中，名称/全拼前缀优先排序），零逐键 IPC。
- **图标走 `mistrelle://icon/<target>` 自定义协议（防崩溃）**：列表不携带图标（应用项 `icon:''`），渲染层 `<img>` 直接引用协议 URL，浏览器按需请求 + 自发缓存；协议 handler（protocol.ts）校验 target 在扫描列表后调 `getAppIconPng` 串行取 PNG。**「application/getFileIcon」在 macOS 26.5 × Electron 39 上会触发 NSImage 断言崩溃（SIGTRAP brk 0，两次崩溃报告同一原生偏移；JS 串行亦无效——该 API 内部仍在 Chromium 线程池做 NSImage 操作）→ 已根治为不调用该 API，改读 `.app/Contents/Resources/*.icns` 自解析内嵌 PNG（纯 Buffer 解析，见 `appScanner.ts`），无 icns 的应用由首字母头像兜底；无调用方的 `os:getFileIcon` 孤儿通道亦已删除**。今后取图标一律走 icns 自解析，勿引入 `app.getFileIcon`。
- **独立 preload**：工作条窗口不挂主应用 `preload/index.js` 全量 API 面，用独立入口 `src/preload/toolbar.ts` 只暴露 4 个方法（最小 API 面，窗口不开 `nodeIntegration`）。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/preload/toolbar.ts` | 工作条独立 preload 入口（多入口产物 `out/preload/toolbar.js`），暴露 `window.workbar` |
| `src/preload/src/ipc/toolbarChannels.ts` | 工作条域通道常量 + `ToolbarItemType`/`ToolbarItem` 契约 |
| `src/main/src/toolbar/toolbarWindow.ts` | 窗口创建/定位/toggle/失焦隐藏 + `Alt+Space` 全局快捷键注册注销 |
| `src/main/src/toolbar/appScanner.ts` | darwin 应用目录扫描 + 图标自解析（读 .icns 提 PNG，**绝不用 app.getFileIcon**）+ 串行单飞 + 缓存 |
| `src/main/src/protocol.ts` | `mistrelle://` 协议：`local/` 读盘 + `icon/<target>` 工作条图标路由（列表校验 + PNG 响应） |
| `src/main/src/toolbar/builtinItems.ts` | 内置应用列表（当前仅 AI） |
| `src/main/src/ipc/toolbarIpc.ts` | 3 个 handler + 激活按类型分发，经 `registerIpc.ts` 注册 |
| `electron.vite.config.ts` | renderer/preload 各补 `rollupOptions.input` 多入口（**缺省只产出 index，不补则生产构建没有 toolbar.html**） |
| `src/renderer/src/windows/toolbar/main.ts` | 渲染入口：轻量秒开，不挂 router/pinia/monaco |
| `src/renderer/src/windows/toolbar/ToolbarApp.vue` | t-input（自动聚焦）+ t-list 结果列表（内置项带「内置」t-tag）+ t-empty/t-loading；↑↓/Enter/Esc 键盘导航 |
| `src/renderer/src/windows/toolbar/useAppSearch.ts` | 拼音索引构建 + 本地过滤（模块级单例） |
| `src/renderer/src/types/toolbar.d.ts` | `ToolbarItem`/`ToolbarApi` 渲染层契约 |

## 契约

```ts
// IPC（ToolbarChannels）
getItems: 'toolbar:item:list'     // → ToolbarItem[]（内置排最前 + 系统应用，应用项 icon:''
                                   //   不携带，主进程缓存）
activate: 'toolbar:item:activate' // (item) → 按类型分发；空串成功/否则错误信息
hide:     'toolbar:hide'

// 图标（不走 IPC）：应用项 <img src="mistrelle://icon/<encodeURIComponent(target)>">
//   协议 URL 约定见 protocol.ts；内置应用图标内联在 item.icon（dataURL）

// window.workbar（contextBridge）
getItems(): Promise<ToolbarItem[]>           // { type: 'app'|'builtin', name, target, icon }
activate(item: ToolbarItem): Promise<string> // app→openPath(target)；builtin('ai')→主窗口
hide(): Promise<void>
```

## 注意事项

- **全局名必须是 `window.workbar` 而非 `window.toolbar`**：DOM 标准里 `window.toolbar` 是遗留 `BarProp` 属性（与 locationbar/menubar 同族），声明会撞名。
- 快捷键固定 `Alt+Space`（macOS 显示 ⌥Space，uTools 同款）；`will-quit` 时须注销，已接在 `src/main/index.ts`。
- 应用列表（`Dirent[]` 显式标注 `readdir` 返回，规避 Buffer 泛型陷阱）；win32/linux 扫描策略不同，暂未实现。
- 渲染层空查询=全部条目（内置排最前）；结果上限 50 条。
- 每次 `focus`（即每次唤起）重置查询词、选中项并聚焦输入框。
- 新增内置应用：在 `builtinItems.ts` 加条目（定 target 标识）+ 在 `toolbarIpc.activateItem` 加分发分支即可，渲染层零改动。

## preload src 平铺重组（同批落地）

18 个平铺文件按职责归入两目录，`~/` 别名与相对引用已全量同步（main 侧 25 处 + preload/index.ts 15 处）：

```
src/preload/src/
├── ipc/   # IPC 桥 + 通道常量：channels、inject、aiStream、db+dbChannels、font、fs、
│          # ppt、safeStorage、shellExec、template+templateChannels、toolbar+toolbarChannels
└── lib/   # 本地纯函数/Node 能力：crypto、iconv、net、path、webUtils、zip
```

- ipc/ 内部 `./channels`、`./dbChannels` 等相对引用随同目录移动无需改动；`inject.ts` 归 ipc（全 IPC 桥聚合）。
- `preload/index.ts` 主应用 API 组装逻辑不变，仅 import 路径更新。
