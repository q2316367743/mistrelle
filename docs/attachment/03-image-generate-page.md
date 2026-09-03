# 文生图页面（attachment/image）+ 主进程 ImageService

## 实现思路

「闲庭漫步 → 文生图」页（路由 `/attachment/image`）：顶部生成表单 + 历史记录网格。
2026-09-03 重构后，**生图任务的编排与全局运行态整体上移主进程**（`main/src/image/ImageService.ts`
单例），渲染层只剩视图与 IPC 薄代理——未来新增专门的生图页面（或 AI 工具）直接消费同一服务即可。

### 只调自有服务端接口

生图全部走 mistrelle-server 的 OpenAI 兼容接口（`/v1/images/*`，OpenAI images 入参兼容，
**统一异步任务模型**：提交得 `task_id`，轮询查结果）：

- `GET /v1/images/models`：生图模型档位列表。**注意该端点是 `/api` 风格 Result 包装**
  （`{ success, code, msg, data }`，与 `/v1/models` 的 OpenAI list 形状不同），且 `data[]`
  直接为 `{ label, value }`（下拉选项，value = 档位 code）——`RelayService.imageModels`
  解包 Result 并原样透出选项，渲染层 t-select 直接绑定。
- `POST /v1/images/generations`：提交任务，顶层返回 `{ task_id, status, n, error, images }`。
- `GET /v1/images/tasks/{taskId}`：任务状态查询（processing 会实时查上游并结算）。

HTTP 细节在 main `RelayService`（`imageModels / imageGenerate / imageTask` 三个函数，
`getRelayContext()` 注入 Bearer，凭证不下发渲染层）；旧「optionMap 解析第三方供应商直连」
路径与渲染层 `modules/chat/service/ImageGenerate.ts` 已整体删除。
`relay` IPC 通道不为生图扩展，image 域走自己的 `image:*` 通道。

### 模型来源：服务端档位

- 渲染层 `store/image/ImageModelStore.ts`（pinia）：`items`（`ImageModelOption{label,value}`
  选项数组，服务端直出、t-select options 直接绑定）、
  `loading`、`needLogin`；启动拉取 + 订阅 `auth:changed` 登录态联动刷新/清空
  （AuthStore 从文件直连 import 防桶文件成环）。
- 表单「生图模型」下拉 = `imageModelStore.items` 直绑；默认选中：`defaultImageModel` 与某项
  `value` 相等则选中，否则自动选首项（仅表单内，不写回设置；手动改选/清空后不被自动覆盖——watch 只监听
  列表与默认值变化）。未登录显示「登录后可使用生图」+ 登录按钮（`openLogin`）；已登录列表空
  显示「暂无可用生图模型」。
- `defaultImageModel`（设置 → 默认设置）保留，语义变为**服务端档位 code**；设置页下拉选项同样
  来自 `ImageModelStore`。它仍是表单默认选中与 `image_generate` 工具的门控/缺省来源
  （`design/index.ts` 门控、`ChatTypeConfig.hasImageGenerate` 逻辑不变）。
- `SettingAiStore.imageOptions`（type=image 的本地模型分组）已随孤儿化删除。

### 设计风格

选中风格时渲染层解析：`DesignStyleStore.getDetail(styleId)` → `buildDesignStylePrompt(style)`
拼成 `${用户prompt}\n\n${风格提示词}` 作为实际请求 prompt，`styleName` 快照随参数落库
（主进程保持 design 无关）；记录 `prompt` 列存用户原文。

### 异步任务续轮询（重试）

驱动方为主进程 ImageService；语义按「远端 = 自研服务端」重新校准（2026-09-03 二次修正）：

- **确认异步任务型即落库**：提交响应拿到 `task_id` 后，先写 `task_id` + `poll_max_at`
  进 pending 记录并落库，再开始轮询——生成中任何中断（退出/刷新）记录都已带 task_id，
  可跨重启续同一任务。
- 轮询 3s × 100 次（≈5 分钟预算）；失败分类 `kind: 'terminal' | 'resumable'`：
  远端 failed、completed 缺图、提交即失败 → terminal（`task_terminal=true`，只可删除）；
  轮询预算耗尽、查询连续失败 ≥5 次 → resumable（可续）。
- **重试资格只看两点**：`status=failed` + `task_id` 非空 + `task_terminal≠true`
  （`image-page-utils.isRetryableFailed`）。`poll_max_at` 只是单次轮询会话的本地预算，
  **不作为重试资格**——第三方中转时代的「5 分钟保留窗口」对自研服务端不存在，超时失败
  （预算耗尽）恰恰是最该续询的场景，必须显示重试按钮（曾因沿用旧门控导致超时后无重试入口）。
- 「重试」= `image:resume(id)`：主进程把记录原地改回 pending，对同一 `task_id` 以**全新 5 分钟
  预算**继续查询，**不重新提交任务、不重复扣费**；已确认终态的记录主进程同样拒绝续询（防御）。
- 启动收尾：`registerImageIpc` 时执行 `cleanupOrphans()`，把不在运行中的遗留 pending
  （上次会话中断）标 failed（error：生成中断）；运行中的任务跨渲染层刷新存活。

## 关键文件

