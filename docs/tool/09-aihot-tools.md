# AIHOT 工具：AI 资讯热点查询

> API 客户端 `src/renderer/src/modules/api/aihot/` + 可选工具 `src/renderer/src/modules/tool/components/aihot/`。
> 数据源为 [AIHOT 公开 API](https://aihot.virxact.com/openapi-v1.json)（v1.2.0，OpenAPI 3.1）：**匿名只读、无鉴权**，8 个 GET 端点，全部工具 `risk: 'safe'`。

## 实现思路

- 完全对齐 skillhub API 模块模式：每端点一个 `api/api-v1-*.ts` 文件、统一走 `@/plugin/http` 的 `requestJson`（preload Node 桥免疫 CORS，自动继承全局代理与 UA）、`baseURL` 逐文件写死、函数内解包返回 `data`、api 函数内不 try/catch（错误由工具层兜底转 `{ error }`）
- 因匿名无需鉴权，不涉及 `SettingAccountStore`；按需单次调用而非轮询，不实现 `If-None-Match` / ETag 协商缓存
- 类型定义忠实于 spec：nullable 字段标 `| null`；`SelectedSnapshot.items` 为 `AihotItem[] | AihotItemMinimal[]`（fields 判别）；`SelectedChanges.changes` 为 remove / upsert / upsertMinimal 判别联合

## 模块结构

```text
modules/api/aihot/
├── index.ts                      # 桶文件
├── types.ts                      # OpenAPI schemas → TS 类型（统一 Aihot 前缀防桶导出冲突）
└── api/                          # 每端点一文件，函数命名 aihotApiV1Xxx
    ├── api-v1-items.ts           # GET /api/v1/items            aihotApiV1Items(params?)
    ├── api-v1-hot-topics.ts      # GET /api/v1/hot-topics       aihotApiV1HotTopics()
    ├── api-v1-stories.ts         # GET /api/v1/stories/{id}     aihotApiV1Stories(publicId)
    ├── api-v1-dailies.ts         # GET /api/v1/dailies          aihotApiV1Dailies(limit?)
    ├── api-v1-dailies-latest.ts  # GET /api/v1/dailies/latest   aihotApiV1DailiesLatest()
    ├── api-v1-dailies-date.ts    # GET /api/v1/dailies/{date}   aihotApiV1DailiesDate(date)
    ├── api-v1-selected-snapshot.ts  # GET /api/v1/selected/snapshot  aihotApiV1SelectedSnapshot(params?)
    └── api-v1-selected-changes.ts   # GET /api/v1/selected/changes   aihotApiV1SelectedChanges({ cursor, limit? })
```

## 工具契约（6 个，全部 safe）

工具定义在 `modules/tool/components/aihot/index.ts`，注册于 `modules/tool/index.ts` 分组 `AI 热点`（`toolGroups` + `toolMap`），按需在 agent / 会话中勾选启用。5 个走匿名只读公开 API（按需单次调用），1 个（`aihot_selected`）查询应用侧本地精选镜像（SQLite）。

| 工具 | 参数 | 返回 |
|---|---|---|
| `aihot_hot_topics` | 无 | `{ count, items }`；每项附加 `storyPublicId`（handler 从 `links.story` URL 末段提取），模型可直接链到 `aihot_story` |
| `aihot_items` | `q?`、`category?`(enum)、`window?`(24h/7d)、`by?`(timeline/published)、`mode?`(selected/all)、`limit?`(默认 20，clamp 1–100) | `AihotItemsResponse`（近 7 天窗口） |
| `aihot_story` | `publicId`(必填) | `AihotStory`（时间线 reports + AI 摘要 digest） |
| `aihot_daily` | `date?`(YYYY-MM-DD 上海时区，缺省=最新) | `AihotDailyReport`（合并 latest 与按日期两端点） |
| `aihot_dailies` | `limit?`(默认 30，clamp 1–180) | `AihotDailiesResponse`（日报日期索引） |
| `aihot_selected` | `q?`、`category?`(enum)、`window?`(24h/7d/all，默认 all)、`by?`(timeline/published)、`limit?`(默认 20，clamp 1–100)、`refresh?`(boolean) | `{ syncedAt, total, hasMore, items }`（本地镜像全量历史，条目为完整字段去本地 `read` 标记） |

handler 统一经 `runAihot(action, fn)` 包装：成功原样返回、失败 `{ error: '<action>失败：<message>' }` 软错误供模型自我纠正。

## 注意事项

- **精选集走应用本地镜像**：精选集（`selected`）由应用侧 `modules/aihot/AihotSelectedService` 维护——snapshot 引导（保留第一页 `cursor` 作账本水位）+ changes 永续增量（先应用页面再保存新 `cursor`），409 `snapshot_required` 自动清库重引导，镜像落 SQLite（`window.preload.db.aihot`），与资讯页共享同一份数据。工具 `aihot_selected` 只查询该本地镜像，**不向模型暴露 snapshot / changes 账本协议**：无状态工具无法可靠跨调用维护不透明 `cursor`，一旦失效需全量重引导数千条，token 浪费且不可恢复
- `aihot_selected` 首次调用自动触发 snapshot 引导（数千条分页写入，一次性数秒）；此后距上次同步 ≥5 分钟或传 `refresh=true` 才走增量同步，其余直接读本地缓存；镜像条目为完整字段（含 summary），不含仅 `/items` 端点返回的 `reason`
- **items 仅 7 天窗口**，不做全量镜像用途；`cursor` 绑定同查询（换过滤条件须重新从头取）
- 429 / 503 响应带 `Retry-After`，规范要求以 `Cache-Control s-maxage` 为最小轮询间隔（items 60s、hot-topics 300s）——当前按需调用场景无轮询，仅靠 axios 失败信息透出
- 错误体为 `application/problem+json`（含 `requestId`），当前不解析，直接以 axios 错误消息返回
- `category` 取值（ai-models / ai-products / industry / paper / tip）可能扩充，类型上保持 `string` 容忍新值，仅工具 enum 收敛已知值
