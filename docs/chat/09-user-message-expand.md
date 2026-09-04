# 用户消息折叠 / 展开（MChatUser）

> 用户消息内容默认折叠限高（3 行），底部逐渐模糊；模糊区中央向下箭头展开全部；展开后内容下方居中的向上箭头收起。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/components/chat/chat-user/MChatUser.vue` | 用户消息组件：折叠限高与渐变模糊、溢出检测、箭头展开 / 收起交互 |

## 交互结构

- 内容外包一层 `.content-wrap`（承担 `is-collapsed` class 与 `position: relative`），箭头按钮与模糊覆盖层都挂在 wrapper 上——箭头不能放在被模糊遮罩影响的容器内。
- **折叠态（默认）**：
  - 内容容器 `.r-chat-list__user-content` 设 `max-height: 66px; overflow: hidden`（行高 22px × 3 行；项目全局为 content-box，66px 恰好限 3 行文字，padding 不受限）。
  - wrapper（`.is-collapsed.is-faded`）`::after` 底部 30px 覆盖层：`backdrop-filter: blur(6px)` 模糊内容，覆盖层自身 `mask-image: linear-gradient(to bottom, transparent, black 90%)` 使模糊强度自上而下递增，形成"逐渐模糊"效果（替代省略号截断）。模糊层仅在 `isOverflow` 时出现（`is-faded`）——限高对 2~3 行短消息无副作用，但不能被无故糊掉。
  - `.toggle-arrow--down`（`ChevronDownIcon`）：绝对定位 `left: 50%; bottom: 4px; translateX(-50%)`，悬浮于模糊区中央，点击展开。
- **展开态**：移除 `is-collapsed`，容器不限高渲染全部内容；`.toggle-arrow--up`（`ChevronUpIcon`）以 `margin: 6px auto 0` 居中排在内容下方，点击收起。
- **`collapsed` ref** 默认 `true`，`toggle()` 切换。

## 溢出检测（是否需要箭头）

- **`isOverflow`**：折叠态下 `scrollHeight > clientHeight + 1` 判定内容是否溢出限高。
  - 原理：`scrollHeight` 不受 `max-height` 影响，返回完整内容高度；`clientHeight` 为限高后的可视高度。仅在折叠态下比较两者即可判断是否需要"展开"箭头。
- **按钮显隐条件**：
  - 折叠箭头：`collapsed && isOverflow`（短消息不显示任何箭头）；
  - 收起箭头：`!collapsed`（能进入展开态必然溢出过，无需再看 `isOverflow`）。
- **触发时机**：
  - `onMounted` → `nextTick` 后首次检测；
  - `watch(collapsed)` → `nextTick` 后重新检测；
  - `ResizeObserver` 监听内容容器尺寸变化（聊天窗口宽度变化会影响换行高度），`onUnmounted` 时 `disconnect`。

## 附件标签（图片预览 + 在文件夹中显示）

- `item.type === 'attachment'` 且 `fileType === 'image'`：标签外包 `t-popup`（`trigger="hover"`），浮层内 `t-image` 预览；`src` 由 `window.preload.net.pathToHref(file.url)` 转成本地事件服务资源 URL（`/file/<编码绝对路径>`），避免 dev 下 http 页加载本地路径被拦截。
- 点击任意附件标签：`window.preload.inject.shell.showItemInFolder(file.url)` 在系统文件管理器中定位该文件（hover 预览与 click 定位互不抢触发）。
- 非图片附件仍为普通 `t-tag` + `FileIcon`；图片用 `FileImageIcon`。

## 注意事项

- 内容为文本与 `t-tag` 标签内联混排，限高仅裁剪高度、不改布局语义，内联换行不受影响。
- 图片预览挂在 popup 浮层上（传送到 `body`），预览宽高样式必须写在不依赖 `.m-chat-user` 祖先的选择器上。
- 逐渐模糊依赖 `backdrop-filter` + `mask-image` 渐变，Electron（Chromium）环境完全支持。
- 样式均沿用 tdesign token（边框 `--td-component-border`；背景 `color-mix(in srgb, var(--td-bg-color-container) 72%, transparent)` 半透明毛玻璃；hover `--td-brand-color` / `--td-brand-color-light` / `--td-shadow-1`），禁止裸色值。
- 箭头按钮使用原生 `<button>` 实现（非业务弹窗场景），图标统一使用 tdesign icons。
