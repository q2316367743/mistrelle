# SQLite 存储层（Drizzle + better-sqlite3，主进程持有）

> 本轮引入 SQLite 承载 **AIHOT 精选集**，替换「单文件 JSON 全量加载 / 全量覆写 + 全列表遍历去重」，
> 并让渲染层不再持有全量数组。基建为通用 seam，其余模块可按文末「复用」一节接入。

## 1. 背景与动机

此前所有数据以独立 JSON 文件落在 `~/.mistrelle/` 下，经 `window.preload.fs` → main `fsIpc.ts`
读写（`writeFile` 整文件覆写，非原子）。痛点：

- **aihot 精选集**：`selected.json` 约 4MB，每次 `JSON.parse` 全量进内存；每页 changes 都整文件覆写一次；
  去重用 `Map` 全列表重建遍历。
- 侧边栏聊天 `index.json` / 每个聊天的 `main.json` 整文件重写（本轮未迁移）。

引入 SQLite 后：去重靠主键 + `INSERT ... ON CONFLICT DO UPDATE`，筛选 / 排序 / 分页在 SQL 内完成，
UI 按需分页查询，不再持有全量数组。

## 2. 技术选型（含一次重要取舍）

| 项 | 选型 | 原因 |
|----|------|------|
| 驱动 | `better-sqlite3`（原生、同步） | Drizzle 最成熟的本地驱动，同步 API 简化主进程 DAO |
| ORM / DAO | `drizzle-orm`（`drizzle-orm/better-sqlite3`） | 类型安全查询构建器 + schema 类型化 + `onConflictDoUpdate` |
| 进程 | 全部 DB 逻辑在 **main** | 渲染进程无 Node；且「SQL 不跨渲染层」更安全、契约更干净 |

**取舍记录**：原本倾向 `node:sqlite`（Node 22 内置，Electron 39 的 Node 22.22.1 实测可用），
避免 better-sqlite3 在 Windows 的原生编译。但**实测 `drizzle-orm@0.45.2`（最新 stable）与
`kysely@0.29.5` 均无 `node:sqlite` 驱动**（本地 SQLite 只支持 better-sqlite3），
经与需求方确认后放弃内置 `node:sqlite`，转用 **Drizzle + better-sqlite3**。
`better-sqlite3` 属原生依赖，postinstall 的 `electron-builder install-app-deps` 会为当前 Electron ABI 重编译。

## 3. 架构与文件布局

```
drizzle.config.ts                  # drizzle-kit 配置（schema → 迁移 SQL 生成）
resources/drizzle/                 # drizzle-kit generate 产物（0000_*.sql + meta/），随应用打包，提交入库
src/
├── main/src/
│   ├── db/
│   │   ├── client.ts          # 单例 initDb()/db()：打开 ~/.mistrelle/db/mistrelle.db + pragma WAL + migrate()
│   │   ├── schema/index.ts
│   │   ├── schema/aihot.ts    # aihot_item / aihot_meta 表 + 索引（Drizzle schema 元数据）
│   │   ├── schema/chat.ts     # chat / chat_content / chat_sub 表（聊天列表 + 消息体）
│   │   ├── repo/aihotRepo.ts  # DAO：list / applyBatch / clear / getMeta
│   │   └── repo/chatRepo.ts   # DAO：list / upsertItem / deleteItem / get|setContent / get|setSub / getStamp
│   └── ipc/dbIpc.ts           # registerDbIpc()：IPC 领域方法 → repo 透传
├── preload/src/
│   ├── dbChannels.ts          # DbChannels 常量 + 载荷类型（独立于 channels.ts，其已贴 500 行红线）
│   └── db.ts                  # dbApi 薄桥（aihot.* / chat.*）
└── renderer/src/
    ├── types/db.d.ts          # ambient 声明 DbApi 等（与 fs.d.ts 同级）
    ├── vite-env.d.ts          # Window.preload 增补 db: DbApi
    └── modules/aihot/AihotSelectedService.ts  # 网络同步编排 + 调 dbApi 持久化
```

