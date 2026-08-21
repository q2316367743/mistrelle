# AIHOT 资讯页面

> 路由：`/attachment/aihot`（`src/renderer/src/pages/attachment/aihot/AttachmentAihotPage.vue`）
> 接入文档：https://aihot.virxact.com/agent?tab=api ｜ OpenAPI：https://aihot.virxact.com/openapi-v1.json

## 实现思路

页面以 `t-tabs` 承载三个视图（**资讯 / 热点榜 / 日报**），全部面板 `destroy-on-hide="false"` 保持各视图状态与日报缓存；事件详情通过命令式 `DrawerPlugin` 抽屉展示，支持在抽屉内沿事件脉络 / 相关事件连续跳转。

资讯视图为**双数据源 + 时间轴**：

- **精选模式（默认）**：数据源是本地缓存（snapshot + changes 增量同步，见下节），打开即渲染、离线可浏览；筛选/搜索/排序/分片全部本地计算，无网络请求。
- **全部模式**：在线 `/api/v1/items` 游标查询（全量池本质是 7 天窗口临时查询，不缓存）。
- 两模式共用时间轴渲染（参考 aihot.virxact.com/all）：按本地时区日期分组（今天 · 8月21日 周四 · N 条）→ 组内左列 HH:mm 时间 + 竖直时间线（圆点+连线）→ 右侧资讯卡片；组头粘性。

### 端点选型（严格按接入文档指引）

| 视图 | 端点 | 文档定位 |
|------|------|----------|
| 资讯·精选 | `/api/v1/selected/snapshot` + `/api/v1/selected/changes` | "Keep a complete local copy of the selected set"：snapshot 一次引导 + changes 永续增量（本地缓存，重复浏览不重复拉全量） |
| 资讯·全部 | `/api/v1/items` | "show recent or today's items"（仅覆盖最近 7 天，窗口化） |
| 热点榜 | `/api/v1/hot-topics` | "show what is trending right now" |
| 日报 | `/api/v1/dailies/latest` + `/api/v1/dailies` + `/api/v1/dailies/{date}` | "show the daily digest" |
| 事件详情 | `/api/v1/stories/{publicId}` | 从热点榜 `links.story` 末段取 id 进入 |

## 关键文件

```
global/Constant.ts                        # +getCacheDir/getCacheAihotDir/getCacheAihotSelectedPath
modules/aihot/
├── AihotSelectedService.ts               # 精选集本地缓存 + snapshot/changes 同步状态机
└── AihotRequestError.ts                  # 请求异常统一处理（状态码/Retry-After 提示）
pages/attachment/aihot/
├── AttachmentAihotPage.vue               # 壳：page-layout + t-tabs
├── aihot-page-utils.ts                   # 分类映射 / storyIdFromLink / 相对时间 / 时间轴分组
├── useAihotSelectedItems.ts              # 本地数据源 composable（本地筛选/排序/分片）
└── components/
    ├── AihotItemsView.vue                # 资讯：双数据源 + 筛选栏 + 时间轴 + 加载更多
    ├── AihotTimelineList.vue             # 时间轴列表（日期分组/粘性组头/时间线）
    ├── AihotItemCard.vue                 # 单条卡片
    ├── AihotHotTopicsView.vue            # 热点榜
    ├── AihotDailiesView.vue              # 日报：归档选择 + latest + 内存缓存
    ├── AihotDailyReport.vue              # 日报内容纯展示（lead / sections / flashes）
    ├── AihotStoryDrawer.tsx              # 抽屉壳（DrawerPlugin 命令式，openAihotStory）
    ├── AihotStoryDrawerContent.vue       # 事件详情内容（digest / 跳转控制）
    ├── AihotStoryNeighbors.vue           # 事件脉络（storyline / related 可点击跳转）
    └── AihotStoryReports.vue             # 报道时间线（按发布时间倒序）
```

API 层复用 `modules/api/aihot`（全量 8 端点，`requestJson` 走 preload axios 桥，匿名无鉴权；增量游标在响应体内，无需改造 http 层）。

## 精选集本地缓存与增量同步（AihotSelectedService）

落盘文件：`~/.mistrelle/cache/aihot/selected.json`（缓存类数据收口在 `~/.mistrelle/cache` 子目录，不污染数据根目录）。

缓存结构：

```ts
interface AihotSelectedCache {
  schemaVersion: 1
  fields: 'default'   // 含 summary（时间轴卡片需要摘要），changes 增量跟随同一字段集
  cursor: string | null   // 账本水位；null = 尚未引导
  items: Array<AihotItem>
  syncedAt: string | null
}
```

