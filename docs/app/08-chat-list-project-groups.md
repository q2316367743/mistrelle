# 08 - 聊天列表项目分组

> 2026-09-12：侧边栏聊天列表从平铺改为以项目为核心的分组列表。
> 2026-09-13：工作空间统一数据源（合并口径）+ 删除工作空间能力，见文末「工作空间合并口径与删除」。
> 2026-09-25：分组内默认只显示最近 8 条，超出部分由组内末尾「查看更多」展开，见文末「分组内默认 8 条 + 查看更多」。

## 需求与拍板

参考 Z-Code 等编程 Agent 的左侧列表形态，聊天列表按「项目」分组：

- **项目的判定依据 = 聊天绑定的 `workspace`（真实工作目录路径）**，复用现有字段，零新实体、零迁移。
  - `AiChatItem.workspace` 自创建时从 PageNew 的目录选择器带入，聊天页输入区 `lock-workspace`（readonly），**创建后锁定**，数据可靠。
  - DB 的 `project_id` 列维持闲置，未启用独立项目实体。
- **「任务列表」置顶**（未绑定目录的聊天），项目分组在后，按组内最近聊天时间降序。
- 分组头**可折叠**（默认展开，折叠态不持久化）；项目分组头 hover 显示**「新建聊天」按钮**。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/renderer/src/windows/main/pages/app/components/useChatGroups.ts` | 分组 composable：`useChatGroups()` 返回 `{ rows, toggleGroup }` |
| `src/renderer/src/windows/main/pages/app/components/ChatList.vue` | 列表渲染：rows 拍平交给 `VList`（虚拟滚动，统一 item-size 36） |
| `src/renderer/src/windows/main/pages/new/PageNew.vue` | `?workspace=` 预填工作目录 |
| `src/renderer/src/windows/main/components/chat/useWorkspaceList.ts` | 工作空间共享数据源（合并口径）+ 删除能力，面板与左侧分组共同消费 |
| `src/renderer/src/windows/main/components/chat/AiWorkspace.vue` | 发送框工作空间面板：列表与左侧同源，条目可删除 |

## 数据结构与分组契约

`AiChatItem.workspace` 为空串 → 任务列表组；非空 → 按 workspace 全路径聚合，组名 = `window.preload.path.basename(workspace)`，完整路径放分组头 `title`（hover 可见）。

```ts
// 虚拟列表行：header 行 + 聊天行 + 「查看更多」行拍平；折叠组只保留 header
type ChatListRow = ChatGroupHeaderRow | ChatItemRow | ChatGroupMoreRow
```

排序规则：任务组固定第一；项目组以 `useWorkspaceList` 的合并全集为序（有聊天绑定的按组内最新 `createdAt` 降序在前，仅历史中的空分组按最近使用优先置底）；组内 `createdAt` 降序。

## 「新建聊天」预填链路

1. 分组头按钮 → `router.push({ path: '/new', query: { workspace } })`。
2. `PageNew.vue` watch `route.query.workspace` → `prefillWorkspace` ref（immediate，离开 /new 时自动清除）。
3. 经 `LChatSender` 的 `initial` 浅监听传入 `workspace: prefillWorkspace || undefined`。

⚠️ 必须传 `undefined`（无预填时）而非空串：sender 的 initial 监听对 `workspace !== undefined` 一律覆盖，传空串会在切换聊天类型等重渲染时机把用户手动选择的目录清掉。

## 注意事项

- 折叠状态经 `KeyValueUtil`（localStorage）持久化，键 `chat-list-collapsed-groups` 存 key 数组（key = workspace 全路径，任务组 key 为空串 `TASK_GROUP_KEY`），读取时按字符串数组收敛防脏数据。
- 任务列表与工作空间全集均为空时 rows 返回空数组；仅存在空分组（无聊天的历史目录）时仍渲染分组头。
- 现有交互不变：聊天行右键（重命名/删除）、私 tag、streaming loading、active 高亮。
- `top`（置顶）字段全库未使用，本次未处理。

## 工作空间合并口径与删除（2026-09-13）

### 背景

AiWorkspace 面板列表（`workspace-history.json`，仅「选择目录」时写入）与左侧分组（聊天表 `workspace` 派生）原本互不同步，出现双侧不一致且历史无删除入口。

### 合并口径（拍板）

- 单一数据源 `useWorkspaceList()`（模块级单例）：
  - `workspaces` = **聊天绑定的目录 ∪ 目录历史**，排序为「有聊天绑定的在前（组内最近聊天 `createdAt` 降序）→ 仅历史中的在后（历史写入倒序 = 最近使用优先）」；
  - `addHistory(path)`：去重追加并落盘（「选择目录」仍走此写入）；
  - `removeWorkspace(path)`：删除其下全部聊天（遍历 `AiChatStore.remove`，级联销毁会话/沙盒/产物）+ 移除历史条目。
- **消费方两侧同源**：`useChatGroups` 的项目分组按 `workspaces` 全集构建（无聊天绑定的目录生成**空分组**置底）；`AiWorkspace.vue` 面板列表直接展示 `workspaces`，顺序与左侧一致。

### 删除工作空间

- 入口①：AiWorkspace 面板条目 hover 显示删除图标（`click.stop`）。
- 入口②：左侧分组头右键菜单（`openWorkspaceContextmenu`，任务列表不响应）。
- 确认：`MessageBoxUtil.confirm`（复用既有工具，取消走 reject 需 catch）；文案按其下聊天数区分（N>0 提示连同聊天一并删除，N=0 仅移除条目）。
- 删除后：若发送框当前选中的正是该目录，AiWorkspace 面板侧同步清空 `workspace` model；折叠态 localStorage 残留 key 无害（分组消失即不渲染），不做清理。

### 重命名工作空间（2026-09-13 拍板：仅改显示别名）

- 语义：只改左侧分组头与面板条目的**显示名**，聊天绑定的目录路径与磁盘目录均不动。
- 存储：`KeyValueUtil`（localStorage）键 `workspace-aliases`，`Record<path, alias>`，读取时按字符串值收敛防脏数据。
- API：`useWorkspaceList().renameWorkspace(path, name)`——空串或与目录 basename 相同即删除别名恢复默认；`displayName(path)` 为统一取名口（别名优先，缺省 basename）。
- 分组名/面板条目/搜索（Fuse `basename` 键）/删除确认文案均走 `displayName`，别名删除时随 `removeWorkspace` 一并清理。

### 注意事项

- 目录历史文件 `~/.mistrelle/data/workspace-history.json` 仅追加/移除路径字符串，不校验目录在磁盘上是否仍存在。
- `useWorkspaceList` 引用了 `@/windows/main/store` 的聊天 store，仅在主窗口上下文可用（当前消费方 ChatList / AiWorkspace 均在主窗口）。

## 分组内默认 8 条 + 查看更多（2026-09-25）

### 行为

- 每个分组（含「任务列表」）默认只列出组内最近 `GROUP_VISIBLE_LIMIT = 8` 条聊天；超出时在该组末尾追加一行「查看更多（还有 N 条）」，N = 组内总数 - 8（即 `ChatGroupMoreRow.hidden`）。
- 点击该行展开为全部聊天，同一行文案变「收起」，再点回到 8 条。
- 「查看更多」行是组内普通一行，`item-size` 仍为 36、照常走 VList 虚拟滚动；样式复用聊天行 `.menu-item` 的几何尺寸 + `.menu-item--more` 修饰类（仅降一级字色），图标槽用既有 `.menu-icon`，故文案与聊天名天然左对齐。
- 折叠组只保留 header，8 条上限与「查看更多」行随之隐藏（折叠优先级更高）。

### 状态口径（拍板）

- **展开态不持久化**：`useChatGroups` 内 `reactive(new Set<string>())`，只活在本次运行内，重启回到默认 8 条。
  - 与折叠态（`chat-list-collapsed-groups` 落盘）刻意不对称：折叠是用户的稳定偏好，展开是临时查看；若持久化则重启即恢复长列表，与「默认 8 条」的初衷相反。
- **当前正在查看的聊天排在 8 条之外时不特殊处理**：不自动展开所在分组、也不强制插入可见列表（该行不显示、无高亮），点「查看更多」即可看到。这样 `useChatGroups` 保持与路由无关。
- 分组被删除 / 消失时无需清理展开态：Set 随组件生命周期存续，字符串 key 复用无害（与折叠态残留 key 同一口径）。

### 注意事项

- `useChatGroups()` 返回值变为 `{ rows, toggleGroup, toggleGroupMore }`；`ChatListRow` 联合新增 `ChatGroupMoreRow{ kind: 'more', key, hidden, expanded }`。
- VList 插槽的三个 `v-if/v-else-if/v-else` 分支根节点必须写显式 `:key`（`h:` / `m:` / `c:` 前缀保证唯一）：Vue 编译器给分支注入的内置 key（0/1/2）会被 virtua 直接当行 key 采走，此前控制台报 `Duplicate keys "1"`。
- 若将来要改默认条数，只改 `GROUP_VISIBLE_LIMIT`；「收起」判定与文案均由该常量派生，无需同步其他文件。
