# 文生图页面（attachment/image）

## 实现思路

「闲庭漫步 → 生图」页（路由 `/attachment/image`）：顶部生成表单 + 历史记录网格。
真实生图复用聊天模块的叶子服务 `@/modules/chat/service/ImageGenerate.generateImage`
（兼容 OpenAI 同步 b64/url 与异步 task_id 轮询两种中转站形态），本页只负责：
模型/尺寸选择、提示词表单、记录持久化（SQLite）、图片文件管理（按月分桶落盘）、
生成状态机（pending → success / failed）、历史检索、失败删除与异步任务的「续轮询重试」。

模型来源分两级：表单「生图模型」下拉（`SettingAiStore.imageOptions`，
type=image 的模型分组，value=`${provideId}:${identifier}`）显式选择优先，
缺省回退「设置 → 默认设置 → 默认生图模型」；`generateImage` 的 `params.model` 同样如此。
表单挂载时自动选中默认生图模型（store 异步读盘后回填，手动改选不覆盖）。
另可选**设计风格**（全局组件 `StyleSelect`，见 `docs/design/05-style-preview.md`）：
选中后 `buildDesignStylePrompt` 把风格转成提示词段，仅拼接进实际生图请求
（`${用户prompt}\n\n${风格提示词}`）；记录存用户原始 prompt，风格名快照存 `style_name` 列留档出处。
记录存 SQLite（`image_generate` 表），图片文件存
`~/.mistrelle/image/generate/{yyyy-MM}/{id}.png`（文件名 = 记录 id，id 即雪花 id），
展示走 `mistrelle://` 本地协议（`window.preload.net.pathToHref`）。

### 异步任务续轮询（重试）

异步任务型生图（POST 响应带 `task_id`）：**确认异步任务型即落库** `task_id` +
`poll_max_at`（查询绝对截止 = 确认时刻 + 5 分钟）——通过 `generateImage` 的
`onTaskCreated(taskId, pollMaxAt)` 回调，在开始轮询**之前**把远端标识写入 pending 记录，
因此轮询中任何中断（应用退出 / 刷新）后记录都已带 task_id，可跨重启续同一任务；
成功 / 已确认终态失败的记录同样保留 task_id（作为「该单是轮询任务」的标记，
是否可续由 `status` / `task_terminal` / `poll_max_at` 区分）。之后本地轮询 5 分钟
（3s × 100 次）失败时，UI 对「可恢复」的失败显示「重试」：

- 点击 = `resumeTaskPoll`：**不再重新提交任务**，直接按剩余窗口对同一 `task_id` 续轮询，
  成功则落盘收尾 success，失败则保持 failed（更新 error）；不重复扣费。
- 仅异步任务型（`task_id` 非空）、远端未确认终态（`task_terminal` 非 true）、
  且未超查询窗口（`poll_max_at > now`）的失败才显示重试。
- 远端明确 failed / cancelled、completed 但缺图、以及同步模式失败（无 task_id）→ 无远端任务可续，
  不显示重试，只可删除；需要重新生成时回顶部表单再提交。

## 关键文件

| 层 | 文件 | 职责 |
|---|---|---|
| main | `src/main/src/db/schema/image.ts` | `image_generate` 表定义 |
| main | `src/main/src/db/repo/imageRepo.ts` | 查询（keyword LIKE / status 筛选 / 时间倒序分页）、upsert、delete |
| main | `src/main/src/ipc/dbIpc.ts` | `db:image:list/upsert/delete` 三条 IPC handler |
| preload | `src/preload/src/dbChannels.ts` | db 域通道常量与 `ImageRecordInput` 等类型（main/preload/渲染侧三端共用） |
| preload | `src/preload/src/db.ts` | `dbApi.image` 域薄桥 |
| renderer | `src/renderer/src/types/db.d.ts` | 渲染侧 `window.preload.db.image` 契约 |
| renderer | `src/renderer/src/global/Constant.ts` | `getImageGenerateDir(month)` 路径工厂 |
| renderer | `pages/attachment/image/AttachmentImagePage.vue` | 页面骨架（生成面板 + 记录网格） |
| renderer | `pages/attachment/image/useImageGenerations.ts` | **模块级单例**数据源：分页/搜索/生成状态机/删除/续轮询重试（跨路由切换存活） |
| renderer | `pages/attachment/image/components/ImageGenerateForm.vue` | 模型+风格+尺寸+提示词 + 生成按钮（默认模型自动选中；未配置模型时引导） |
| renderer | `components/design/StyleSelect.vue` | 全局设计风格下拉（分组 + 悬浮预览 + 非会员锁定），与 PageNew 共用；`v-model` 风格 id |
| renderer | `pages/attachment/image/components/ImageRecordGrid.vue` | 历史网格（占位卡/失败可续重试 + 删除/搜索/加载更多/空态） |
| renderer | `pages/attachment/image/components/ImageDetailDrawer.tsx` + `ImageDetailDrawerContent.vue` | 图片详情命令式抽屉（大图 + t-image-viewer + 复制 prompt + 删除/重试） |
| renderer | `pages/attachment/image/image-page-utils.ts` | `formatDateTime` / `pathToHref` / `canResumePoll` / `isRetryableFailed` 纯函数 |
| renderer | `modules/chat/service/ImageGenerate.ts` | 生图统一服务：`generateImage`（同步/异步自适应）+ `resumeTaskPoll`（续轮询） |

