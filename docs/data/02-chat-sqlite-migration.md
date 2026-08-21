# 聊天迁移 SQLite（列表 + 消息体）+ 本地迁移脚本

> 聊天域已迁入 SQLite（复用 [01-sqlite-storage.md](./01-sqlite-storage.md) 的基建）：
> 列表 `chat` 表、消息体 `chat_content` 表（每聊天气泡一行，含完整 AiChatContent JSON）、
> 子代理消息体 `chat_sub` 表。业务代码**不感知历史数据**——历史文件由迁移脚本手动导入。

## 1. Schema（drizzle-kit 0001 迁移）

```sql
chat(id TEXT PK, name, top INTEGER 0/1, workspace, project_id, task_id, type,
     created_at INTEGER, updated_at INTEGER) + idx_chat_created
chat_content(chat_id TEXT PK, updated_time INTEGER, data TEXT NOT NULL)  -- 完整 AiChatContent JSON（含 messages）
chat_sub(chat_id, sub_id, data TEXT NOT NULL, PK(chat_id, sub_id)) + idx_chat_sub_chat
```

## 2. 会话键与持久化缝隙（关键设计）

`ChatService` 的 `storageKey` 语义升级为键路由，`ChatSessionManager` 零改动：

| 键 | 目标存储 |
|----|----------|
| `chat:{chatId}`（`buildChatMainKey`） | chat_content 表（整聊 JSON，经 DB IPC） |
| `sub:{chatId}:{subId}`（`buildChatSubKey`） | chat_sub 表 |
| 其余（项目任务 `~/.mistrelle/project/…` 文件路径） | 沿用文件读写（ProjectTaskService 不变） |

- `aiChatContentGet/Set(storageKey)` 按键前缀分流；旧 `{ list: ChatMessage[] }` 兼容 shim 已删除（历史数据由脚本归一化）。
- 侧栏列表 = `chat` 表类型化列（免整份 index.json 解析），索引不再全量重写（行级 upsert / 级联删）。
- 记忆提取「未变跳过」依据从文件 mtime 改为 `chat_content.updated_time`（`aiChatContentStamp`）；进度键从路径改为 `chat:{id}`。

## 3. 迁移脚本 `test/migrate-chat-to-sqlite.mjs`（手动执行）

```bash
node test/migrate-chat-to-sqlite.mjs            # 正式迁移：应用迁移 → 入表 → 改记忆键 → 删文件
node test/migrate-chat-to-sqlite.mjs --dry-run  # 只扫描报告，零写入零删除
```

流程：
1. 扫描 `~/.mistrelle/workspace/index.json` → `chat` 行（INSERT OR REPLACE 幂等）
2. 每个聊天目录：`message/main.json`（归一化旧 `{list}` 形状）→ `chat_content`；`message/sub_*.json` → `chat_sub`
3. 改写 `~/.mistrelle/soul/state.json` 的 `extracted` 键：`…/workspace/{id}/message/main.json` → `chat:{id}`（`sub_{subId}.json` → `sub:{chatId}:{subId}`），写前备份 `state.json.bak-<ts>`
4. 校验库内计数 ≥ 计划数后，删除 `index.json` 与各已迁移聊天的 `message/` 目录

**删除范围 / 边界**：
- **只删** `index.json` + 已迁移聊天的 `message/` 目录；`outputs/inputs/tmp` 沙盒产物**永不删除**
- 孤儿目录（有 main.json 但不在索引）仅报告、不迁移、不删除
- 幂等可重跑；计数校验不通过时跳过删除并退出码 1
- 建议执行前先备份 `~/.mistrelle`；执行时关闭应用（避免并发写）

## 4. 渲染层改动清单

- `ChatService.ts`：键路由 + DB 读写（aiChatList / aiChatUpsertItem / aiChatRemove / aiChatContentGet/Set / aiChatContentStamp）；沙盒只建 outputs/inputs/tmp，不再建 message/ 子目录
- `AiChatStore.ts`：add/update → 行级 upsert；remove → DB 级联删 + 沙盒删
- `MemoryExtractor.ts`：`aiChatContentStamp` 替代 fs.stat mtime；键 `chat:{id}`
- `subagent`：`buildChatSubKey`；persistence 经键路由透传（删死代码 readMainContent）
- `PageChat.vue` / `ChatList.vue`：`buildChatMainKey`
- `Constant.ts`：删除孤儿 `getChatIndexPath` / `getChatMessageDir` / `getAppData2Discussion`（`getDataForWorkspace` 保留，供沙盒产物）