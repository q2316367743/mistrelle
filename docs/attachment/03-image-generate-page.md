# 文生图页面（attachment/image）+ 主进程 ImageService

## 实现思路

「闲庭漫步 → 文生图」页（路由 `/attachment/image`）：顶部生成表单 + 历史记录网格。
2026-09-03 重构后，**生图任务的编排与全局运行态整体上移主进程**（`main/src/image/ImageService.ts`
单例），渲染层只剩视图与 IPC 薄代理——未来新增专门的生图页面（或 AI 工具）直接消费同一服务即可。

### 生成参数面（2026-09-10 对齐服务端）

`ImageGenerateParams` 已补齐服务端 `/api/images/generations` 支持的全部可选参数：
`size`（宽x高 **或比例** 16:9）/ `resolution`（1k/2k/4k 像素档位）/ `n`（1-4 张，main 侧 clamp）
/ `quality` / `background` / `outputFormat`（非 png 时落盘扩展名跟随）/ `outputCompression`（0-100）
/ `moderation` / `nsfwCheck` / `imageUrls`（参考图）。

- **透传原则**：main `buildBody` 只把**已定义**的参数放进请求体（`n` 恒传、缺省 1），
  避免把不支持某参数的上游渠道打挂；`size` 不再强制回退 `DEFAULT_SIZE`，空则不传。
- **表单布局**：参数行 = 模型/风格/尺寸/分辨率/张数；「参考图」入口与「高级参数」折叠
  （quality/background/outputFormat/outputCompression/moderation/nsfwCheck）在下方一行。
  「自动」哨兵值（`auto`）提交时不传该参数。尺寸校验放宽为 `宽x高` 或 `比例` 两种格式。
- **参考图（图生图）**：表单用 `ImageReferencePicker`（t-upload custom 主题，只取本地路径不真上传，
  ≤15 张）；工具侧参数名 `referenceImagePaths`。main `normalizeReferences` 把本地绝对路径读为
  base64 data URI（校验 png/jpg/jpeg/webp/gif 扩展名），http(s)/data URI 原样透传。

### 单记录多图（n>1）

一次任务出多张仍落**一条记录**：`image_generate` 表新增 `images` 列（`ImageItem[]` JSON 文本，
迁移 0011）；`path/width/height` 保留为**第一张快照**（兼容旧消费方）。产物路径第 1 张为
`{月桶}/{id}.{ext}`、第 2 张起追加 `-2/-3/-4` 序号（工具直出模式同理，基于传入 path 派生）；
`extractImages` 按响应实际张数落盘（部分出图按实际数量收）；删除/取消清理全部产物文件。
渲染层 `ImageRecordInput.images` 读取时归一化为必有数组（旧数据由 path 兜底单元素，
`imageRepo.toRecord`）。

### 只调自有服务端接口

生图全部走 mistrelle-server 自定义 API（`/api/images/*`，Result + camelCase，
**统一异步任务模型**：提交得 `taskId`，轮询查结果）：

- `GET /api/images/models`：公开档位列表（无需登录），`data[]` 为 `{ code, name }`。
- `GET /api/images/models/priced`：登录后档位列表，`data[]` 为 `{ code, name, pointsPerImage }`。
- `POST /api/images/generations`：提交任务，**立即**返回 Result `data` 为 `{ taskId, status:'processing', ... }`；上游在服务端后台执行。
- `GET /api/images/tasks/{taskId}`：任务状态查询（processing 时异步渠道会实时查上游并结算；同步渠道完成后直接读本地图）。

HTTP 细节在 main `RelayService`（`imageModels / imageGenerate / imageTask`）：
未登录 `imageModels` 走公开端点（`getServerBaseUrl()`），已登录走 priced + Bearer；
提交/轮询经 `getRelayContext()` 注入 Bearer，凭证不下发渲染层。
`relay` IPC 通道不为生图扩展，image 域走自己的 `image:*` 通道。

### 模型来源：服务端档位

- 渲染层 `store/image/ImageModelStore.ts`（pinia）：`items`（`ImageModelOption{label,value,pointsPerImage?}`，
  已登录 label 形如「经济（10积分）」）、
  `loading`、`needLogin`（仅挡生成引导，不挡列表）；启动拉取 + 订阅 `auth:changed` 刷新
  （AuthStore 从文件直连 import 防桶文件成环）。