## 数据结构 / IPC 契约

表 `image_generate`：`id`(PK, 雪花) / `prompt`(用户原文) / `model`(模型名快照) /
`style_name`(设计风格名快照，未选风格为空) / `size` /
`path`(图片绝对路径，pending 时即为预定路径) / `width` / `height` / `status` / `error` /
`task_id`(异步任务型远端标识，同步为空) / `poll_max_at`(远端查询绝对截止) /
`task_terminal`(远端是否已确认终态) / `created_at`。

状态机与生命周期（渲染侧驱动）：

- 提交即插入 `pending` 记录（`ImageRecordInput` 全列 upsert），UI 列表头插占位卡；允许多个任务并行
- 异步任务型在轮询开始前即落库远端标识：`generateImage` 确认响应带 `task_id` 后，
  经 `onTaskCreated(taskId, pollMaxAt)` 回调把 `task_id` + `poll_max_at` 写入 pending 记录
  （此时 `task_terminal` 仍为 null / false，任务未确认终态）
- `generateImage` 结束：成功 → upsert `success` + 真实宽高（sharp 元信息/fallback size 解析）；
  失败 → upsert `failed` + `error`，按失败类型标终态：
  - 异步任务型可恢复失败（轮询超时 / 连续查询失败 / 响应异常）→ 保留 `task_id` + `poll_max_at`，`task_terminal=false`
  - 异步任务型已确认终态（远端 failed/cancelled / completed 但缺图）→ `task_terminal=true`，不可续
  - 同步失败 / 提交即失败（无远端任务）→ `task_id` 为空，不可续
- 「重试」仅对 `canResumePoll(record)` 为真的失败显示（`failed` + `task_id` 非空 + `task_terminal` 非 true + `poll_max_at > now`）：
  `resumeRetry` 把记录原地改回 `pending` → `resumeTaskPoll` 按剩余窗口续查同一远端任务，
  成功落盘收尾 success，失败保持 failed 并更新 error / 窗口标记；不重新提交任务、不重复扣费。
  详情抽屉内重试后自动关闭回列表看占位卡反馈（ImageDetailDrawer.tsx 在 onRetry 中 destroy）。
- 失败卡操作：可续失败 → 「重试」+ 删除按钮；不可续失败 / 同步失败 → 仅删除按钮；
  失败卡可点击打开详情抽屉（完整 error alert + 删除 / 可续时重试）；生成中（pending）卡不可点。
- 删除记录（卡片 / 详情通用）走 `remove`：删行 + 联动删文件；删除 `pending` 记录记入取消集合，
  其任务 / 续轮询完成后丢弃结果并清掉落盘文件（防 upsert 复活已删行）
- 页面初始化把遗留 `pending`（上次会话中断）统一收尾为 `failed`（error：生成中断）；
  若该记录带 `task_id` 且未确认终态，收尾后仍可「重试」续轮询（跨应用重启恢复能力）

IPC（`dbApi.image`）：`list({filter:{keyword,status}, limit, offset}) → {items,total}`
（keyword ≥ 2 字符对 prompt 子串 LIKE，status 可选）、`upsert(record)`（onConflictDoUpdate 全列）、
`delete(id)`（只删行，图片文件由渲染侧 `fs.rm` 联动删）。

## 注意事项

- **设计风格提示词**：`generate(prompt, size?, model?, styleId?)` 第 4 参为风格 id；
  `DesignStyleStore.getDetail(styleId)` 拿完整 `AiDesignStyle` 后 `buildDesignStylePrompt(style)`
  （withVisualPrompt 默认 true，含正/反向提示词段）拼成 `${用户prompt}\n\n${风格提示词}` 传给
  `generateImage`。**记录 `prompt` 列保留用户原文**（历史卡片可读），风格名快照存 `style_name` 列
  （同 `model` 快照语义，风格后期改名 / 删除不影响历史展示；记录卡 meta 行「模型 · 风格」合并显示、
  详情抽屉单独一行）；风格已删或详情读取失败时按无风格生成（style_name 为空）不阻断；
  续轮询 `resumeTaskPoll` 沿用远端 task_id，与风格无关。
