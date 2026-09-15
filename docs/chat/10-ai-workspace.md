# AiWorkspace 工作目录选择组件

## 职责

聊天发送栏底部的工作目录选择器，位于 `LChatSender.vue` 左侧（`showWorkspace` 控制显隐）。

## 两种形态

| 形态 | 触发条件 | 交互 |
|------|----------|------|
| 非只读（默认） | `readonly=false` | `t-dropdown` 点击展开：清除 / 清空并替换 / 选择目录 / 最近使用历史 |
| 只读（锁定） | `readonly=true` | 纯文本展示当前目录，`cursor: default` 无 hover 动画；点击用 `shell.openPath` 打开目录 |

只读场景：聊天室创建后工作空间锁定（`lockWorkspace`），已选择时 `AiWorkspace` 以只读展示，不可再修改；未选择时组件隐藏（`v-if="showWorkspace && (!lockWorkspace || workspaceRef)"`）。

## 关键文件

- `src/renderer/src/windows/main/components/chat/AiWorkspace.vue`（组件本体）
- `src/renderer/src/windows/main/components/chat/sender/LChatSender.vue`（使用方，`lockWorkspace` prop）

## 数据结构 / API 契约

- `workspace`：`defineModel<string>`，当前工作目录绝对路径，空串表示未选择
- `history`：`useUtoolsDbAsync(LocalNameEnum.KEY_AI_WORKSPACE, [])`，最近使用目录列表（选择新目录时 push，去重）
- 目录选择：`window.preload.inject.dialog.open({ properties: ['openDirectory'] })`，返回路径数组
- 只读打开目录：`window.preload.inject.shell.openPath(fullPath)`（返回 `Promise<void>`，空路径不触发）

## 注意事项

- 只读分支必须保持静态：`cursor: default`、`transition: none`（覆盖全局 `*` transition 带来的颜色过渡动画）、`user-select: none`
- 只读时鼠标不显示手型（`role="button"` 仅为语义标记，不改变光标）
- 点击选择/清除等操作经 `debounce(300ms)` 防抖（`handleClickDebounced`）