- 表单「生图模型」下拉用 `t-option` 自定义：左侧档位名、右侧「N 积分/张」；默认选中：`defaultImageModel` 与某项
  `value` 相等则选中，否则自动选首项（仅表单内，不写回设置；手动改选/清空后不被自动覆盖——watch 只监听
  列表与默认值变化）。未登录仍可看公开模型列表，生成需登录（「登录后可使用生图」+ 登录按钮）；
  已登录列表空显示「暂无可用生图模型」。
- `defaultImageModel`（设置 → 默认设置）保留，语义为**服务端档位 code**；设置页下拉选项同样
  来自 `ImageModelStore`（登录后可见积分）。它仍是表单默认选中与 `image_generate` 工具的门控/缺省来源
  （`design/index.ts` 门控、`ChatTypeConfig.hasImageGenerate` 逻辑不变）。
- `SettingAiStore.imageOptions`（type=image 的本地模型分组）已随孤儿化删除。

### 设计风格

选中风格时渲染层解析：`DesignStyleStore.getDetail(styleId)` → `buildDesignStylePrompt(style)`
拼成 `${用户prompt}\n\n${风格提示词}` 作为实际请求 prompt，`styleName` 快照随参数落库
（主进程保持 design 无关）；记录 `prompt` 列存用户原文。

### 异步任务续轮询（重试）

驱动方为主进程 ImageService；语义按「远端 = 自研服务端」重新校准（2026-09-03 二次修正）：

- **确认异步任务型即落库**：提交响应拿到 `taskId` 后，先写 `task_id` + `poll_max_at`
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
| main | `src/main/src/modules/relay/RelayService.ts` | `/api/images/*` 三个 HTTP 函数（`imageModels/imageGenerate/imageTask`，Result 解包；公开 models 不依赖登录） |
| main | `src/main/src/modules/image/imageIpc.ts` | `image:*` handler（注册时执行 cleanupOrphans；须在 registerDbIpc 之后） |
| main | `src/main/src/db/repo/imageRepo.ts` | `imageList/imageGet/imageUpsert/imageDelete`（行级 CRUD，无业务） |
| main | `src/main/src/db/schema/image.ts` | `image_generate` 表定义 |
| preload | `src/preload/src/modules/image/imageChannels.ts` | `image:*` 通道常量与载荷类型（main/preload/渲染三端共用；记录行类型沿用 dbChannels） |
| preload | `src/preload/src/modules/image/image.ts` | `imageApi` 薄桥（含 `onRecordChanged` 订阅） |
| preload | `src/preload/src/modules/db/dbChannels.ts` | 保留 `ImageRecordInput` 等表形状类型；`db:image:*` 三通道已删（list 迁 `image:list`，upsert/delete 上移） |
| renderer | `src/renderer/src/types/image.d.ts` | `window.preload.image` 契约（挂载于 `vite-env.d.ts`） |
| renderer | `src/renderer/src/store/image/ImageModelStore.ts` | 服务端生图档位列表（登录态联动） |
| renderer | `pages/extend/image/useImageGenerations.ts` | 薄数据源：分页/关键词视图态 + 广播订阅就地替换 + generate/resume/remove 代理 + 风格解析 |
| renderer | `pages/extend/image/components/ImageGenerateForm.vue` | 参数行（档位含积分展示/风格/尺寸/分辨率/张数）+ 参考图与高级参数入口 + 提示词表单（提交载荷 `ImageFormSubmit` 对象） |
| renderer | `pages/extend/image/components/ImageReferencePicker.vue` | 参考图选择（t-upload custom 主题只取本地路径，≤15 张，缩略行可删；v-model 出 `string[]`） |
| renderer | `pages/extend/image/components/ImageAdvancedOptions.vue` | 高级参数折叠面板（quality/background/outputFormat/outputCompression/moderation/nsfwCheck，defineModel 编辑父级对象） |
| renderer | `pages/extend/image/components/ImageRecordCard.vue` | 单张记录卡（首图封面 + ×N 多图角标 + 重试/删除）；`ImageRecordGrid.vue` 只负责工具栏/网格/加载更多 |
| renderer | `pages/extend/image/components/ImageDetailGallery.vue` / `ImageDetailDrawer.*` | 详情画廊（多图缩略条 + 主图，`v-model` 下标与 `t-image-viewer v-model:index` 联动）与抽屉外壳 |
| renderer | `modules/tool/components/design/imageGenerate.ts` | `image_generate` 工具：全参数 schema（n/resolution/quality/…/referenceImagePaths），返回 `images` 全量 chatImages |