- **默认生图模型回显**：表单 `watch(defaultImageModel, immediate)`，模型下拉为空且有默认时自动选中
  （store 异步读盘后也能回填）；用户手动改选后不被覆盖，清空仍走「跟随默认」回退语义。
- 模型来源优先级：表单显式选择（`params.model`）> 默认生图模型；`defaultImageModel` 为空但页面显式选了模型时同样可生成。
  表单引导三态：无任何可用生图模型（imageOptions 空）→ 「去设置」；有模型但未选且未配默认 → 提示选择；否则正常生成。
- 记录 `model` 列存的是生成时使用的 `option.model` 显示名快照；续轮询按该名称在 `optionMap` 反查 key
  （同名前取第一个匹配），找不到时回退默认模型——因此历史记录不因设置变更而失真。
- 新增 SQLite 域的五处同步清单：`schema/`（新表）+ `schema/index.ts`、`repo/`、
  `ipc/dbIpc.ts`、`preload/dbChannels.ts`、`preload/db.ts`、渲染侧 `types/db.d.ts`；
  表结构变更后需 `npx drizzle-kit generate` 生成迁移（`resources/drizzle/`），运行时 `migrate()` 自动应用。
  `task_id` / `poll_max_at` / `task_terminal` 三列为 2026-09-02 增量（`resources/drizzle/0008_*.sql`，纯 ADD 列，
  存量行三列为 NULL → 判定为不可续轮询、UI 隐藏「重试」，无数据迁移）；
  `style_name` 为 2026-09-02 增量（`0009_*.sql`，纯 ADD 列，存量行为 NULL → UI 显示「—」，无数据迁移）。
- `status` 列用 `$type<ImageGenerateStatus>()` 声明字面量类型（drizzle text() 默认推断为 string，否则 select 返回无法赋值给 `ImageRecordInput`）；
  `task_terminal` 列用 `{ mode: 'boolean' }` 声明（渲染侧 `ImageRecordInput.taskTerminal: boolean | null`）。
- 失败分类语义（`ImageGenerate.ts`）：`kind: 'terminal' | 'resumable'`——
  同步失败 / 提交即失败 / 落盘失败均标 terminal（无远端任务可续）；轮询超时与查询异常标 resumable
  并带出 `taskId` / `pollMaxAt`（窗口沿用 onTaskCreated 落库的截止，不重新计时）。
  `task_id` 无论成败都在确认异步任务型时落库（标记该单为轮询任务），
  「是否可续」由 `status`（非 success）+ `task_terminal`（非 true）+ `poll_max_at`（> now）三者判定。
  首次轮询「跑满 5 分钟超时」时 `poll_max_at` 已近耗尽 → UI 通常不再显示重试（窗口已过，远端任务不再保留）；
  真正的续轮询价值在「轮询中途连续查询失败提前退出」——此时窗口尚余，重试可继续等图。
  续轮询不重置窗口（沿用落库的 `poll_max_at`），远端任务生命周期固定 ≈ 创建后 5 分钟。
- 连续生成交互：提交后输入框立即清空（失败可从失败记录卡找回 prompt）；生成按钮不受任务进行中影响，
  允许任意数量任务并行提交（进度由 pending 占位卡反馈）；「t-button loading 态会禁点」——不要把按钮 loading 绑到任务进行中状态。
- 跨路由切换：`useImageGenerations` 为模块级单例，状态与运行中任务存模块闭包（生产环境 keep-alive 白名单仅保活聊天页，
  文生图页切走即卸载）；请求不因页面卸载中断，重新进入 `init()` 拉最新列表即可看到进行中/已完成的最新状态；
  `init()` 的遗留 pending 收尾会排除 `runningIds` 中的任务，不会误标正在生成中的记录。
- 尺寸下拉支持自定义输入，校验 `^\d{3,4}[xX]\d{3,4}$`；提交格式统一小写 x。
- 弹窗遵循命令式 DrawerPlugin 约定：`.tsx` 外壳 + `.vue` 内容组件，`footer: false`，删除成功即关闭抽屉。
- 详情抽屉「复制图片」走 `inject.clipboard.copyImageByPath(path)`（`clipboard:copyImageByPath` 通道，main 侧
  `nativeImage.createFromPath`）——与既有 `copyImage`（base64/dataURL 语义，DataURL 走 `data:` 分支）区分，路径语义不引入歧义。
- 页面组件均遵循 `pages/` 纯 UI 分层，生图服务从具体文件路径 import（叶子模块，避免经过 chat 桶文件循环依赖）。