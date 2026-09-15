# lmdb → 本地 JSON 文件迁移（全量完成）

> 背景：renderer 侧曾通过 `DbStorageUtil`（CouchDB 文档形态 `_id/_rev/value`）经 IPC 调用主进程 `UtoolsDb`（lmdb，`~/.mistrelle/db`）。此前 model / agent / account 已先行迁移为本地 JSON，本文档收尾剩余全部消费点并删除 lmdb 全链路。

## 迁移映射

| 旧 key（LocalNameEnum） | 新文件（`~/.mistrelle/`） | 消费方 | 保存形态 |
|---|---|---|---|
| `SETTING_NETWORK` `/setting/network` | `network.json` | `store/setting/SettingNetworkStore.ts` | `watchDebounced(300ms, deep)` 自动保存 |
| `SETTING_GLOBAL` `/setting/global` | `global.json` | `store/setting/SettingGlobalStore.ts` | init 后 `watch(deep)` 自动保存 |
| `SETTING_SECURE` `/setting/secure` | `secure.json` | `store/setting/SettingSecureStore.ts` | 同上 |
| `SETTING_DEFAULT` `/setting/default` | `default.json` | `store/setting/SettingDefaultStore.ts` | 同上 |
| `LIST_AI_WORKSPACE` `/list/ai/workspace` | —（不迁移） | `store/ai/AiWorkspaceStore.ts` | 零消费方孤儿 store，连同 `entity/ai/AiWorkspace.ts` 一并删除 |
| `KEY_AI_WORKSPACE` `/key/ai/workspace` | `workspace-history.json` | `windows/main/components/chat/AiWorkspace.vue` | push 后显式保存 |

路径工厂集中在 `global/Constant.ts`（`getSettingNetworkPath` 等，与 `getModelPath`/`getAgentPath`/`getAccountPath` 同构）；读写经 `utils/native/JsonFileUtil.ts` 的 `readJsonFile` / `writeJsonFile`（`window.preload.fs` 桥，全量覆写）。

## 行为变化

- **rev 乐观锁删除**：lmdb 时代的 `_rev` 冲突重试逻辑（`saveListByAsync`/`saveOneByAsync` 的 3 次重试）随全量覆写模式一并移除，单实例运行下无并发写。
- **不预写空文件**：`useUtoolsDbAsync` 的 `writeDefaults` 行为（首次写入默认值）不再保留，`readJsonFile` 对不存在文件返回 `null`，store 保持 `build…()` 默认值。
- **init 后才注册 watch**：各 setting store 的自动保存 watch 均在 init 读取完成后注册，避免初始化回填触发一次多余写盘（顺带修正了 network store 的旧行为）。
- **直接替换不 merge**：读取结果整体赋给 state，老数据缺新字段时依赖各处 `||` 兜底（如 `egoBrowserPath`），与旧 `getFromOneByAsync` 语义一致。
- **旧数据不迁移**：`~/.mistrelle/db`（lmdb 目录）保留不读、不清理，首次启动各配置回到默认值。

## lmdb 链路删除清单

- 依赖：`package.json` 移除 `lmdb`（`yarn remove lmdb`）。
- main：`src/main/src/db/utoolsDb.ts`（整目录）、`src/main/src/db/dbIpc.ts`、`registerIpc.ts` 中的 `registerDbIpc()`。
- preload：`channels.ts` 的 `DbChannels` 与 `DbDoc/DbPutResult/DbRemoveResult`、`inject.ts` 的 `db` 段与导出。
- renderer：`utils/native/DbStorageUtil.ts`（barrel 改为 `JsonFileUtil`）、`hooks/UtoolsDbAsync.ts`、`hooks/UtoolsDbStorage.ts`（localStorage 版死代码）、`types/inject.d.ts` 的 `InjectDb` 家族。
- `LocalNameEnum` 仅保留仍在用的 `KEY_APP_COLLAPSED`、`KEY_AI_ASIDE_WIDTH`（走 `KeyValueUtil`/localStorage，与 lmdb 无关），其余 key（含 Discussion 模块删除遗留的 `LIST_AI_DISCUSSION`/`ITEM_*` 等无引用死 key）一并清理。

## 当前本地 JSON 存储全景（`~/.mistrelle/`）

| 文件/目录 | 内容 | 备注 |
|---|---|---|
| `model.json` / `agent.json` | AI 模型 / Agent 配置 | 明文 JSON |
| `account.json` | 账户密钥 | 整文件 safeStorage 加密，失败降级明文 |
| `network.json` / `global.json` / `secure.json` / `default.json` | 各 setting 域 | 本次迁移 |
| `workspace-history.json` | 打开过的 AI 工作空间路径 | 本次迁移 |
| `workspace/` 目录 | 聊天索引与消息 | 与 `workspace-history.json` 同前缀不同路径，无冲突 |