**聊天域**（列表 + 消息体 + 子代理消息体）已于 0001 迁移入表：会话键 `chat:{id}` / `sub:{chatId}:{subId}`
走 DB、其余文件路径键（项目任务）保持文件读写；历史文件由 `test/migrate-chat-to-sqlite.mjs` 手动迁移。
详见 [02-chat-sqlite-migration.md](./02-chat-sqlite-migration.md)。

**DB 文件路径只在 main 解析**：`app.getPath('home') + ~/.mistrelle + /db/mistrelle.db`，
渲染进程不感知路径。

## 4. 数据模型（aihot）

```sql
CREATE TABLE IF NOT EXISTS aihot_item (
  id            TEXT PRIMARY KEY,   -- 去重键
  title         TEXT,
  category      TEXT,
  discovered_at TEXT,
  published_at  TEXT,
  search_text   TEXT,               -- 小写拼接 title\noriginalTitle\nsummary，供 LIKE 子串搜索
  data          TEXT NOT NULL       -- 完整 AihotItem JSON，仅供渲染
  read          INTEGER NOT NULL DEFAULT 0  -- 是否已读：0=未读，1=已读（用户点击打开条目时置 1）
);
CREATE INDEX idx_aihot_category   ON aihot_item(category);
CREATE INDEX idx_aihot_discovered ON aihot_item(discovered_at);
CREATE INDEX idx_aihot_published  ON aihot_item(published_at);

CREATE TABLE IF NOT EXISTS aihot_meta (key TEXT PRIMARY KEY, value TEXT);
-- meta 键：schemaVersion / fields / cursor(水位) / syncedAt
```

- **写入**：`aihot_item.data` 存完整 JSON；`title/category/discovered_at/published_at/search_text`
  是从 data 提取的可筛选 / 排序标量列（避免整行 JSON 参与筛选）。
- **已读标记**：`read` 列（0/1）记录用户是否已读，点击打开条目时置 1；同步 upsert 的 `upsertSet` 不含 `read`，
  故增量覆盖 / 重引导插入**不会清除已有已读状态**，新插入条目默认 0（未读）。
- **时间基准**：`by='timeline'` 用 `discovered_at`；`by='published'` 用 `coalesce(published_at, discovered_at)`
  （与页面 `aihotTimelineKey` 语义一致）。

## 5. 领域方法契约（IPC，均绑定参数，不跨渲染层拼 SQL）

| 方法 | 说明 |
|------|------|
| `aihot.list({filter,limit,offset})` | 分页查询：category 精确、search_text 子串（q≥2）、时间下界、时间倒序、LIMIT/OFFSET；返回 `{items:[{id,data}], total}` |
| `aihot.applyBatch({upserts,deletes,meta})` | delete + upsert（ON CONFLICT DO UPDATE）+ meta 水位，**单事务原子** |
| `aihot.clear()` | 清空 items + meta（409 重引导用） |
| `aihot.getMeta()` | 读取账本元数据（缺省返回空壳，不预写） |
| `aihot.markRead(id)` | 标记单条为已读（`read=1`）；仅更新 read 列，不影响同步水位与筛选 |

用户输入（关键词 / 分类 / 时间）一律经 DAO 绑定参数；`onConflictDoUpdate` 用
`sql\`excluded.<col>\`` 作全列替换，等价 INSERT OR REPLACE。

## 6. aihot 增量同步（AihotSelectedService）

- `syncAihotSelected()`：读 meta → 有 `cursor` 走 `changes` 增量，否则 `snapshot` 引导；`409 snapshot_required` 清库重引导；网络失败保留缓存并提示；同步完成后调用方自行重新查询列表。
- `bootstrapSnapshot`：翻页拉全量（fields=default），一次性 `applyBatch`（含第一页 cursor 作为水位）。
- `applyChanges`：每页 `applyBatch`（delete + upsert + cursor/syncedAt）原子推进，崩溃从水位续传。
- 去重不再整表遍历：主键 id + ON CONFLICT DO UPDATE。

## 7. 渲染层：useAihotSelectedItems（DB 驱动分页）

