# 待办进度按钮（TodoProgressButton）

> 对话头部全屏按钮左侧的待办进度入口：有待办时显示「第 X / N 步」+ 圆环进度，点击弹出待办列表。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/components/chat/TodoProgressButton.vue` | 自包含进度按钮组件：圆环 + 文案 + `t-popup` 弹层 |
| `src/components/chat/TodoList.vue` | 弹层内容：待办列表渲染（复用，未改动） |
| `src/components/chat/LChatEngine.vue` | 头部工具栏挂载点：`ml-auto` 容器内、全屏按钮左侧 |

## 数据来源与语义

- 数据源：`session.chat.todos`（`Ref<TodoItem[]>`），`LChatEngine` 以 `:todos="instance.todos.value"` 传入。
- `totalSteps`（N）= `todos.length`。
- `currentStep`（X，1 起）取值优先级：
  1. `in_progress` 项 → 其序号 + 1；
  2. 无进行中项 → 第一个非 `completed` 项序号 + 1；
  3. 全部完成 → N。
- `todoPercent`（圆环）= `round(completed 数 / totalSteps × 100)`。

> 语义约定（已与产品确认）：X 表示「当前进行到第几步」，圆环表示「已完成比例」，两者不同源。

## 交互与展示

- **无待办**：`t-popup v-if="totalSteps > 0"` 使整个按钮隐藏。
- **有待办**：`t-button`（text 变体）内为 `t-progress theme="circle"`（`size=22`、`stroke-width=3`、`label=false`）+ 「第 X / N 步」文案。
- **点击**：`t-popup`（`trigger="click"`、`placement="bottom-right"`）弹层内渲染 `TodoList.vue`。
- 弹层 `overlay-inner-style` 设置 `max-height: 300px; overflow: auto`，防止长列表溢出；`t-popup` 默认挂载 body，不受外层 `overflow: hidden` 裁剪。

## 注意事项

- 组件自带「空待办隐藏」逻辑，调用方无需再包 `v-if`。
- 头部队列顺序：待办按钮 → 全屏 → 侧边栏，待办按钮始终在全屏按钮左面。
- 圆环线宽不得超过 `size / 2`（当前 3 < 11，安全）。