同步状态机（`syncAihotSelected`，in-flight promise 去重）：

1. **cursor 为空 → snapshot 引导**：`{ fields: 'default', limit: 1000 }` 翻页（上页 `nextPage` → 下页 `page`，直到 `hasMore=false`）；**保留第一页返回的 cursor** 作为增量水位（API 文档语义）。
2. **cursor 存在 → changes 增量循环**：`{ cursor, limit: 100 }`，按文档「先应用页面再保存新 cursor」：upsert 按 id 替换/插入、remove 按 id 删除，**每页应用后即落盘**（崩溃后从上次水位续传）；`hasMore` 继续下一页。
3. **409 snapshot_required** → 游标失效，重置空壳自动重新引导一次。
4. **网络失败** → 保留缓存原样并提示；进程内缓存（`stateCache`）避免重复读盘，返回新引用视图供 Vue 响应式替换。

UI 侧（`useAihotSelectedItems`）：`init()` 读缓存即时渲染 + 自动增量同步；首开无缓存时同步期间显示 loading 遮罩，已有数据则静默同步不打断浏览（状态行显示「同步于 x 分钟前」）。自动同步约定：

- **静默**：自动同步不驱动刷新按钮转圈（`manualSyncing` 仅手动触发置 true）；手动点刷新立即增量同步并转圈，若恰有自动同步在途则跟随至结束。
- **节流**：距上次成功同步（`syncedAt`）< 5 分钟时 `init()` 跳过自动增量（首开无 syncedAt 必同步；手动刷新不受限；同步失败 syncedAt 不更新，节流窗口过后自动重试）。

## 数据获取约定（与接入文档的对应关系）

1. **items 游标**：`nextCursor` 不透明、原样回传、仅同查询复用；筛选/关键词变化重置第一页；追加遇 400 视为 invalid_cursor（窗口滑动失效）自动从第一页重载。
2. **本地模式窗口**：「全部时间」仅本地缓存可用（本地才有全量历史）；切到在线模式自动回退 7d。窗口过滤按基准时间戳计算（`by=timeline` 用 discoveredAt、`by=published` 用 publishedAt ?? discoveredAt），与服务端 items 语义对齐。
3. **无自动轮询**：全部请求由用户动作触发；selected 同步走 changes 增量（打开页面一次 + 手动刷新）。
4. **关键词**：`q` trim 后 2–200 码点才发送（<2 视为无关键词），在线输入防抖 400ms；本地模式为包含匹配（title/originalTitle/summary），即时过滤。
5. **story id 来源**：只取 API 返回值（hot-topics `links.story` URL 末段、story 的 `storyline` / `related` 的 `publicId`），解析失败禁止构造 id，回退打开 `links.aihot` 外链；308 重定向由 axios 自动跟随，404 展示「事件不存在或已下线」。
6. **日报不可变缓存**：按 `date` 建组件级 `Map` 缓存，同一天绝不重复请求（文档 "never re-fetch a date it already has"）；最新日报直接请求稳定 URL `/latest`，不从索引猜日期；刷新只重拉 latest 与归档索引，不清日报缓存。
7. **错误提示**（`modules/aihot/AihotRequestError.ts`）：429 / 503 读 `Retry-After` 头提示具体秒数；404 / 400 / 409 给语义化文案；其余 `MessageUtil.error(fallback, e)`；失败时保留已加载数据。
8. **category 容忍新值**：已知五类显示中文（`aihot-page-utils.ts` 的 `AIHOT_CATEGORY_LABELS`），未知值原样展示。

## 注意事项

- 模板表达式无法访问全局 `window`，外链打开一律收敛到方法内调用 `window.preload.inject.shell.openExternal`。
- `window` 是全局标识符，筛选状态命名用 `timeWindow` 避免遮蔽。
- 分层方向：`pages/**` 依赖 `modules/aihot/**`；模块层不得反向 import 页面目录（错误处理工具放 `modules/aihot/AihotRequestError.ts` 即为此）。
- tabs 撑满高度依赖 `:deep()` 改写 `.t-tabs__content` / `.t-tab-panel`（同 SkillHubDetailContent 模式）。
- 项目无全局 `border-box`，`.aihot-page` 显式声明 `box-sizing: border-box`。
- 时间轴竖线位置由固定几何推算：时间列 40px + 间距 12px + 圆点半径 4.5px → 线 `left: 56px`（见 `AihotTimelineList.vue`）。
- 联合元素数组（`AihotItem | AihotItemMinimal`）上的 `filter` 需先显式拓宽元素类型，类型守卫才能收窄（AihotSelectedService 内有示例）。
