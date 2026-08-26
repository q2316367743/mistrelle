# 16 - 隐私聊天

> 2026-08-26 落地。**创建聊天时**在发送面板「模式」下设置隐私开关：开启后该聊天不注入记忆、不注册记忆工具、消息不进入短期 / 长期记忆。**创建后锁定**（与 type / writingScene / designStyleId 同族），聊天室内开关禁用、不可更改。

## 需求语义

- 开关位于 `LChatAttachment.vue` 模式面板（计划 / 完全访问之下），**仅新建聊天页（PageNew → LChatSender）可操作**；
- **创建后锁定**：聊天室（LChatEngine）内 `lock-privacy` 硬编码传入，开关禁用仅回显、「隐私」tag 不可关闭；引擎不随消息修改该标记（`ChatSession.send` 不接收、`sendUserMessage` 不读取 privacy）；
- 标记持久化在 **chat 表 `privacy` 列**（integer 0/1，默认 0），即 `AiChatItem.privacy`（与 `mode` 存在 `AiChatContent` 不同，列表 / 引擎无需加载消息体即可读取）；
- 开启后：
  1. 请求不注入记忆 system 消息（长期 + 近期短期，`buildMemoryPrompt` 不调用）；
  2. 不注入记忆工具使用指导、不注册 `record_memory` 工具（用户 `#` 显式指定也不注入）；
  3. 该会话不进入记忆提取（短期记忆无条目 → 长期记忆合并自然无来源）；
  4. 子 Agent 继承主 Agent 的隐私标记（同样不注册记忆工具）；
  5. `LChatEngine` 标题前展示红色「私」tag；发送面板 footer 展示「隐私」tag（仅新建页可关闭）；侧边栏 `ChatList` 列表项名称前展示「私」tag。

## 数据链路

```
LChatAttachment 开关（t-switch，模式面板；lockPrivacy 时禁用）
  └─ v-model:privacy → LChatSender.privacy → ChatRequestParams.privacy（发送时携带）
       ├─ 新建聊天（唯一写入口）：AiChatStore.add() → item.privacy 入库 + content.draft 携带
       │    └─ 引擎挂载 → ChatSession.load() 经 aiChatGetItem 水合 → setPrivacy → 首轮草稿发送前生效
       └─ 存量聊天：发送参数中的 privacy 被忽略（锁定属性，不随消息修改）
```

- 水合：`ChatSession.load()` 经 `chatIdFromKey(storageKey)` 解析聊天 id，`aiChatGetItem` 读行级列，**在首轮草稿发送前** `setPrivacy(true)` 注入引擎；
- 会话级 `session.privacy` ref 仅供 sender initial 回显（禁用态展示真实值）。

## 记忆隔离点（四处）

| 位置 | 行为 |
|---|---|
| `AgentChat.buildRequestMessages` | `this.privacy` 时跳过 `buildMemoryToolPrompt()`（稳定 system 段）与 `buildMemoryPrompt()`（独立 system 消息） |
| `AgentChat.getFunctions` | 合并工具时过滤 `recordMemoryTool.name`（含 agent 预置 / 用户 `#` 指定 / 默认工具三来源） |
| `MemoryExtractor.extractSession` | 隐私会话不提取，**但仍推进 `extracted` 进度**——确保该会话消息永不进入记忆 |
| 子 Agent | `ToolPolicyContext.privacy`（`buildPolicyContext` 注入）→ `agentTools` spawn 拦截透传 `SubAgentOptions.privacy` → runner 构造 `ToolChat({ privacy })` |

> 注意：子 Agent 本就 `isSubAgent` 不注入记忆 system，但其默认工具集含 `record_memory`；隐私标记继承后同样被 `getFunctions` 过滤。

## 存储与 IPC（chat 表新列）

- 迁移：`resources/drizzle/0007_third_black_knight.sql`（`ALTER TABLE chat ADD privacy integer DEFAULT 0 NOT NULL`）；
- schema：`src/main/src/db/schema/chat.ts` `privacy` 列；
- 五处同步（新列 + 新增 `getItem` 单行读通道）：
  - `src/main/src/db/repo/chatRepo.ts`：`itemSet` / `chatUpsertItem` 映射（boolean ↔ 0/1）、`chatGetItem(id)`；
  - `src/preload/src/dbChannels.ts`：`chatGetItem` 通道、`ChatItemInput.privacy`；
  - `src/main/src/ipc/dbIpc.ts`：注册 `db:chat:getItem`；
  - `src/preload/src/db.ts`：`ChatItemRow` privacy 数字列、`db.chat.getItem`；
  - `src/renderer/src/types/db.d.ts`：渲染侧镜像（`ChatItemInput` / `ChatItemRow` / `ChatDbApi`）。
- `ChatService.toItem(row)` 统一行 → `AiChatItem` 映射（`privacy: row.privacy === 1`），`aiChatGetItem` / `chatIdFromKey` 为本次新增导出。

## 关键文件

| 文件 | 改动 |
|---|---|
| `src/renderer/src/entity/ai/AiChat.ts` | `AiChatItem.privacy: boolean`（创建后锁定） |
| `src/renderer/src/modules/chat/engine/ChatCommon.ts` | `ChatRequestParams.privacy?: boolean`（仅创建时生效） |
| `src/renderer/src/modules/chat/agent/AgentChat.ts` | `privacy` 字段 / `setPrivacy` / 记忆注入跳过 / record_memory 过滤 / policyContext 透传 |
| `src/renderer/src/modules/chat/agent/ChatSessionManager.ts` | 会话级 `privacy` ref、load 水合（send 不修改，锁定属性） |
| `src/renderer/src/modules/memory/MemoryExtractor.ts` | 隐私会话跳过提取并推进进度 |
| `src/renderer/src/components/chat/sender/LChatAttachment.vue` | 模式面板隐私开关行（`lockPrivacy` 禁用）+ 锁定说明文案 |
| `src/renderer/src/components/chat/sender/LChatSender.vue` | `v-model:privacy`、`lockPrivacy` 透传、footer「隐私」tag（锁定时不可关闭）、消息携带、initial 回填 |
| `src/renderer/src/components/chat/LChatEngine.vue` | 标题前「私」tag（danger light）、`privacy` prop、sender 传 `lock-privacy` |
| `src/renderer/src/pages/chat/PageChat.vue` | `:privacy="chat.privacy"` 传入引擎（chat 为 computed 跟随 store） |
| `src/renderer/src/pages/app/components/ChatList.vue` | 侧边栏列表项名称前「私」tag（danger light） |

## 注意事项

- **唯一写入口是 `AiChatStore.add()`**：privacy 在创建聊天时随首条消息写入行级列；之后 send / resume / upsert 均不修改该列（`update(id, { privacy })` 无人调用）；
- 隐私会话的提取进度仍随消息推进，因此不存在「关闭隐私后补提」路径（标记本身也关不掉）；
- `record_memory` 的 handler 自身不感知隐私（工具根本不注册，模型无从调用）；
- 项目 / 任务类文件键会话（非 `chat:{id}`）无隐私标记，恒为 false；
- tdesign Tag 的警示主题是 `danger`（无 `error` 主题，typecheck 会拦截）。
