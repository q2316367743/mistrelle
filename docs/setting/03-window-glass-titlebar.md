# 窗口配置 —— 标题栏同色 + 背景高斯模糊 + 跨平台标题边距

## 功能概述

窗口标题栏与页面背景统一为同一颜色（`#F4F4F4`），且窗口背景使用高斯模糊（磨砂玻璃）材质。毛玻璃完全由**窗口层**实现，页面 CSS 不参与模糊，仅增加一条必要的拖拽条保证隐藏标题栏后窗口仍可拖动。

顶部 48px 为全局标题栏区：`.window-drag-region` 全宽拖拽 + 各页面 header（`PageLayout` / `LChatEngine` 自建 header 同高）。系统控制按钮位置随平台不同（macOS 左上、Windows/Linux 右上），渲染层边距由 `useTitlePadding` 统一适配（见下文）。

## 实现思路

三平台都隐藏系统标题栏，标题栏区域即窗口背景色；再按各平台能力启用系统级毛玻璃：

| 平台    | 标题栏                                       | 毛玻璃                                  | 背景色            |
|---------|----------------------------------------------|-----------------------------------------|-------------------|
| darwin  | `titleBarStyle: 'hiddenInset'` + `trafficLightPosition: { x: 8, y: 17 }`（保留交通灯，下移到 48px 标题栏垂直居中） | `vibrancy: 'under-window'` + `visualEffectState: 'active'` | `#00000000`（透明，露出 vibrancy） |
| win32   | `titleBarStyle: 'hidden'` + `titleBarOverlay`（原生控制按钮，色 `#F4F4F4` 高 40、宽约 138px） | `backgroundMaterial: 'acrylic'` | `#00000000`（透明，acrylic 才可见） |
| linux   | `titleBarStyle: 'hidden'` + `titleBarOverlay` | 无（无毛玻璃能力）                    | `#F4F4F4`（实色） |

关键点：**毛玻璃必须配合透明背景**才可见。此前 `backgroundMaterial: 'acrylic'` + 实色 `#F4F4F4` 导致 Windows 上 acrylic 从未生效。

## 跨平台标题边距（useTitlePadding）

`src/renderer/src/hooks/UseTitlePadding.ts`：按 `window.preload.inject.os.isMacOS()`（同步）返回四个数值，平台运行期不变故为普通数值、非响应式。`r1` 是**叠加在各 header 基础 padding 之上**的额外避让值，非绝对距离（macOS 视觉与既有一致）。

| 值  | macOS | Windows/Linux | 含义（几何推导）                                                       |
|-----|-------|---------------|------------------------------------------------------------------------|
| l1  | 76    | 8             | `App.vue` 收起按钮 `left`；macOS = 交通灯区（8 + 约 62）+ 间隙          |
| l2  | 156   | 88            | 侧栏收起时标题 `padding-left` = `l1 + (32 + 8) × 2`（收起 + 新建按钮） |
| l3  | 116   | 48            | `/design/detail/` 专用 = `l1 + 32 + 8`（该页不展示新建按钮）           |
| r1  | 0     | 146           | 右侧额外避让 = titleBarOverlay 宽约 138 + 8                            |

消费方式：各组件 setup 中取值 → `computed` 拼 `px` 字符串 → `<style>` 内 `v-bind()` 注入。

| 消费方                                | 用法                                                                       |
|---------------------------------------|----------------------------------------------------------------------------|
| `App.vue`                             | `.common-operator { left: v-bind(operatorLeft) }`（l1）                     |
| `components/PageLayout/PageLayout.vue`| `pl` prop 无默认值，`props.pl ?? \`${l2}px\``；右 padding `24 + r1`         |
| `components/chat/LChatEngine.vue`     | header `padding: 8px (8 + r1)`；collapsed `padding-left: l2`                |
| `pages/design/detail/index.vue`       | `<page-layout :pl="\`${l3}px\`">`                                           |

注意：`defineProps` 默认值在编译后提升至模块作用域，不能引用 setup 变量，故 `PageLayout` 的 `pl` 改为无默认值 + computed 兜底。原常量 `ASIDE_PADDING_LEFT`（= macOS 的 l2）已删除。

## 关键文件

| 文件                                              | 角色                                                                       |
|---------------------------------------------------|----------------------------------------------------------------------------|
| `src/main/index.ts`                               | `windowOptions()`：按 `process.platform` 返回平台化 `BrowserWindow` 选项    |
| `src/renderer/src/hooks/UseTitlePadding.ts`       | 跨平台标题边距 hook（l1/l2/l3/r1，见上节）                                 |
| `src/renderer/src/App.vue`                        | `.window-drag-region` 全宽 48px 拖拽条（`-webkit-app-region: drag`）；`.common-operator` 定位于 `l1` 且 `no-drag` |

## 数据 / 契约

- `WINDOW_BACKGROUND = '#F4F4F4'`：页面背景基准色，与渲染层 `theme.less` 亮色页面背景一致；改动页面背景色时需同步此常量及 `titleBarOverlay.color`。
- `platformOptions` 以 `NodeJS.Platform` 为键（`darwin` / `win32` / `linux`），兜底 `{ backgroundColor: WINDOW_BACKGROUND }`。
- `trafficLightPosition`（darwin）：指定后 Electron 源码 `native_window_mac.mm` 中会**优先于** `hiddenInset` 默认位 `(12, 11)`，故可保留 `hiddenInset` 再自定义交通灯位置（当前为 `(8, 17)`，对应 48px 标题栏垂直居中）。

## 注意事项

- **拖拽区层级**（`App.vue`）：`.window-drag-region` `z-index: 52`，`.common-operator` `z-index: 60` 且自身 `no-drag` 保证按钮可点击。拖拽条覆盖顶部 48px，若未来某页面顶部出现可交互元素，需在元素上加 `-webkit-app-region: no-drag` 或调低拖拽条高度。
- **交通灯避让**：macOS `hiddenInset` 下交通灯位于左上角，收起按钮 `left` 取 `l1 = 76`；Windows/Linux 左侧无系统按钮，`l1 = 8`，右侧 header 需叠加 `r1 = 146` 避开 `titleBarOverlay` 控制按钮。
- **数值联动**：`useTitlePadding` 中的 `OPERATOR_SIZE`（32）/ `OPERATOR_GAP`（8）须与 `App.vue` `.common-operator` 的按钮尺寸、间距保持一致；改动标题栏高度（48px）或 overlay 配置时需同步核对此 hook。
- **亮暗主题**：当前 `titleBarOverlay` / `backgroundColor` 均为亮色基准。若引入深色主题，需同步调整 `WINDOW_BACKGROUND` 与 overlay 配色，或改为跟随主题的动态值。
- **Windows overlay 验证**：`titleBarOverlay.color` 用实色 `#F4F4F4`，与 acrylic 透明背景的最终观感需在 Windows 实机验证。