- 状态 `list`（当前已加载多页）/ `total`（匹配总数）/ `offset`（续页游标）。
- `query(reset)`：调 `db.api.aihot.list`；reset 重首屏替换，否则续页追加；`seq` 标记丢弃过期响应（防快速切换乱序）。
- `init()` 读 meta 设 `syncedAt/ready` + 后台同步后重查；`sync(manual)` 同步完成重查。
- 筛选变化 / 刷新 → `resetShown()` 触发 `query(true)`。

## 8. 旧数据迁移

旧 `~/.mistrelle/cache/aihot/selected.json`（约 4MB）**丢弃、重新引导**：本轮删除该文件与 `cache/aihot/` 目录，
下次同步从 snapshot 重建（精选集可再生，规避离线空窗的取舍已与需求方确认）。

## 9. 注意事项 / 陷阱

- **channels.ts 已贴 500 行红线**：db 通道**不并入**，独立 `dbChannels.ts`，避免再改 492 行文件。
- **四文件同步**（沿用 fs 桥约定）：新增 DB 通道能力须同步 `dbChannels.ts` / `db/dbIpc.ts` /
  `preload/db.ts` / 渲染层 `types/db.d.ts`（+ `vite-env.d.ts` 挂 `Window.preload.db`）。
- **主进程时序**：`registerDbIpc()` 在 app ready 后调用（`registerIpc()`），`initDb()` 于此打开库并 `migrate()` 应用迁移。
- **迁移流水线（drizzle-kit）**：表结构变更统一走 `schema/*.ts` → `npx drizzle-kit generate` 产出 `resources/drizzle/NNNN_*.sql` 并提交；运行时 `migrate()` 按 `__drizzle_migrations` 表增量应用。**drizzle 的 `run()` 底层是 better-sqlite3 `prepare()`（只支持单语句），多语句 DDL 会直接抛错**——这就是首版手写多语句 DDL 崩溃的根因，因此迁移一律交给 drizzle-kit 生成的单语句序列，不再手写。
- **迁移目录解析（electron-vite 资源规范）**：主进程 `publicDir` 为项目根 `resources/`（文件不参与拷贝，随应用打包并按 electron-builder.yml 的 `asarUnpack: resources/**` 解包）；运行时 `join(__dirname, '../../resources/drizzle')`——dev 命中源码布局，prod 经 Electron asar 补丁透明读取解包文件。
- **原生依赖**：better-sqlite3 需为 Electron ABI 重编译（postinstall `install-app-deps` 已自动处理）；
  `electron-vite` 的 `externalizeDepsPlugin()` 保证 main 打包不内联原生模块。
- **pragma WAL**：`journal_mode = WAL` 提升崩溃恢复稳健性；单实例下无并发写竞争。
- **复合列 onConflictDoUpdate 必须先声明复合主键**（2026-08-25 修复，迁移 0004）：`chat_sub` 建表时
  只有两普通列 + 普通索引，`chatSetSub` 的 `onConflictDoUpdate({ target: [chatId, subId] })` 在
  prepare 阶段抛 `ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint`——
  SQLite 要求 ON CONFLICT 目标必须是 PK/UNIQUE 约束。修复为 `primaryKey({ columns: [t.chatId, t.subId] })`
  （复合主键最左前缀已覆盖按 chatId 的查询，原冗余索引一并删除）；SQLite 加主键走 drizzle-kit
  生成的表重建序列（带 statement-breakpoint，migrate() 可正常应用）。
- 本轮**不迁移**聊天 / 设置等其他文件存储；`JsonFileUtil` / `Constant` 路径工厂继续用于其余数据。

## 10. 后续模块如何复用

1. `src/main/src/db/schema/<module>.ts` 定义表 + 索引，`schema/index.ts` 导出；执行 `npx drizzle-kit generate` 产出新迁移 SQL（提交 `resources/drizzle/`），运行时 `migrate()` 自动应用。
2. `src/main/src/db/repo/<module>Repo.ts` 写 DAO（Drizzle 查询 / 事务 / ON CONFLICT）。
3. `src/preload/src/modules/db/dbChannels.ts` 增补通道 + 载荷类型；`db/dbIpc.ts` 注册 handler；`preload/db.ts` 增补方法。
4. 渲染层 `types/db.d.ts` 增补对应类型与方法，业务代码经 `window.preload.db.<module>.*` 调用。
