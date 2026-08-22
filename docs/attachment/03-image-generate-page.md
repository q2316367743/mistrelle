# 文生图页面（attachment/image）

## 实现思路

「闲庭漫步 → 生图」页（路由 `/attachment/image`）：顶部生成表单 + 历史记录网格。
真实生图复用聊天模块的叶子服务 `@/modules/chat/service/ImageGenerate.generateImage`
（兼容 OpenAI 同步 b64/url 与异步 task_id 轮询两种中转站形态），本页只负责：
模型/尺寸选择、提示词表单、记录持久化（SQLite）、图片文件管理（按月分桶落盘）、
生成状态机（pending → success / failed）、历史检索与删除。

模型来源分两级：表单「生图模型」下拉（`SettingAiStore.imageOptions`，
type=image 的模型分组，value=`${provideId}:${identifier}`）显式选择优先，
缺省回退「设置 → 默认设置 → 默认生图模型」；`generateImage` 的 `params.model` 同样如此。
记录存 SQLite（`image_generate` 表），图片文件存
`~/.mistrelle/image/generate/{yyyy-MM}/{id}.png`（文件名 = 记录 id，id 即雪花 id），
展示走 `mistrelle://` 本地协议（`window.preload.net.pathToHref`）。

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
| renderer | `pages/attachment/image/useImageGenerations.ts` | **模块级单例**数据源：分页/搜索/生成状态机/删除/重试（跨路由切换存活） |
| renderer | `pages/attachment/image/components/ImageGenerateForm.vue` | 模型+尺寸+提示词 + 生成按钮（未配置模型时引导） |
| renderer | `pages/attachment/image/components/ImageRecordGrid.vue` | 历史网格（占位卡/失败重试/搜索/加载更多/空态） |
| renderer | `pages/attachment/image/components/ImageDetailDrawer.tsx` + `ImageDetailDrawerContent.vue` | 图片详情命令式抽屉（大图 + t-image-viewer + 复制 prompt + 删除/重试） |
| renderer | `pages/attachment/image/image-page-utils.ts` | `formatDateTime` / `pathToHref` 纯函数 |

## 数据结构 / IPC 契约

表 `image_generate`：`id`(PK, 雪花) / `prompt` / `model`(模型名快照) / `size` /
`path`(图片绝对路径，pending 时即为预定路径) / `width` / `height` / `status` / `error` / `created_at`。

状态机与生命周期（渲染侧驱动）：

- 提交即插入 `pending` 记录（`ImageRecordInput` 全列 upsert），UI 列表头插占位卡；允许多个任务并行
- `generateImage` 结束：成功 → upsert `success` + 真实宽高（sharp 元信息/fallback size 解析）；
  失败 → upsert `failed` + `error`
- 页面初始化把遗留 `pending`（上次会话中断）统一收尾为 `failed`（error：生成中断）
- 删除 `pending` 记录会记入取消集合，其任务完成后丢弃结果并清掉落盘文件（防 upsert 复活已删行）

IPC（`dbApi.image`）：`list({filter:{keyword,status}, limit, offset}) → {items,total}`
（keyword ≥ 2 字符对 prompt 子串 LIKE，status 可选）、`upsert(record)`（onConflictDoUpdate 全列）、
`delete(id)`（只删行，图片文件由渲染侧 `fs.rm` 联动删）。

## 注意事项

- 模型来源优先级：表单显式选择（`params.model`）> 默认生图模型；`defaultImageModel` 为空但页面显式选了模型时同样可生成。
  表单引导三态：无任何可用生图模型（imageOptions 空）→ 「去设置」；有模型但未选且未配默认 → 提示选择；否则正常生成。
- 记录 `model` 列存的是生成时使用的 `option.model` 显示名快照；「重新生成」按该名称在 `optionMap` 反查 key
  （同名前取第一个匹配），找不到时回退默认模型——因此历史记录不因设置变更而失真。
- 新增 SQLite 域的五处同步清单：`schema/`（新表）+ `schema/index.ts`、`repo/`、
  `ipc/dbIpc.ts`、`preload/dbChannels.ts`、`preload/db.ts`、渲染侧 `types/db.d.ts`；
  表结构变更后需 `npx drizzle-kit generate` 生成迁移（`resources/drizzle/`），运行时 `migrate()` 自动应用。
- `status` 列用 `$type<ImageGenerateStatus>()` 声明字面量类型（drizzle text() 默认推断为 string，否则 select 返回无法赋值给 `ImageRecordInput`）。
- 连续生成交互：提交后输入框立即清空（失败可从失败记录卡「重试」找回 prompt）；生成按钮不受任务进行中影响，
  允许任意数量任务并行提交（进度由 pending 占位卡反馈）；「t-button loading 态会禁点」——不要把按钮 loading 绑到任务进行中状态。
- 跨路由切换：`useImageGenerations` 为模块级单例，状态与运行中任务存模块闭包（生产环境 keep-alive 白名单仅保活聊天页，
  文生图页切走即卸载）；请求不因页面卸载中断，重新进入 `init()` 拉最新列表即可看到进行中/已完成的最新状态；
  `init()` 的遗留 pending 收尾会排除 `runningIds` 中的任务，不会误标正在生成中的记录。
- 尺寸下拉支持自定义输入，校验 `^\d{3,4}[xX]\d{3,4}$`；提交格式统一小写 x。
- 弹窗遵循命令式 DrawerPlugin 约定：`.tsx` 外壳 + `.vue` 内容组件，`footer: false`，删除成功即关闭抽屉。
- 详情抽屉「复制图片」走 `inject.clipboard.copyImageByPath(path)`（`clipboard:copyImageByPath` 通道，main 侧
  `nativeImage.createFromPath`）——与既有 `copyImage`（base64/dataURL 语义，DataURL 走 `data:` 分支）区分，路径语义不引入歧义。
- 页面组件均遵循 `pages/` 纯 UI 分层，生图服务从具体文件路径 import（叶子模块，避免经过 chat 桶文件循环依赖）。