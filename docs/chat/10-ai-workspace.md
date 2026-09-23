# 10 - AiWorkspace 工作目录选择组件

## 职责

发送栏的**工作目录选择器**，渲染在 `LChatSender.vue` 输入区上方的工作空间行里（`showWorkspace` 控制该行显隐，见 [23-chat-workspace-row.md](./23-chat-workspace-row.md)）。

## 形态

单一形态（原有的只读锁定形态已于 2026-09-22 删除，聊天页改为整块不渲染）：

| 形态 | 交互 |
|------|------|
| popup 选择面板 | `t-popup`（`placement="top"`）点击展开：搜索框 + 最近目录列表（hover 出删除）+ 已选中时「清除工作目录 / 清空并替换目录」、未选中时「选择目录」 |

- 触发器：`t-button`（`variant="text"`），图标随状态切换（已选中 `FolderFilledIcon` + 品牌色，未选中 `FolderAdd1Icon`），文案为当前目录名或「选择工作目录」。
- 面板数据源与左侧聊天列表分组**共用** `useWorkspaceList`，保证两侧列表一致。

## 关键文件

- `src/renderer/src/windows/main/components/AiWorkspace.vue`（组件本体，242 行）
- `src/renderer/src/windows/main/components/useWorkspaceList.ts`（工作空间共享数据源）
- `src/renderer/src/windows/main/components/sender/LChatSender.vue`（使用方，`showWorkspace` 控制显隐）

## 数据结构 / API 契约

- `workspace`：`defineModel<string>`，当前工作目录绝对路径，空串表示未选择
- `useWorkspaceList()`：合并「聊天绑定的目录」与「最近目录历史」，提供 `workspaces` / `displayName` / `addHistory` / `removeWorkspace` / `countChats`
- 目录选择：`window.preload.inject.dialog.open({ properties: ['openDirectory'] })`，返回路径数组
- 组件**不接收** props：显隐由使用方的 `v-if`（`showWorkspace`）决定，工作目录本身走 `v-model`

## 注意事项

- 不要重新引入只读 / 锁定形态：聊天页（`LChatEngine`）已改为不渲染工作空间行，需要回显的场景走左侧列表项目分组。
- 面板向上弹出（`placement="top"`）：触发器位于发送栏顶部，向下弹会被输入区遮挡。
- 删除工作空间是**连带删除**（其下聊天与产物一并删除），必须走 `MessageBoxUtil.confirm` 二次确认。
