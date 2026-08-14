# 用户消息折叠 / 展开（MChatUser）

> 用户消息内容默认最多显示 2 行，超出时显示「更多」按钮，点击展开全部；再次点击「收起」折叠回 2 行。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/components/chat/chat-user/MChatUser.vue` | 用户消息组件：折叠态样式、溢出检测、更多/收起交互 |

## 折叠与展开逻辑

- **折叠态（默认）**：内容容器 `.r-chat-list__user-content` 叠加 `is-collapsed` class，使用 `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden` 将内容限制为最多 2 行并省略号截断。
- **展开态**：移除 `is-collapsed`，容器恢复 `display: block`，渲染全部内容。
- **`collapsed` ref** 默认 `true`，控制 `is-collapsed` class 与按钮文案/图标：
  - 折叠时按钮显示 `ChevronDownIcon` +「更多」
  - 展开时按钮显示 `ChevronUpIcon` +「收起」
- **`toggle()`**：切换 `collapsed`。

## 溢出检测（是否需要按钮）

- **`isOverflow`**：折叠态下 `scrollHeight > clientHeight + 1` 判定内容是否存在换行溢出（超 2 行）。
  - 原理：`scrollHeight` 不受 `-webkit-line-clamp` 影响，返回完整内容高度；`clientHeight` 为 clamp 后的可视高度。仅在折叠态下比较两者即可判断是否需要「更多」按钮。
- **`canToggle`** = `!collapsed || isOverflow`：
  - 展开态恒显「收起」；
  - 折叠态仅当存在溢出才显示「更多」，单行/两行以内的消息不显示按钮。
- **触发时机**：
  - `onMounted` → `nextTick` 后首次检测；
  - `watch(collapsed)` → `nextTick` 后重新检测；
  - `ResizeObserver` 监听内容容器尺寸变化（聊天窗口宽度变化会影响换行高度），`onUnmounted` 时 `disconnect`。

## 注意事项

- 内容为文本与 `t-tag` 标签内联混排，折叠态使用 `-webkit-box` 仍可正常内联换行，布局语义不变。
- 文案、图标、样式均沿用 tdesign token（字体：`--td-font-body-small`；颜色：默认 `--td-text-color-placeholder`、hover `--td-brand-color`；间距：`--td-comp-*` 系列），禁止裸色值。
- 按钮使用原生 `<button>` 实现（非业务弹窗场景），图标统一使用 tdesign icons。