| 层 | 文件 | 职责 |
|---|---|---|
| main | `src/main/src/modules/image/ImageService.ts` | **生图编排与运行态单例**：startGeneration（建记录/工具直出两模式）+ 轮询 + 落盘 + finish 收尾 + 广播 + resume/remove/cleanupOrphans |
| main | `src/main/src/modules/relay/RelayService.ts` | `/v1/images/*` 三个 HTTP 函数（`imageModels/imageGenerate/imageTask`，Bearer 注入在 main） |
| main | `src/main/src/modules/image/imageIpc.ts` | `image:*` handler（注册时执行 cleanupOrphans；须在 registerDbIpc 之后） |
| main | `src/main/src/db/repo/imageRepo.ts` | `imageList/imageGet/imageUpsert/imageDelete`（行级 CRUD，无业务） |
| main | `src/main/src/db/schema/image.ts` | `image_generate` 表定义 |
| preload | `src/preload/src/modules/image/imageChannels.ts` | `image:*` 通道常量与载荷类型（main/preload/渲染三端共用；记录行类型沿用 dbChannels） |
| preload | `src/preload/src/modules/image/image.ts` | `imageApi` 薄桥（含 `onRecordChanged` 订阅） |
| preload | `src/preload/src/modules/db/dbChannels.ts` | 保留 `ImageRecordInput` 等表形状类型；`db:image:*` 三通道已删（list 迁 `image:list`，upsert/delete 上移） |
| renderer | `src/renderer/src/types/image.d.ts` | `window.preload.image` 契约（挂载于 `vite-env.d.ts`） |
| renderer | `src/renderer/src/store/image/ImageModelStore.ts` | 服务端生图档位列表（登录态联动） |
| renderer | `pages/extend/image/useImageGenerations.ts` | 薄数据源：分页/关键词视图态 + 广播订阅就地替换 + generate/resume/remove 代理 + 风格解析 |
| renderer | `pages/extend/image/components/ImageGenerateForm.vue` | 档位+风格+尺寸+提示词表单（默认档位自动选中、登录引导） |
| renderer | `pages/extend/image/components/ImageRecordGrid.vue` / `ImageDetailDrawer.*` | 历史网格与详情抽屉（未改，纯读记录字段） |
| renderer | `modules/tool/components/design/imageGenerate.ts` | `image_generate` 工具：改走 `image.generate({record:false})` 工具直出模式 |

## 数据结构 / IPC 契约

表 `image_generate`（未变）：`id`(PK) / `prompt`(用户原文) / `model`(档位 code 快照) /
`style_name` / `size` / `path`(pending 时即为预定路径 `{月桶}/{id}.png`) / `width` / `height` /
`status`(pending/success/failed) / `error` / `task_id` / `poll_max_at` / `task_terminal` / `created_at`。

`image:*` 通道（`ImageChannels`）：

- `image:getModels` → `Array<{ id }>`（未登录抛错）。
- `image:generate(params: ImageGenerateParams)` → `ImageGenerateInvokeResult`：
  - 页面模式（`record` 缺省 true）：主进程建 pending 记录（id=uuid、路径 `{月桶}/{id}.png`）
    落库并广播，**立即返回** `{ phase: 'started', record }`；后续进展经广播推进。
  - 工具直出（`record: false`，`path` 必填）/ `wait: true`：等待终态返回
    `{ phase: 'finished', result }`，`result = { path, width?, height? } | ImageGenerateError`。
- `image:resume(id)` / `image:remove(id)`：续轮询 / 删除（联动取消 pending 任务与删文件）。
- `image:list(params)` → `{ items, total }`（keyword ≥2 字符 LIKE + status 筛选 + 时间倒序分页）。
- `image:recordChanged(record)`（main → 渲染广播）：记录每次落库推进（pending → success/failed）
  都推全量行，渲染层就地替换列表项；删除不广播（渲染层自行更新视图）。

## 注意事项

- **运行态归属**：进行中任务存 ImageService 模块闭包 `Map<id, RunningTask>`，跨窗口、跨渲染层
  刷新存活；应用退出随进程结束，由启动 `cleanupOrphans()` 兜底收尾。渲染层不再持有
  runningIds/cancelledIds——pending 删除的「取消集合」语义（完成时丢弃结果并清文件、防 upsert
  复活）由 `RunningTask.cancelled` 承担。
- **双模式出口**：页面（建记录 + 广播）与工具（不建记录、等待终态）共用同一条执行链
  （提交 → 轮询 → 落盘 → finish）；工具产物不进页面历史（与旧行为一致）。
- 记录 `model` 列存服务端档位 code；续轮询只需 `id`（主进程 `imageGet` 回读记录），不再需要
  旧的「显示名反查 optionMap key」逻辑。
- 落盘：url 下载与 b64 解码都在 main（axios arraybuffer / Buffer.from）；宽高 sharp 元信息优先、
  回退 size 解析（主进程 `sharpMetadata`）。服务端 `images[]` 的 `url` / `b64_json` 两种形态都支持。
- 失败分类语义不变：`kind: 'terminal' | 'resumable'`（见上）；`task_id` 无论成败都在确认异步
  任务型时落库，「是否可续」由 `status` + `task_terminal` 两点判定（`poll_max_at` 只是单次
  轮询会话预算）；每次续轮询都重置为全新 5 分钟预算。
- 连续生成交互不变：提交后输入框清空、按钮不绑全局 loading、任务可任意并行（进度由 pending 占位卡
  + 广播反馈）；尺寸校验 `^\d{3,4}[xX]\d{3,4}$`。
- 抽屉/网格/工具纯函数（`image-page-utils.ts`）未改；`mistrelle://` 协议展示、复制图片
  （`copyImageByPath`）、showItemInFolder 等交互不受影响。
- 历史兼容：`db:image:*` 通道删除后，旧渲染代码若引用 `window.preload.db.image` 会直接 typecheck
  报错（契约收口在 `image:*`）；`task_id`/`poll_max_at`/`task_terminal`/`style_name` 列迁移见
  git 历史（0008/0009），本次重构无新迁移。
- 未来新增生图页面：直接调 `window.preload.image.*`（generate/resume/remove/list）+ 订阅
  `onRecordChanged`，或在 `ImageService` 上扩领域方法；不要在渲染层重建任务状态机。