## 数据结构 / IPC 契约

表 `image_generate`（迁移 0011 加 `images` 列）：`id`(PK) / `prompt`(用户原文) / `model`(档位 code 快照) /
`style_name` / `size` / `path`(第一张产物路径快照，pending 时即为预定路径 `{月桶}/{id}.{ext}`) /
`width` / `height`(第一张尺寸) / **`images`(`ImageItem[]` JSON 文本，全部产物)** /
`status`(pending/success/failed) / `error` / `task_id` / `poll_max_at` / `task_terminal` / `created_at`。

`ImageItem = { path, width, height }`（dbChannels 定义，渲染侧 ambient 镜像同名）；
仓储层 `imageRepo` 读时归一化（旧数据 `images` 为空 → 由 `path` 兜底单元素），写时序列化，
**消费方可把 `record.images` 当必有数组用**。

`image:*` 通道（`ImageChannels`）：

- `image:getModels` → `Array<{ label, value, pointsPerImage? }>`（未登录公开列表，已登录含积分）。
- `image:generate(params: ImageGenerateParams)` → `ImageGenerateInvokeResult`：
  - 参数：`prompt` / `model` / `size`(宽x高或比例) / `resolution`(1k/2k/4k) / `n`(1-4) /
    `quality` / `background` / `outputFormat` / `outputCompression` / `moderation` / `nsfwCheck` /
    `imageUrls`(本地路径/http/data URI，main 归一化) / `styleName` / `record` / `path` / `wait`。
  - 页面模式（`record` 缺省 true）：主进程建 pending 记录（id=uuid、`images` 预填 n 条预定路径）
    落库并广播，**立即返回** `{ phase: 'started', record }`；后续进展经广播推进。
  - 工具直出（`record: false`，`path` 必填）/ `wait: true`：等待终态返回
    `{ phase: 'finished', result }`，
    `result = { path, width?, height?, images? } | ImageGenerateError`（path/width/height 为第一张，
    `images` 为全部产物）。
- `image:resume(id)` / `image:remove(id)`：续轮询 / 删除（联动取消 pending 任务与删全部产物文件）。
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
  回退 size 解析（主进程 `sharpMetadata`）。服务端 `images[]` 的 `url` / `b64Json` 两种形态都支持；
  **多图逐张落盘**（`task.paths[i]` ↔ 响应第 i 张，部分出图按实际张数收）。
- 失败分类语义不变：`kind: 'terminal' | 'resumable'`（见上）；`task_id` 无论成败都在确认异步
  任务型时落库，「是否可续」由 `status` + `task_terminal` 两点判定（`poll_max_at` 只是单次
  轮询会话预算）；每次续轮询都重置为全新 5 分钟预算。
- 连续生成交互不变：提交后输入框清空、按钮不绑全局 loading、任务可任意并行（进度由 pending 占位卡
  + 广播反馈）；尺寸校验放宽为 `^\d{3,4}[xX]\d{3,4}$` 或 `^\d{1,2}:\d{1,2}$`（比例）。
- 抽屉/网格/工具纯函数（`image-page-utils.ts`，含 `ImageFormSubmit`/`ImageAdvancedState` 契约）；
  本地资源 URL（pathToHref → 本地事件服务 `/file` 面）展示、复制图片（`copyImageByPath`）、
  showItemInFolder 等交互不受影响（详情抽屉按当前选中图操作）。
- 历史兼容：`db:image:*` 通道删除后，旧渲染代码若引用 `window.preload.db.image` 会直接 typecheck
  报错（契约收口在 `image:*`）；`task_id`/`poll_max_at`/`task_terminal`/`style_name` 列迁移见
  git 历史（0008/0009），`images` 列为迁移 0011（2026-09-10，单记录多图）。
- 未来新增生图页面：直接调 `window.preload.image.*`（generate/resume/remove/list）+ 订阅
  `onRecordChanged`，或在 `ImageService` 上扩领域方法；不要在渲染层重建任务状态机。
