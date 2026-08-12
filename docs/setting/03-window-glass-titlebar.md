# 窗口配置 —— 标题栏同色 + 背景高斯模糊

## 功能概述

窗口标题栏与页面背景统一为同一颜色（`#F4F4F4`），且窗口背景使用高斯模糊（磨砂玻璃）材质。毛玻璃完全由**窗口层**实现，页面 CSS 不参与模糊，仅增加一条必要的拖拽条保证隐藏标题栏后窗口仍可拖动。

## 实现思路

三平台都隐藏系统标题栏，标题栏区域即窗口背景色；再按各平台能力启用系统级毛玻璃：

| 平台    | 标题栏                                       | 毛玻璃                                  | 背景色            |
|---------|----------------------------------------------|-----------------------------------------|-------------------|
| darwin  | `titleBarStyle: 'hiddenInset'`（保留交通灯） | `vibrancy: 'under-window'` + `visualEffectState: 'active'` | `#00000000`（透明，露出 vibrancy） |
| win32   | `titleBarStyle: 'hidden'` + `titleBarOverlay`（原生控制按钮，色 `#F4F4F4` 高 40） | `backgroundMaterial: 'acrylic'` | `#00000000`（透明，acrylic 才可见） |
| linux   | `titleBarStyle: 'hidden'` + `titleBarOverlay` | 无（无毛玻璃能力）                    | `#F4F4F4`（实色） |

关键点：**毛玻璃必须配合透明背景**才可见。此前 `backgroundMaterial: 'acrylic'` + 实色 `#F4F4F4` 导致 Windows 上 acrylic 从未生效。

## 关键文件

| 文件                                              | 角色                                                                       |
|---------------------------------------------------|----------------------------------------------------------------------------|
| `src/main/index.ts`                               | `windowOptions()`：按 `process.platform` 返回平台化 `BrowserWindow` 选项    |
| `src/renderer/src/App.vue`                        | `.window-drag-region` 全宽 32px 拖拽条（`-webkit-app-region: drag`）；`.common-operator` 避让交通灯（`left: 76px`）+ `no-drag` |

## 数据 / 契约

- `WINDOW_BACKGROUND = '#F4F4F4'`：页面背景基准色，与渲染层 `theme.less` 亮色页面背景一致；改动页面背景色时需同步此常量及 `titleBarOverlay.color`。
- `platformOptions` 以 `NodeJS.Platform` 为键（`darwin` / `win32` / `linux`），兜底 `{ backgroundColor: WINDOW_BACKGROUND }`。

## 注意事项

- **拖拽区层级**（`App.vue`）：`.window-drag-region` `z-index: 52`，`.common-operator` `z-index: 60` 且自身 `no-drag` 保证按钮可点击。拖拽条覆盖 `main-container` 顶部 32px，若未来某页面顶部出现可交互元素，需在元素上加 `-webkit-app-region: no-drag` 或调低拖拽条高度。
- **交通灯避让**：macOS `hiddenInset` 下交通灯位于左上角，`.common-operator` 原 `left: 8px` 会重叠，故改为 `left: 76px`。
- **亮暗主题**：当前 `titleBarOverlay` / `backgroundColor` 均为亮色基准。若引入深色主题，需同步调整 `WINDOW_BACKGROUND` 与 overlay 配色，或改为跟随主题的动态值。
- **Windows overlay 验证**：`titleBarOverlay.color` 用实色 `#F4F4F4`，与 acrylic 透明背景的最终观感需在 Windows 实机验证。
