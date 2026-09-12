# 08 - 聊天列表项目分组

> 2026-09-12：侧边栏聊天列表从平铺改为以项目为核心的分组列表。

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

## 数据结构与分组契约

`AiChatItem.workspace` 为空串 → 任务列表组；非空 → 按 workspace 全路径聚合，组名 = `window.preload.path.basename(workspace)`，完整路径放分组头 `title`（hover 可见）。

```ts
// 虚拟列表行：header 行 + 聊天行拍平，折叠组只保留 header
type ChatListRow = ChatGroupHeaderRow | ChatItemRow
```

排序规则：任务组固定第一；项目组之间按组内最新 `createdAt`（Map 插入序天然满足：时间倒序遍历首个出现的项目即最近活跃）；组内 `createdAt` 降序。

## 「新建聊天」预填链路

1. 分组头按钮 → `router.push({ path: '/new', query: { workspace } })`。
2. `PageNew.vue` watch `route.query.workspace` → `prefillWorkspace` ref（immediate，离开 /new 时自动清除）。
3. 经 `LChatSender` 的 `initial` 浅监听传入 `workspace: prefillWorkspace || undefined`。

⚠️ 必须传 `undefined`（无预填时）而非空串：sender 的 initial 监听对 `workspace !== undefined` 一律覆盖，传空串会在切换聊天类型等重渲染时机把用户手动选择的目录清掉。

## 注意事项

- 折叠状态经 `KeyValueUtil`（localStorage）持久化，键 `chat-list-collapsed-groups` 存 key 数组（key = workspace 全路径，任务组 key 为空串 `TASK_GROUP_KEY`），读取时按字符串数组收敛防脏数据。
- 全部聊天为空时 rows 返回空数组，不渲染孤立的「任务列表」头。
- 现有交互不变：聊天行右键（重命名/删除）、私 tag、streaming loading、active 高亮。
- `top`（置顶）字段全库未使用，本次未处理。
