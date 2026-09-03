# 02 伙伴窗口（独立入口）

> 伙伴窗口：独立于 AI 主窗口的第二个窗口，独立 HTML 入口（`buddy.html` → `src/renderer/src/nested/buddy/`），承载硬件控制等独立页面。默认隐藏，托盘「打开伙伴」为唯一入口。

## 实现思路

- **默认隐藏**：启动不创建（比「创建但不显示」更彻底）；`showBuddyWindow()` 是唯一入口（托盘菜单），首次点击才创建，`ready-to-show` 时 show+focus
- **关闭只隐藏**：`close` 拦截 + hide（复用主窗口 `isAppQuitting()` 置位放行真关闭），窗口常驻，串口状态不受影响
- **独立入口**：`electron.vite.config.ts` renderer 段 `build.rollupOptions.input` 双入口（index + buddy）；dev 下 `ELECTRON_RENDERER_URL/buddy.html`，prod `loadFile(buddy.html)`
- **独立应用**：`nested/buddy/main.ts` 自行 createApp（pinia + 独立 router + uno/global 样式，不引 monaco）；`App.vue` 为精简外壳（drag 区域 + 空侧栏占位 + keep-alive router-view）；**不初始化记忆系统**（主/伙伴两 renderer 进程各跑一份会双写）
- **窗口样式复用**：`aiWindow.ts` 导出 `windowOptions()`（平台标题栏/毛玻璃配置）供 buddyWindow 覆盖尺寸/标题

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| main | `src/main/src/app/buddyWindow.ts` | 窗口生命周期：showBuddyWindow（惰性创建）/close 只隐藏/will-navigate 放行 buddy.html |
| main | `src/main/src/app/aiWindow.ts` | 导出 `windowOptions()`（二级窗口复用）与 `isAppQuitting()`（close 放行判定） |
| main | `src/main/src/app/tray.ts` | 托盘菜单：显示 AI 窗口 / **打开伙伴** / 退出 |
| renderer | `src/renderer/buddy.html` | 独立 HTML 入口（标题「伙伴」，script 指向 `/src/nested/buddy/main`） |
| renderer | `src/renderer/src/nested/buddy/main.ts` | 伙伴窗口应用入口（pinia + router + 全局样式） |
| renderer | `src/renderer/src/nested/buddy/App.vue` | 窗口外壳：左侧功能菜单（collapsed 折叠，主窗口 AppSide 同构）+ common-operator + router-view；`useColorMode()` 初始化暗色跟随 |
| renderer | `src/renderer/src/nested/buddy/router/index.ts` | 独立路由表（`/` → `/hardware/traffic-light`） |
| 构建 | `electron.vite.config.ts` | renderer `build.rollupOptions.input` 双入口（index + buddy） |

## 注意事项

- **nested 入口约定**：`src/renderer/src/nested/<name>/` 为独立窗口应用目录（main.ts + App.vue + router/ + pages/），与主窗口 `src/main.ts` 平行；新增独立窗口照此模式扩展 vite input
- **外壳与主窗口同构**：App.vue = 侧栏功能菜单（`menus` 数组，collapsed 折叠为 0 宽）+ window-drag-region + common-operator（折叠按钮）+ main-container（`padding-top: 48px` 避开拖动条）；折叠状态是伙伴窗口本地 ref，不与主窗口共享 localStorage
- **页面即纯内容**：菜单在 App.vue 壳上（对齐主窗口 AppSide 模式），路由页只渲染内容区；新增功能 = `menus` 加一项 + 路由表加一条 + pages 下建页面
- **preload 全量注入**：buddy.html 与 index.html 共用同一 preload（`window.preload` 全模块可用），无按窗口裁剪
- **will-navigate 守卫**：dev 放行 dev server 同源，prod 仅放行 `file://…/renderer/buddy.html`，其余导航一律吞掉（同主窗口防 file:// 劫持）
- **新建独立窗口页面时**：路由表加路由即可；页面如需 auto-import（ref/computed、tdesign 组件自动注册）无需额外配置，vite 插件对多入口统一生效
