# docs/ 文档索引

> 本目录存放项目技术文档，供后续 AI 参考。 **请先读本文件**，按功能定位目标文档，无需逐个查看文件名。

## 索引

### app/ —— 应用外壳

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [AppSide.md](./app/AppSide.md)       | 侧边栏菜单（全局组件 `@/components/menu/`）：AppSide 外壳 + SideMenu/SideMenuNode 递归菜单、底部 UserMenu（`t-popup` 账号面板：会员/积分/登录登出）+ 设置侧栏全入口；外观三态「系统/浅色/深色」（`mode` 记录所选、`isDark` 为生效深浅）；主窗口与伙伴窗口共用 SideMenuItem 数据模型、active 推导、展开动画 |
| [01-app-shell.md](./app/01-app-shell.md) | 应用外壳生命周期：托盘常驻（显示 AI 窗口/打开伙伴/退出）+ AI 主窗口启动即建（默认隐藏/关闭只隐藏）、闪退修复（close 拦截只隐藏 + before-quit 放行真退出 + closed 置空引用）、AI 主窗口模块（createAiWindow/showAiWindow）、index.ts 仅生命周期编排 |
| [02-main-directory.md](./app/02-main-directory.md) | 主进程目录结构（域优先）：`app/`（aiWindow/tray）+ `server/`（本地事件服务）+ `modules/` 十一业务域（service+ipc 同域同居，与渲染层 modules/ 对称）+ `db/` 基础设施 + 顶层 registerIpc 聚合；import 规则、新增域方法、外部同步点（$ 别名/drizzle/`__dirname` 均不受影响） |
| [03-preload-directory.md](./app/03-preload-directory.md) | preload 目录结构（域优先，与 main 同构）：`modules/` 十三域（契约 `*Channels.ts` + 桥同域同居，域划分与 main modules/ 一一对应）+ `lib/` 纯 Node 桥 + 顶层 inject.ts 组装点；channels.ts 大杂烩/inject.ts 四合一拆解记录、三份契约同步关系 |
| [04-ffmpeg-ppt-removal.md](./app/04-ffmpeg-ppt-removal.md) | ffmpeg 与 PPT 专家功能移除记录（2026-09-04）：删除范围（基础设施/AI 工具/视频导出链/PPT 聊天类型）、保留项（画布动画字段、'ppt' 通用附件识别）、勿再引用符号清单 |
| [05-mac-dock.md](./app/05-mac-dock.md) | macOS Dock 跟随窗口可见性（2026-09-04）：任一窗口可见才显示 Dock、全隐即隐藏（纯托盘形态、托盘为唯一唤醒入口）、Dock 点击按可见性分流（仅伙伴可见→伙伴，否则→AI）、macDock.ts 注册表契约、accessory 焦点陷阱（ensure-before-show）、最小化不算隐藏 |
| [06-aihot-removal.md](./app/06-aihot-removal.md) | AIHOT 资讯功能整体移除记录（2026-09-05）：删除范围（页面 13 文件 / API 客户端 / 本地镜像服务 / 4 个 AI 工具 / DB 表 DROP 迁移 0010）、共享文件修改点、保留项（webview 能力与 LinkPreviewDrawer、存量白名单 id 不清理） |
| [07-auto-update.md](./app/07-auto-update.md) | 客户端自动更新：内置更新（electron-updater generic feed）+ 网盘模式（`/api/updates/latest` 下发链接、shell.openExternal 打开）、统一 Fluent 更新弹窗、系统设置检查/下载/重启安装、未打包环境跳过 |
| [08-chat-list-project-groups.md](./app/08-chat-list-project-groups.md) | 聊天列表项目分组（2026-09-12）：按聊天绑定的工作目录 `workspace`（创建时锁定）聚合、任务列表置顶+项目分组按最近活跃、分组头可折叠+hover「新建聊天」（`/new?workspace=` 预填，⚠️ 无预填传 undefined 防覆盖手选目录）、useChatGroups composable 拍平 rows 进 VList；09-13 工作空间合并口径：`useWorkspaceList` 单一数据源（聊天绑定 ∪ 目录历史、空分组置底）两侧同源 + 删除（面板条目/分组头右键，确认后连聊天级联删）+ 重命名（拍板仅改显示别名，localStorage `workspace-aliases`，目录路径不动） |

### server/ —— 本地事件服务

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [01-event-server.md](./server/01-event-server.md)             | 本地事件服务（express，127.0.0.1:47743 只绑回环）：`/file/<编码绝对路径>` 资源面（渲染层加载本地字体/图片，替代已删的 `mistrelle://` 自定义协议）+ `/buddy/event` 事件面（外部进程投递，platform/event 双白名单，词汇表见 hardware/05）+ `/ping` 探活；Origin 守卫防浏览器 drive-by 读盘；端口事实源 `@common/server/eventServer.ts` |

### auth/ —— 服务端账号

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [01-server-auth.md](./auth/01-server-auth.md)                 | 服务端账号接入（better-auth）：主进程 AuthService 单例共享状态 + 状态广播、API Key + 会话双存凭证（safeStorage 落盘）、Bearer 规避 CSRF、`/api/auth/*` 与 `/api/user/*` 契约、公开档位/增量包 SKU、登录弹窗与用户菜单接入；账户页布局见 setting/06 |
| [02-activation-and-features.md](./auth/02-activation-and-features.md) | 激活码与会员档位功能控制：verify/redeem 五层链路（redeem 后自动 refresh 广播；会员只决定每日赠送，增量包兑永久积分可重复买）、**「会员与积分」弹窗（档位/积分包 Tab 同级）行内规格按钮跳转 16688 商品页购买**（purchaseUrl 由服务端 offers 下发，客户端零硬编码域名）、AuthStore.features 门控（2026-09-12 口径：市场可见可浏览、手动新增自造免费且永久，付费仅市场下载 source='market' 断订隐藏 + AI 生成 + 自定义字体；AI 面过滤 + 渲染不拦） |

### ai/ —— AI 请求

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [01-ai-request-module.md](./ai/01-ai-request-module.md)       | AI 请求统一模块：替代 openai SDK（preload Node http 通道免疫 CORS）、三格式（chat/responses/anthropic）适配器、流式通道（preload 薄桥 + plugin/http.requestStream + 渲染层 SSE 分帧归一）、消费方改造 |
| [02-ai-agent-store.md](./ai/02-ai-agent-store.md)             | AI Agent 配置存储：`~/.mistrelle/agent.json`（`AiAgentService` 读写 + `AiAgentStore` 契约、内置 Agent 只读不落盘、**内置 Agent 会员门控**：免费档过滤 `builtin:design-style` 但 `getById` 保留历史会话、AuthStore 直连防环）；从 lmdb DbStorage 迁移，旧数据不迁移 |

### note/ —— 笔记

| 文档                                                        | 描述                                                                                                   |
|-------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| [01-note-module.md](./note/01-note-module.md)               | 项目笔记模块：`~/.mistrelle/project/{id}/notes`（并入项目，独立笔记已删）+ Obsidian 附件规范（a.md ↔ a.assets）、右键菜单增删改、tiptap 编辑器 + tab 多开 |

### plugin/ —— 插件基础设施

| 文档                                                           | 描述                                                                                             |
|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| [01-shell-exec.md](./plugin/01-shell-exec.md)                 | shell 执行插件：cliRun / jsRun 双层超时保障（底层 kill + 前端 IPC 挂起兜底）、超时契约与兼容性   |
| [02-quota-plugins.md](./plugin/02-quota-plugins.md)           | 额度插件体系（独立公共域，2026-09-07）：`src/main/src/buddy/quota/` 不依附任何设备（ESP32 LCD 经 quotaBus 订阅消费，未来更多硬件）；统一插件模型（内置预置可关闭 + `~/.mistrelle/buddy/plugins/` 第三方目录，definePlugin 契约、声明式 settings、独立配置 quota.json）；插件只管启停+settings，「屏显哪个额度」是设备侧自身配置（LCD 的 esp32-lcd.json `screenQuota` 键）——旧 quota `screen` 与快照 `main` 已废弃、条目带 `pluginKey` 供设备自挑；伙伴窗口「设置-额度配置」独立页面管理；内置随版本更新可关闭、目录替换文件即更新，为在线插件列表+版本化预留演进位；内置 deepseek 含「最大额度 maxQuota」设置（未设置时以当前余额为分母=圆环满格）；快照持久化 `lastSnapshot` 落盘 quota.json、启动恢复广播（首次启动不再空白），保存配置以内存快照为准 |

### migration/ —— 平台迁移

| 文档                                                                           | 描述                                                                                                                                                     |
|--------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| [01-electron-preload-migration.md](./migration/01-electron-preload-migration.md) | uTools → Electron 迁移：进程职责划分（特权操作进 main / 纯函数留 preload，例外：net 下载因 onDownloadProgress 回调无法过 IPC 而保留 preload）、IPC 通道表、lmdb 数据层（无 rev/附件）、ffmpeg 二进制随包分发（历史方案，2026-09 已随 ffmpeg 功能整体移除，见 app/04）、sharp 移植、renderer 异步化适配清单 |
| [03-lmdb-to-json.md](./migration/03-lmdb-to-json.md)                           | lmdb → 本地 JSON 收尾迁移：剩余消费点（network/global/secure/default setting、workspace 历史）映射与行为变化（rev 删除、不预写空文件、init 后注册 watch、孤儿 AiWorkspaceStore 直接删除）、lmdb 全链路删除清单、`~/.mistrelle/` JSON 存储全景 |

### data/ —— 数据存储

| 文档                                                        | 描述                                                                                 |
|-------------------------------------------------------------|--------------------------------------------------------------------------------------|
| [01-sqlite-storage.md](./data/01-sqlite-storage.md)         | SQLite 存储层：Drizzle + better-sqlite3（主进程持有全部 DB 逻辑）、DB 路径 `~/.mistrelle/db/mistrelle.db`、schema、IPC 领域方法契约、drizzle-kit 迁移流水线 + 资源目录规范、后续模块复用步骤；陷阱：复合列 onConflictDoUpdate 须先声明复合主键（chat_sub 0004 修复）、多语句 DDL 须带 statement-breakpoint、删表同样走 generate 产出 DROP 迁移（aihot 0010） |
| [02-chat-sqlite-migration.md](./data/02-chat-sqlite-migration.md) | 聊天域迁移 SQLite：chat/chat_content/chat_sub 三表、会话键路由（chat:{id}/sub:{chatId}:{subId}，项目任务保持文件）、记忆进度键改写、`test/migrate-chat-to-sqlite.mjs` 手动迁移脚本（--dry-run、删除范围=index.json+message/、保留 outputs） |

### browserTool/ —— 浏览器工具

| 文档                                                              | 描述                                                                                                                       |
|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| [01-browser-tool.md](./browserTool/01-browser-tool.md)            | 浏览器工具执行核心（browser_fetch / browser_actions 统一入口）：主进程一个方法 `browserTool:run`，载荷判别联合（fetch/actions），无 runner 子进程/无链式客户端；步骤表与 IPC 契约 |

### subscribe/ —— 订阅

| 文档                                                                  | 描述                                                                                                        |
|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| [01-subscribe-module.md](./subscribe/01-subscribe-module.md)           | 订阅模块：博主→视频订阅→详情三级、策略接口（自实现）、FunASR 转写（识别参数）、AI 总结流水线 |

### attachment/ —— 附件与预览

| 文档                                                          | 描述                                                                                                                          |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| [02-embedded-link-viewer.md](./attachment/02-embedded-link-viewer.md) | 内嵌网页浏览抽屉（公共组件 `LinkPreviewDrawer`，原 AihotLinkDrawer 提升）：链接出口统一走 `openLinkPreview` → DrawerPlugin + `<webview>`（webviewTag: true）；选型结论（vs WebContentsView）、UA 覆写防白屏、`persist:link-preview` 会话隔离、did-fail-load -3 忽略等注意事项 |
| [03-image-generate-page.md](./attachment/03-image-generate-page.md) | 文生图页面（`/attachment/image`）+ **主进程 ImageService**：生图编排与运行态上移 main（单例 Map、提交/轮询/落盘/收尾/广播，跨窗口跨刷新存活、启动 cleanupOrphans 收尾），渲染层只剩视图与 `image:*` IPC 薄代理；**只调自有服务端** `/api/images/*`（Result + camelCase，统一异步任务模型；公开 models / 登录 priced 含积分），模型列表=`ImageModelStore`（未登录也可看档位，登录后展示积分，生成需登录），`defaultImageModel` 语义为服务端档位、仍是工具门控与表单默认来源；`image_generate` 工具走 `record:false` 直出模式（不进页面历史）；`db:image:*` 通道删除、`db:image:list` 迁 `image:list`；`task_id`/`poll_max_at`/`task_terminal` 续轮询语义不变（确认即落库、按剩余窗口续查、不重复扣费）；设计风格仍在渲染层拼 prompt；`defaultImageModel` 仍为表单默认与工具首选档位来源（工具门控已改登录态，见 tool/12）；**2026-09-10 参数面对齐服务端**：新增 n（1-4 单记录多图，迁移 0011 `images` JSON 列、path=第一张快照）/resolution（1k/2k/4k）/quality/background/outputFormat/outputCompression/moderation/nsfwCheck/imageUrls（参考图=图生图，本地路径 main 归一化 data URI），未设置参数不透传、size 缺省不再强制 1024x1024；表单拆 ImageReferencePicker/ImageAdvancedOptions，记录卡拆 ImageRecordCard，详情多图画廊 ImageDetailGallery 与预览器联动 |
| [04-file-preview-dialog.md](./attachment/04-file-preview-dialog.md) | 文件预览弹窗（公共组件 `FilePreviewDialog`，原 chat-assistant/modals 提升并按约定拆外壳+内容）：`FilePreviewItem` 契约与分发（url→链接抽屉 / md / **html、htm→webview 渲染预览** / code / image / video / audio / showInFolder 兜底）；本地资源经本地事件服务 HTTP `/file` 面加载（见 server/01），MIME 表含 text/html 等 |

### extend/ —— 闲庭漫步工具页

| 文档                                                          | 描述                                                                                                                          |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| [01-model-health-tool.md](./extend/01-model-health-tool.md) | 可用性检测工具（`/attachment/test`，参考 aibase llm-health）：已配置模型一键选择（含禁用项）自动填充 / 5 维度 12 检测项（基础 4 / 完整 12，共享观测降成本、30s 超时、connect 失败级联跳过）；`model_health` 表 + `db:health:*` IPC；渲染层执行（复用 modules/ai 三格式适配器）+ 模块级单例 composable 单任务锁 + keep-alive（`ExtendTestPage`）切页不中断；逐项落库累积、孤儿 running 收尾；审计报告 = EJS 模板（`resources/templates/`，主进程 templateRender 统一渲染服务 + `template:render` 通道，新域模板可复用）动态生成不落库，抽屉导出 HTML 走 dialog.save 用户自选路径（2026-08-26 起不再落固定目录）；API 密钥不落库 |
| [02-model-compare-tool.md](./extend/02-model-compare-tool.md) | 模型对比检测工具（`/attachment/compare`）：2-6 模型横向对比（速度 TTFT/tokS 中位数、题集判分、身份自述、一致性、usage 计量），三种执行模式（默认混合=速度轮串行+其余并发）、in-flight 水位标注评估并发影响；**题库 `compare_question` 表 + 记录 `model_compare` 表**（标量+JSON 文本列、分页；2026-08-26 由文件 json 迁库防手改出错）+ md 报告**手动导出**（dialog.save 自选路径，EJS 模板 `<%- %>` 例外）；题目编辑 DialogPlugin 命令式；t-table 动态列 cell 渲染函数（TNode 首参 h、:deep 样式）；keep-alive `ExtendComparePage`；无偏好持久化 |

### canvas/ —— 画布

| 文档                                                                    | 描述                                                                                               |
|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| [02-canvas-node-model.md](./canvas/02-canvas-node-model.md)             | 画布节点模型与批量编辑（v2）：图层树 + 区域分组、`canvas_batch_edit`、调色板 token、内置设计 skill；`canvas_guidelines("styles")` 动态风格目录；场景指南结构含文案容量/安全区/翻车点；**09-22**：image 节点新增非破坏 `mosaic` 字段（遮盖记录），渲染附加层统一走 `buildNodeWithExtras` |
| [03-canvas-animation.md](./canvas/03-canvas-animation.md) | 画布动画（v3）：`CanvasAnimation` 声明式动画字段、`@leafer-in/animate` 透传与预览自动播放、PNG 导出 settle；原随附视频导出已随 ffmpeg 移除（见 app/04） |
| [04-canvas-element-tree.md](./canvas/04-canvas-element-tree.md)         | 画布元素树：设计侧边栏全屏左栏，`selectedId` 驱动元素树 ↔ 画布双向选中联动                      |
| [05-canvas-property-panel.md](./canvas/05-canvas-property-panel.md)     | 画布元素属性面板：全屏三栏第三栏，本地草稿 +「保存」按钮显式写回（batchEdit update，与 AI 同链路）+ **删除元素按钮**（batchEdit delete + 清选中）；x/y 禁改、渐变/$token/布局关键字降级策略、按类型字段矩阵；**09-21 二次调整**：马赛克已改为工具栏入口的抽屉弹窗，面板恢复为 `design-aside__body` 的 flex row 直接子项（`design-aside__right` 纵向容器与 `:deep` 高度补丁已撤）；**09-22**：image 节点新增「遮盖」区块（`ImageMosaicFields.vue`：摘要 + 编辑 + 复原，即时写回不走草稿） |
| [06-canvas-psd-export.md](./canvas/06-canvas-psd-export.md)             | 画布导出分层 PSD（2026-09-12）：ag-psd + 逐图层位图化（叶子光栅化、group→图层组、带效果组拍平）、`canvas_export` format=psd 与侧边栏「下载 PSD」入口、混合模式映射表、已知限制（文本/矢量烘焙进位图；**09-22** 图片遮盖随宿主图层烘焙，导出即遮盖后视觉） |
| [07-canvas-mosaic.md](./canvas/07-canvas-mosaic.md) | 图片遮盖（马赛克 / 毛玻璃，2026-09-22 **三次重构＝非破坏模型**）：遮盖区域与参数记录在 image 节点 `mosaic` 字段（`imageUrl` 始终是原图，删除字段即无损复原），渲染层生成透明**叠加位图**实时叠加（`mosaicOverlay` 预热 + 同步缓存、几何与图片元素逐字段一致保对齐、`hittable:false` 隔离交互、PNG/PSD 导出自动带遮盖）；区域用轮廓点（矩形 / OCR 四点四边形 / 涂抹网格矩形）；弹窗编辑（`MosaicEntryButton` + `useMosaicTarget` + `modals/MosaicDialog.tsx/.vue` + `useMosaicEditor` + `mosaicMarks`）支持文字识别勾选 / 框选 / 涂抹 / **擦除**、马赛克块边长与毛玻璃模糊半径可调、**打开即回填**（可局部增删）、应用零文件产出；入口改为「优先选中 image 节点，未选中退回画布唯一图片」（多图不再一律禁用）；属性面板提供摘要 + 编辑 + 复原；旧烘焙链路（`-mosaic-*.png`）仅保留给画布外独立文件（`-mask-*.png`） |

### design/ —— 设计风格

| 文档                                                          | 描述                                                                                                      |
|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| [01-design-style.md](./design/01-design-style.md)             | 设计风格模块：落盘契约、**8 套本地内置预设**（2 产品 UI + 各类各 1；更多走在线库）、配方字段（aliases / signature / whitespaceRatio / preferredFormats / suitableFor）、tokens + 提示词注入签名手法 |
| [02-design-style-chat.md](./design/02-design-style-chat.md)   | 设计风格接入 design 聊天：`designStyleId` 创建后锁定、风格转提示词注入稳定 system 前缀、聊天室工作空间/风格只读展示、列表缓存详情不缓存 |
| [03-design-style-agent.md](./design/03-design-style-agent.md) | 设计风格创建助手：工具 schema 含签名手法等配方字段；create 强调 signature 必写；**会员门控**（AI 生成=会员：免费档隐藏 agent、getById 保留历史会话；手动新增免费） |
| [04-chart-tool.md](./design/04-chart-tool.md)                 | 图表工具：`chart_generate`（echarts option → SVG 落盘沙盒 → svg 节点 imageUrl 引用，支持全部内置图表）+ `renderChartOptionToSVG` SSR 渲染助手；集成形式调研（leafer 无 SVG 元素、SVG 渲染器 SSR、落盘而非内联的取舍） |
| [05-style-preview.md](./design/05-style-preview.md)           | 风格预览所见即所得：`AiDesignStyleItem` 索引项扩展 typography/tokens/whitespaceRatio（旧数据读取兜底）、`StyleCardFace` 按规范整卡渲染（`--sp-*` 变量换算、留白密度、对比度文字色）、列表卡壳 + 面与详情大样张；**全局风格下拉组件 `StyleSelect`**（t-select 分组 + 选项悬浮 StyleCardFace 预览 + 非会员锁定，PageNew 与文生图表单共用，自带 overlay 全局样式） |
| [06-card-style.md](./design/06-card-style.md)                 | 卡片风格与 Markdown 卡片（2026-09-06 三层模型）：**白名单属性注册表**（快捷层，CSS/表单/AI 提示词全派生）+ **自由层 template/css**（HTML 模板 data-nc 插槽契约 + 自定义 CSS，含清洗规则；信纸横线/纸纹/装饰可行）、7 套内置预设（含自由层示范「苹果备忘录」）、管理页（/design/card 全抽屉 + 模板编辑区）、**Markdown 卡片主页面**（/attachment/card：左 Markdown 源码编辑 + 右实时预览，经 NoteCardRenderer iframe 富渲染 + 实测分页 + snapdom 导出）、内置专家「卡片风格创建助手」（cardStyleTools 含 template/css 参数，extendedCardStyles 门控 AI 生成，手动新增免费；ChatType 'card' 已删）、会员键 `extendedCardStyles`（服务端暂未返回） |
| [07-design-html-engine.md](./design/07-design-html-engine.md) | 设计创意 HTML 引擎（2026-09-06）：design 类型 **DesignScene 子引擎分层**（canvas/html，创建时选定后锁定、存量缺省 canvas、子 Agent 恒为 canvas）、ChatTypeConfig 按 `DESIGN_SCENE_CONFIG` 委托两份独立提示词与工具、`modules/designHtml/` 数据层（纯 HTML 文件 + `<html data-design-*>` 元信息、sanitizeDesignHtml 清洗、图片 dataURL 解析、snapdom 导出 PNG）、`html_*` 工具面（html_write 全量重写编辑模型 + html_guidelines 白名单复用）、专有侧边栏 HtmlDesignAside/HtmlDesignPreview（iframe 预览 + contain 缩放）、**元素选中与修改**（双击蓝框选中 + contentWindow 挂事件 + body 索引路径定位 + 滚轮升降级 + 全屏元素树 + 双击注入聊天镜像画布引用链） |
| [08-canvas-picker-and-uploads.md](./design/08-canvas-picker-and-uploads.md) | 画布选择面板与图片上传（2026-09-21）：DesignAside 弃 t-select 改 **CanvasFilePicker 自绘触发器 + t-popup 悬浮面板（单一混排列表）**、**上传图片即建画布**（拷入 outputs/uploads/ + 创建 `source='upload'` 引用画布、图片节点铺满、点击即在主画布显示；可删除连带源文件、不可归档）、**画布归档**（outputs/archived/ 文件移动、refreshFiles 双扫但返回值仍只活跃列表故 AI 工具零改动、create 版本号全量 max+1 防覆盖、归档当前画布必须关 current）、CanvasStore 拆出 canvasDocOps 贴行数红线 |

### chat/ —— 对话

| 文档                                                                | 描述                                                                              |
|---------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| [01-thinking-mode.md](./chat/01-thinking-mode.md)                   | DeepSeek 思考模式：`thinking` / `reasoning_effort` 参数、扁平字段设计、思维链渲染（**2026-09-14：思考块一律默认折叠**，含流式中）、`delta.reasoning` 网关兼容、工具轮次 `reasoning_content` 强制回传契约（缺失补空串防 400） |
| [02-chat-locator.md](./chat/02-chat-locator.md)                     | 对话侧边定位器（RChatList Locator）：仅用户消息展示、tooltip 预览前 10 字         |
| [03-canvas-node-reference.md](./chat/03-canvas-node-reference.md)   | 画布节点引用：双击节点 → 输入框 canvasMention → `CanvasContent` 结构化注入        |
| [04-chat-session-lifecycle.md](./chat/04-chat-session-lifecycle.md) | 会话生命周期与空闲自动回收：挂载/运行豁免、5 分钟 TTL 过期销毁、回收后磁盘水合    |
| [05-todo-progress.md](./chat/05-todo-progress.md)                   | 待办进度按钮：头部圆环 +「第 X / N 步」、t-popup 弹层复用 TodoList、空待办隐藏    |
| [06-token-usage.md](./chat/06-token-usage.md)                       | Token 用量与上下文占用：API usage 记录、四类构成估算+归一化、发送栏圆环 + 弹窗明细 |
| [07-chat-process-fold.md](./chat/07-chat-process-fold.md)           | 助理消息过程折叠：完成 + 有过程内容即可折叠、无最终回复时折叠条 +「异常停止」提示、record_memory 收尾时上下两段文本都保留（兼容结论放上/放下，收尾 thinking 不计继续干活） |
| [08-new-page-keep-alive.md](./chat/08-new-page-keep-alive.md)       | 新建聊天页 keep-alive 保活：router-view 外套 keep-alive 缓存 /new 页（组件名 PageNew），发送后重置全部表单数据 |
| [09-user-message-expand.md](./chat/09-user-message-expand.md)       | 用户消息折叠 / 展开：限高 3 行 + 底部 backdrop-filter 渐变模糊、模糊区中央向下箭头展开 / 展开后居中向上箭头收起；图片附件 hover 用 t-popup+t-image 预览，点击标签在文件夹中显示 |
| [10-ai-workspace.md](./chat/10-ai-workspace.md)                     | AiWorkspace 工作目录选择器：非只读 dropdown 选择/清除/历史，只读锁定态点击 shell.openPath 打开目录（cursor default 无动画） |
| [11-stream-retry.md](./chat/11-stream-retry.md)                     | 流式请求自动重试：agent 层指数退避（2s→4s→8s，默认 3 次）、失败清半截内容防重复、`ext.retryKey` 提示块随消息持久化；流完整性校验（无 finish_reason 截断/0 帧抛可重试错、abort 转 cancelled、tool_calls 零增量抛错）；4xx（含 axios「status code 403」空壳）不重试 |
| [12-agent-context-compaction.md](./chat/12-agent-context-compaction.md) | 历史工具上下文紧凑化：请求构建时按 `toolContextRules` 注册表处理历史——写类同资源仅保留最后一次成功写完整原文、其余（含失败写）整对剔除，读类同资源仅保留最新（写入使旧读过期），仅历史消息生效、持久化原文不动；含两轮「args 中间态被模型复读」故障记录（占位串、删字段后的 `{}`，args 侧禁止任何改写） |
| [13-vision-image-passing.md](./chat/13-vision-image-passing.md)     | 模型识图：`AiModel.support` 能力位（独立 type）+ 弹窗 CheckboxGroup + 预设标注；请求构建时从磁盘路径重建图像块（全部历史保留），三格式适配器映射 `image_url` / `input_image` / anthropic source |
| [14-send-scroll-to-bottom.md](./chat/14-send-scroll-to-bottom.md)   | 发送消息后滚动到底部：watch「列表增长且新末条为 user」+ ChatList expose 的 scrollToBottom（smooth），复位 tdesign 上滚暂停的自动跟随；user 消息异步追加故不挂 send 事件 |
| [15-interactive-confirm-visibility.md](./chat/15-interactive-confirm-visibility.md) | 挂起确认的可见性与「停止≠拒绝」：confirm 卡片被超长结果推出视口致 agent 静默阻塞等批准的事故复盘；RChatList 顶部横幅+视口外自动滚动定位卡片（data-tool-call-id 锚点）、clear() 产生的 null 与用户拒绝分开文案、isSkillScriptCall 整串 command 的 token 级放行 |
| [16-privacy-chat.md](./chat/16-privacy-chat.md)                     | 隐私聊天（创建后锁定）：chat 表 privacy 列（唯一写入口 AiChatStore.add）、不注入记忆 / 不注册 record_memory（含子 Agent 继承）、提取跳过但推进进度、聊天室开关禁用（lock-privacy）、引擎标题「私」tag |
| [17-tool-phase-lifecycle.md](./chat/17-tool-phase-lifecycle.md)     | 工具调用四态生命周期：`ToolPhase`（pending/confirm/executing/complete/stop）块级单一事实源、`setAssistantStatus` 连坐事故复盘（审批卡消失 + DB complete/UI 执行中悬案同根因）、`toolPhaseOf` 历史旧值归一、UI 纯状态驱动（撤 effectiveStatus 覆盖与探针）、AgentChat 拆分五模块（1052→445 行） |
| [18-agent-image-read.md](./chat/18-agent-image-read.md)             | Agent 主动读图：`image_read` 工具（识图模型下发、safe 免审批）+ `visionImages` 约定键（剥离后路径落 toolcall ext）；工具结果消息不支持图像块，请求构建时以「紧随 tool 消息的 user 消息」注入（适配器零改动）；contextRules 读类过期使同路径旧图不重注入、用户附件同路径去重 |
| [19-scene-registry-refactor.md](./chat/19-scene-registry-refactor.md) | **Agent 场景注册表重构（2026-09-15）**：三层架构（AgentRuntime 引擎契约 / SceneDefinition 场景注册表 / PromptContribution 注入管线）；`global/ChatTypeConfig.ts` 删除、场景四件套（prompt+skills+tools+aside）自包含、`resolveScene` 无 default 穷尽解析、UI 七处静默分支清零（LChatAside 动态组件 / PageNew / ChatList / 沙盒 / 个性化作用域）、场景内置 skill 与 load_skill 解析链、死代码清理（enableSkill / getType / getWritingScene / WritingAside.vue）；**含「新增场景操作指南」与旧→新对照表** |
| [20-chat-components-relocation.md](./chat/20-chat-components-relocation.md) | **chat 组件树迁出全局组件目录（2026-09-15）**：`src/components/chat/` → `windows/main/components/chat/`（新建窗口级组件目录），退出 unplugin-vue-components 自动导入、全部显式 import（含原靠自动导入的 9 处补齐）、components.d.ts 60 条 chat 条目清理；tdesign 走 resolver 不受影响 |
| [21-new-page-segmented-control.md](./chat/21-new-page-segmented-control.md) | **新建页场景选择器（SegmentedControl，2026-09-16）**：通用分段选择器 + PageNew 一级家族 / 二级子场景用途；选中态唯一来源是绝对定位滑块（深色主题更暗、浅色更亮）；**事故复盘**——二级选项在写作↔设计间整体替换而组件实例复用，`v-for` 数组模板引用失同步致滑块塌缩 `width:0`、选中反转；修复=改查真实 DOM + `watch(flush:'post')`/`onMounted`/`ResizeObserver` 重测 + 去重重复 `id` |

### memory/ —— 记忆

| 文档                                                          | 描述                                                                                                    |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| [01-memory-system.md](./memory/01-memory-system.md)           | 记忆系统（`~/.mistrelle/soul/`）：短期记忆空闲防抖提取 + `record_memory` 主动记录 + 设置页手动立即提取 → 每日 LLM 合并长期记忆（JSON 协议 + 分节字数预算合计 4000 字、解析失败保底重试、覆写前 .bak 备份，合并前兜底补提）→ 主 Agent 独立 system 消息注入；state.json 提取进度与合并边界语义（下一个待消费日期，含边界）、首启基线不回溯、合并成功记录上次合并时间；模型配置见 [setting/08](./setting/08-memory-setting-page.md) |

### personalize/ —— 个性化

| 文档                                                                  | 描述                                                                                                                             |
|-----------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| [01-personalize-module.md](./personalize/01-personalize-module.md)     | 个性化系统（`soul/*.md` 五文件）：IDENTITY / DESIGN / WRITE / AGENT / USER 按 scope 注入主 Agent 稳定前缀（design / writing 类型过滤）、`PERSONALIZE_FILE_CONFIG` 单一数据源、mtime 缓存、设置页 t-tabs 编辑器 |

### setting/ —— 设置

| 文档                                                   | 描述                                                                                          |
|--------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| [01-ai-model-fetch.md](./setting/01-ai-model-fetch.md) | AI 设置「从接口获取模型」抽屉：`FetchModelsDrawer` 命令式外壳 + `FetchModelsContent` 内容组件；内置模型上下文表（`aiModelPresets.ts`）自动维护 `context` / `output` |
| [02-ai-model-store.md](./setting/02-ai-model-store.md) | AI 模型配置存储：`~/.mistrelle/model.json`（`ModelService` 读写 + `SettingAiStore` 契约）；提供方 `enable` 与 sortablejs 拖拽排序 |
| [03-window-glass-titlebar.md](./setting/03-window-glass-titlebar.md) | 窗口配置：三平台隐藏标题栏（macOS hiddenInset + trafficLightPosition 下移交通灯 / 其他 titleBarOverlay）+ 系统级毛玻璃（vibrancy / acrylic）；毛玻璃需透明背景才可见；useTitlePadding 跨平台标题边距（macOS 左避交通灯 / Windows 右避 overlay，**l2 按窗口形态取值**：main 收起+新建两按钮 / buddy 收起单按钮，l1/l3/r1 数值推导与消费方） |
| [04-account-store.md](./setting/04-account-store.md) | 账户配置存储：`~/.mistrelle/account.json`（`SettingAccountService` 读写 + safeStorage 整文件加密，含明文降级）；Store 契约 `state` + 三个鉴权配置不变 |
| [05-ai-provider-builtin-relay.md](./setting/05-ai-provider-builtin-relay.md) | AI 设置内置供应商（服务端中转站）：主进程 relay IPC 代理 `/v1/models` + `/v1/chat/completions`；透传 `session_id`（渠道亲和）与 `request_id`（仅记录）；流式回调走 start/chunk/end 事件；第三方 key 免登录、登录只保护内置中转刷新 |
| [06-account-page.md](./setting/06-account-page.md) | 账号设置页 Fluent 布局：身份主视觉（可用积分 / 每日赠送）+ 账户与安全（我的会员与我的积分分开，增量包挂在会员下）+ 第三方密钥；进入页 1 分钟节流刷新；积分流水抽屉；档位页收敛入口 + 增量包选择/结算（永久有效，无支付） |
| [07-ai-setting-page.md](./setting/07-ai-setting-page.md) | AI 设置页 Fluent 布局 + 单向数据流：编排层只传 source 快照；ProviderEditor 本地 draft；ProviderModelList 共用；侧栏 Accent 选中条；修复 form 整表替换后模型操作打到孤儿数组 |
| [08-memory-setting-page.md](./setting/08-memory-setting-page.md) | 记忆设置页 Fluent 布局：概览主视觉（开关 + 长期字数/短期天数/上次整理）+ 分组卡（记忆模型 / 立即提取 / 立即整理 / 长期记忆编辑 / 每日查看删除）；「默认总结模型」从「智能体设置」迁入本页更名「记忆模型」（字段名 `defaultSummaryModel` 不变、**去掉快速模型兜底**）；已启用但未配置时顶部 t-alert 告警 + 两个动作按钮真实门控 |
| [09-network-app-axios.md](./setting/09-network-app-axios.md) | 网络设置迁 main + 通用 axios 客户端（2026-09-21）：设置数据家迁 `networkSetting.ts`（内存缓存 + 写时刷新：唯一写入口落盘即更新缓存，读零磁盘 IO；渲染层 store IPC 化 UI 零改动）；main 六出口（Auth/Relay/Image/updater 检查/quota 插件/gzhTrends）收口 `appAxios`（请求拦截器注入代理/超时/TLS/UA，显式值不覆盖）；代理用 https-proxy-agent + socks-proxy-agent（axios 原生 proxy 对 https 不做 CONNECT、socks 无效）；死配置 `ignoreTlsCertError`/`readTimeout` 已激活（⚠️ socks5 通道不透出 rejectUnauthorized）；gzhTrends 保留 no-SNI 裸握手兜底；**未收口**：渲染层三桥（二期）、electron-updater/browser_fetch（Chromium 栈） |

### skill/ —— 本地 Skill

| 文档                                                     | 描述                                                                                                            |
|----------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| [01-skill-enable.md](./skill/01-skill-enable.md)         | Skill 启用/禁用：`~/.mistrelle/setting/skill.json` 仅记录禁用项（key=`agentKey/dirName`，缺省即启用）；禁用=仅不默认注入 `<available_skills>` 目录（唯一过滤点），`/` 提及仍可显式指定并标注「已禁用」、`load_skill` 不拦截；列表项右上角 t-switch + 三态筛选（全部/已启用/已禁用）；孤儿 key 继承语义 |

### subagent/ —— 子 Agent

| 文档                                                      | 描述                                                                               |
|-----------------------------------------------------------|------------------------------------------------------------------------------------|
| [01-subagent-module.md](./subagent/01-subagent-module.md) | 子 Agent 模块：能力类型 × 聊天类型矩阵、research / **image（生图型，2026-09-14）** 两类、**仅场景工具型封闭能力面**（`isSceneToolsOnlyAgent` → 只注入专用工具集、关渐进装载与 toolRegistry 兜底、不注入 skill/todo 指导）、`denyOnAsk` 需审批即自动拒绝、模块结构与运行流程；**2026-09-14 精简**：删除 design 型子 Agent 与 `policy.ts`/`sceneType` 链路、底部 Agent tab 栏移除，子 Agent 聊天记录改在右侧侧栏（`SubAgentAside` + `SubAgentSession` 精简会话视图、X 关闭回正常侧栏、主区恒为主 Agent）、修正 `collectSubAgents` 类型收窄漏 `image` |

### tool/ —— 工具

| 文档                                                    | 描述                                                                                                              |
|---------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| [01-browser-selector.md](./tool/01-browser-selector.md) | 浏览器工具 CSS 选择器提取：`browser_fetch` / `browser_actions` 可选 selector 参数、空结果防护                     |
| [02-asset-tools.md](./tool/02-asset-tools.md)           | 设计素材工具：`website_logo` / `icon_svg` 获取真实素材，来源打分降序尝试                                          |
| [03-font-tools.md](./tool/03-font-tools.md)             | 字体工具与渲染：`font_list` 查询 + `font_pick` 交互选字（推荐 + 全部预览）、系统 / 资源库三态统一契约、五维分类元数据（启发式推断 + 用户持久化，资源库/系统缓存均支持编辑过滤）；字体入库由资源管理页完成（不暴露 AI 工具） |
| [04-image-tools.md](./tool/04-image-tools.md)           | 图片工具四件套：`image_generate`（接口自适应）+ `image_crop` 本地切分 + `image_remove_background` flood fill 去白底（生图不支持真透明）+ `image_color_map` 网格主色 + LAB 感知色差突兀区域检测 |
| [05-file-tools.md](./tool/05-file-tools.md)             | 文件系统工具：`file_read` 主进程流式按行分页（默认 500 行/页，nextOffset/totalLines 翻页，110KB 行预算防 128KB 截断）、`file_stat` 基于 fs.stat 返回权威文件信息、`file_glob` / `file_grep` 主进程递归搜索（glob 匹配 + 内容正则，内置忽略目录与结果上限）；`image_info` 已迁 design 场景工具集、`file_exists` 已删（被 file_stat 覆盖）           |
| [06-ego-browser-tools.md](./tool/06-ego-browser-tools.md) | ego-browser 工具：`ego_browser_run` 免审批包装 CLI（nodejs 子命令经 stdin 通道传 script，其余子命令 args 透传）、`ego_browser_exist` 只读探测安装状态；可执行文件路径解析（runtime.egoBrowser 配置 → 平台默认推断 → PATH 兜底）；经「浏览器」可选分组注入（不常驻）；`cliRun` 新增 `stdin` 选项 |
| [07-tool-policy.md](./tool/07-tool-policy.md)           | 工具安全策略注册与模块循环依赖约束：`registerToolPolicy` / `resolveToolPolicy` 机制、TDZ 崩溃根因（toolPolicy import 闭包拉入 chat/store 全量图）与修复（import 叶子化）、后续新增策略的约束；2026-08 升级：聊天级目录白名单（确认卡片勾选「此目录以后都允许」→ `AiChatContent.allowedDirs`，仅本聊天）、skill 根目录脚本免审批（`ctx.skillRootDirs` 注入）、可信区内 cwd 命令免审批（不依赖沙箱开关）；2026-09 升级 2：`denyOnAsk`（子 Agent 无审批通道时 ask → 自动拒绝，文案与「用户拒绝」区分） |
| [08-search-tools.md](./tool/08-search-tools.md)         | 搜索工具：`getDefaultTools()` 动态组装；`zhihu_search` 仅配置 Access Secret 时注入 + `any_search` 可匿名；账号设置知乎项与鉴权头 |
| [10-default-tools-slimming.md](./tool/10-default-tools-slimming.md) | 默认工具精简（28→20）：shell 只留 cli_run（js/python/node/git_run 彻底删+死配置清理）、浏览器只留 browser_fetch（ego 移可选）、file_exists/read_skill_file 删除（被 file_stat/file_read 覆盖）、file_write_xlsx 移「文档处理」可选组、image_info 迁 design 场景注入；历史兼容按名集合保留清单 |
| [11-progressive-tool-collection.md](./tool/11-progressive-tool-collection.md) | 渐进式工具加载：`ToolGroup` 增加 id/description、`<available_tool_collections>` 目录 + `load_tool_collection(ids)` 整组装载、洋葱式三层解析（内置→已装载→全局 toolRegistry 兜底，命中即自动复装实现跨 Loop 恢复）、beginRequest 每轮清空不落库；并行审批 UI（待审块均可作答 + 横幅计数定位）；真问题是能力自助化而非省 token |
| [12-chat-image-generate.md](./tool/12-chat-image-generate.md) | 通用生图对话直出：`image_generate` 升级为唯一通用工具（office + design 双引擎共用，生成图一律作为 `image` 内容块展示在对话中）、执行器 `chatImages` 标记约定（回填 image 块 + 剥离标记）、`hasImageGenerateAccess()` 登录门控（替代默认生图模型门控，4 处统一）、RChatImage 渲染组件 + 折叠白名单保留图片块；**2026-09-14：`model` 档位参数（AI 按用途自选，动态列出可选 code）+ 生图型子 Agent 成为文章配图专用通道** |
| [13-humanize-tool.md](./tool/13-humanize-tool.md) | `humanize_text` 文案去 AI 味工具（design 双引擎，登录门控）：流式客户端从写作组件目录下沉到 `modules/ai/humanize.ts`（写作侧边栏与工具共用）、工具 `risk: safe` 直接放行、提示词 `hasHumanize` 同源门控、只返回文本不落盘 |
| [14-design-draw.md](./tool/14-design-draw.md) | `design_draw` 画布绘图工具（2026-09-14）：参数对齐生图接口（prompt / path / size），内部驱动**工具面封闭**的「设计创意画布 agent」逐层构建并导出 PNG、产物以 `image` 块直出——定位「比扩散生图高一档：无 AI 感、文案版式精确可控」；**四层安全纵深**（`closedToolSurface` 物理封闭工具面 + 维持 `denyOnAsk` 所有 ask 自动拒绝 + 既有策略零放宽 + 外层路径感知策略）、不注册 `toolMap`（防 registry 兜底把工具泄漏到未注入场景）、office/writing 注入且不门控登录 |
| [15-ask-tool.md](./tool/15-ask-tool.md) | `ask` 询问用户工具全链路（schema → InteractiveBridge → 问答卡片 → formatAskResult）：单/多问题形态、**2026-09-15 多选支持**（问题级 `multiple: true`，checkbox 渲染，答案「、」连接）、option key 归一化防「整组串选」bug（漏 key → `undefined === undefined` 全亮，`normalizeAskArgs` 统一兜底）、resolve 协议 `string[]`（label 文本非 key）与 `ext.askItems` 结果卡片 |
| [16-ocr-mosaic-tools.md](./tool/16-ocr-mosaic-tools.md) | OCR 识别与图片遮盖工具（2026-09-21 落地，09-22 扩展）：`@arcships/light-ocr`（PP-OCRv6 离线原生引擎，engine 懒加载单例 + will-quit 释放、四点 box→包围盒 + **轮廓点 points**、pageSpace 坐标契约无需 y 翻转）的 `ocr_image`（safe）与 `image_mosaic`（sensitive + 路径感知 policy）；**09-22**：`image_mosaic` 画布内图片改为**非破坏记录**（写节点 `mosaic` 字段，`regions: []` = 复原，零文件产出），画布外独立文件仍烘焙（`{base}-mask-{时间戳}.png`）；`sharpMosaic` → `sharpMask`（`sharp:mask` 通道，按 `style` 生成底图：马赛克粗化 / 毛玻璃 `blur(sigma)`，掩码 raw 替换不变），常量与取值范围移到 `src/common/types/mosaic.ts` 三端共用；契约放 preload 侧 main 共用（sharp 模块同款） |

### writing/ —— 写作

| 文档                                                           | 描述                                                                                   |
|----------------------------------------------------------------|----------------------------------------------------------------------------------------|
| [01-writing-scene.md](./writing/01-writing-scene.md)           | 写作子场景（WritingScene）：大类型管框架、子场景管能力，场景 article / novelShort；**场景能力面收窄（`excludedTools` / `subAgentAllow`，请求侧+执行期两层过滤）**       |
| [02-article-data-layer.md](./writing/02-article-data-layer.md) | 文章数据层与工具（schema=2）：一篇文章×多类型（发布平台由 AI 自由命名），各类型独立版本；**「标题+类型+版本」=唯一单元、版本 id 即单元标识**（article_create 返回 id，write/read/stats/update/remove 只认 id，新版本返回新 id；`ArticleVersion.no` 显式版本号）；status 字段已删除、旧结构不迁移；**2026-09-14：配图双通道（design_draw 画布绘制 / spawn_agent(type=image) 扩散生图）且定稿后必配、生产前未指定方式时先 `ask` 征询；场景提示词改工厂 `buildArticleScenePrompt()`（配图段落随登录态组装，未登录收窄为仅画布绘制）** |
| [03-article-aside.md](./writing/03-article-aside.md)           | 文章侧边栏（以文档为中心的写作工作台）：一聊天一文档恒可编辑、标题下拉切换 + **标题在 ⓘ 面板内可直接编辑（t-input，失焦/回车提交、IME 组合态不提交、空值不提交回滚；推翻旧「标题仅 AI 可改」拍板）**、类型下拉切换（AI 专属设定）、简介/提纲信息下拉面板（只读）、**双刷新语义（2026-09-21）：头部 ⟳「重新读取」= 以磁盘为准重读正文 + 递增 `imageRev` 让图片 URL 换新防缓存（`ArticleImage` 派生属性 + `#rev=N`），标题下拉 footer「刷新文章列表」= 重读 project.json 索引让新增/删除文章浮现**、AI 写完自动呈现（article_write→contentRevs + mtime 轮询兜底）、版本时间线（显式 no）、重写入口收敛到聊天（AI 重写按钮已删）、插图/生图直插正文、**插图生图以选中文字为前提（未选中禁用+tooltip 引导，插入不吞选中文字）**、**生图弹窗 AI 代写英文描述（按标题/摘要/提纲 + 选中文字起草，可换一版）**、**封面悬浮框「复制图片」（copyImageByPath 把图片本体写入剪贴板，可直粘）+「文件夹」（showItemInFolder 定位封面文件）**、底部复制正文；**底部动作条（2026-09-21 重构）：仅「去 AI 味/停止」常驻，「AI 检测/复制/文件夹/版本对比」收进「更多」分组下拉（内容/文件/版本三段）+ 预留 #extra 插槽（gzh 注入排版预览/正文质检入口）** |
| [04-image-export.md](./writing/04-image-export.md)             | md 图片引用：相对路径约定、`imageRef.ts` 解析与资产复制（zip 导出已删除）                     |
| [05-novel-short-scene.md](./writing/05-novel-short-scene.md)   | 短篇小说场景（**2026-09-14 工具面收窄 + 写作工作台**）：每篇一个子目录（story/角色/大纲/设定/文风/assets）、工具面剔除 file 类/shell/装载器/绘图/读图/生图子Agent（`NOVEL_EXCLUDED_TOOLS`，请求侧+执行期两层过滤，防注册表复装绕过）、子 Agent 仅 research、status 三态删除；新增 `novel_write`(replace/append 续写)/`novel_write_setting`/`novel_stats`，`read_setting` 支持单文件；侧边栏补封面生图/上传、去 AI 味（`humanize_text` 场景注入）、复制、实时字数、contentRevs 即时刷新；共用弹窗上移 `writing/components/`；**头部常驻（零小说仍显示空态选择框）+ 选中兜底 `ensureActiveSelection`（无选中/被删回落最新，修「有小说却永远空态」）** |
| [06-article-editor.md](./writing/06-article-editor.md)         | 文章编辑器能力层（2026-09-14）：**状态快照单向推送**（编辑器 onTransaction → 浅比较 → `state-change`，工具栏不再瞎猜；块类型下拉随光标显示标题等级/正文）、命令面收敛为 `runCommand`/`setBlockType`、**BubbleMenu 双悬浮框**（选中文字=格式框 / 选中图片=复制·文件夹·换图·AI重新生成·删除）、**工具栏溢出收起**（`nowrap` 恒一行 + ResizeObserver 预算 + 「更多」popup 三区，内联优先级见文档）；⚠️ 铁律=**正文以 markdown 落盘**（只上 markdown 能表达的格式，颜色/对齐/高亮刻意不做）；**块级拖拽手柄已整体移除**（官方 DragHandle 值导入 collaboration/y-tiptap/node-range 并裸导入 y-protocols，为一只手柄被迫装 7 包约 9MB 而本项目不做协同编辑；教训=依赖面以 dist 为准、unmet peer 警告不可一律忽略） |
| [07-article-version-diff.md](./writing/07-article-version-diff.md) | 文章版本对比（2026-09-15）：底部动作条「版本对比」下拉（除当前版本外，新在上）→ `t-dialog` 内嵌 monaco diff 双栏只读对比（左=当前实时正文 / 右=所选落盘正文）；弹窗两件套 `VersionDiffDialog.tsx`+`VersionDiffContent.vue`；版本名统一走 `articleVersionTitle` 共享助手；⚠️ monaco 主题是全局态（diff 选项不含 theme，用 `setTheme`）；**只高亮变化字符不高亮整行**（行背景透明的派生主题，卸载还原） |
| [08-article-selection-humanize.md](./writing/08-article-selection-humanize.md) | 选片段去 AI 味（2026-09-15）：气泡菜单新增「去 AI 味」按钮（选中文字入口，非图片悬浮框）→ 选深度（复用整篇 `openHumanizeDepth`）→ 锁编辑器 → `requestHumanizeStream` 流式改写选中片段 → monaco diff 对比弹窗（左=选中原文 / 右=改写结果，`SelectionHumanizeDialog.tsx`+`SelectionHumanizeContent.vue` 两件套）；**弹窗禁 ESC/遮罩/右上角关闭，只允许「替换/取消」两个出口**（已耗积分防误触）；不建版本、替换即写回正文；深度记忆上移 `humanize.ts` 与整篇同源；⚠️ monaco 宽度低于断点（默认 900px）自动退化上下对比，须 `renderSideBySideInlineBreakpoint: 0` 强制左右；解锁让位于父级锁定 + 原文校验兜底选区漂移 |
| [09-gzh-scene.md](./writing/09-gzh-scene.md)                   | 公众号场景（2026-09-21，同日补齐 skill 至 8 个）：writing 家族第三个子场景 `gzh`（数据复用 articleStore 同库）；**首个使用 `SceneDefinition.skills` 的场景**（8 个 gzh-* 内置 skill=长文/短文/定位三件套/标题/爆款数据/排版/封面/配图，?raw 打包 + skillCatalog 目录 + load_skill 兜底；gzh-trends 含默认赛道组 + 多赛道对比）；排版本地渲染器（marked + 元素 style 映射，AI 不生成 HTML）+ 侧边栏 GzhAside（复用 article 组件 + 底部动作条「更多」分组 + 全覆盖浮层能力面板：排版预览/正文质检，v-show 保留质检结果）+ `gzh_trends` 爆款数据工具（Python 脚本 TS 重写迁 main，gzh:trends IPC 四件套，⚠️ 源站需 no-SNI TLS 回退）；风格库 `~/.mistrelle/gzh-style/` + 4 内置预设 + internal 风格工具（toolMap 接线不建组）；**二期扩展位**：global-content-search（agent-reach/bili-cli/Guaikei）与 xhs-hotnotes（REDFOX_API_KEY）等网络收口后再做取数工具 |

### build/ —— 构建打包

| 文档                                                   | 描述                                                                                     |
|--------------------------------------------------------|------------------------------------------------------------------------------------------|
| [01-app-icon.md](./build/01-app-icon.md)               | 应用图标生成机制：electron-builder 自动从 `build/icon.png` 转换 icns/ico，禁止手动预生成  |
| [02-monaco-editor.md](./build/02-monaco-editor.md)     | Monaco worker 配置：`vite-plugin-monaco-editor` 已移除，改 `?worker` 原生导入 + `MonacoEnvironment` label 分发 |
| [03-dependency-scope.md](./build/03-dependency-scope.md) | 依赖归属判定：`externalizeDepsPlugin` 只外部化 dependencies 且随包进 asar，渲染层专用/零引用包应放 devDependencies 或删除（marked/snapdom/jszip 迁移、lucide 删除、electron-updater 保留） |

### hardware/ —— 硬件控制

| 文档                                            | 描述                                                                                                                        |
|-------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| [01-serial-traffic-light.md](./hardware/01-serial-traffic-light.md) | 串口通信域（serialport v13）：main SerialService **多端口**（`Map<path>`）+ 意外断开 onPortClosed 回调（不面向渲染层）；serial 渲染层桥只剩 `serial:list` 只读查询，**连接/写入/断开一律由各业务域服务编排并经域 IPC 暴露**（渲染层纯展示）；Arduino 行协议（灯+模式/off、9600）、原生模块集成复用 postinstall 链路 |
| [02-buddy-window.md](./hardware/02-buddy-window.md) | 伙伴窗口（独立入口）：`buddy.html` → `windows/buddy/` 独立应用（独立 main/router/preload/外壳）、默认隐藏 + 托盘「打开伙伴」唯一入口、关闭只隐藏、renderer 与 preload 双入口配置、独立窗口目录约定、**外壳单按钮形态声明**（`useTitlePadding({ kind: 'buddy' })`，共享 PageLayout 折叠标题随窗口自适应） |
| [03-traffic-light-config.md](./hardware/03-traffic-light-config.md) | 红绿灯配置（软件状态驱动）：`~/.mistrelle/buddy/traffic-light.json` 结构、事件→灯态绑定（状态唯一/软件互斥两条规则）、灯态全集含呼吸/全灭（事实源 `@common/types/trafficLight`，type 下方 `XxxOptions` 名称映射、全集派生）、本地事件服务 HTTP 事件投递链路（见 server/01）、内置 opencode 插件模板与一键安装（已迁应用集成域，见 hardware/06；软件面板按集成状态门控）、伙伴窗口独立 preload 入口；锁存防覆盖（全量事件先喂锁存器再查绑定，见 hardware/05） |
| [04-esp32-lcd.md](./hardware/04-esp32-lcd.md) | ESP32-S3-LCD-1.28 圆屏页面（2026-09-07）：独立串口连接（SerialService 多端口 + 连接编排/lastPort 记忆全在 main，`esp32Lcd:connect` 指令化 + state 推送）+ 独立配置 `~/.mistrelle/buddy/esp32-lcd.json`（含 `screenQuota` 屏显额度键——屏幕自身的显示配置，圆屏页下拉即改即存、保存后即时补发心跳）；**额度快照经 quotaBus 订阅**（额度是独立公共域，见 plugin/02）+ 当前事件状态（buddyEventBus 订阅 → 行协议 JSON 下发、暂定可改；心跳开关按 opencode 集成状态门控，见 hardware/06）；启动即初始化（无 init IPC）；事件锁存防覆盖（permission/done/ask 落屏后抑制流式噪音，见 hardware/05） |
| [05-buddy-event-protocol.md](./hardware/05-buddy-event-protocol.md) | Buddy 事件协议 v2（2026-09-07）：`/buddy/traffic-light` 升级 `/buddy/event`，事件收口为跨设备白名单词汇表 `@common/types/buddyEvent`（24 个、opencode 蓝本同名，存量红绿灯绑定天然兼容）；server 只做校验+**发布到 buddyEventBus（pub/sub）**，红绿灯/圆屏各域 init 内订阅消费，新增设备零改动 server；插件端白名单过滤投递；**事件语义分层与锁存**（`buddyEventLatch.ts` 噪音/释放/触发表三层 + done 1.5s 静默窗，防 permission/done/ask 被紧随的流式收尾事件覆盖，红绿灯须全量喂入） |
| [06-app-integrations.md](./hardware/06-app-integrations.md) | 应用集成页（2026-09-07）：插件安装从红绿灯页独立为「设置-应用集成」（设置下二级目录，含额度配置迁移）；检测/安装/卸载 IPC 迁独立 integrations 域（`integrations:check/install/uninstall` + `buddy/integrations/platformConfig.ts` adapter 注册表）；插件改名 `mistrelle-integration.js`（install 清理旧名残留）；`useIntegrations` 状态单例 + `INTEGRATION_REGISTRY` 登记表（含支持事件说明）；红绿灯/圆屏硬件页按三态门控（missing 置灰引导安装、outdated 提醒不置灰）；集成卡片「最近事件」调试面板：server 零校验转发原始事件总线 + 两监听器（`buddyEventFilter` 白名单过滤供设备消费 / `integrationsActivity` 全量采集），命中白名单绿字、丢弃灰字，`integrations:getActivity/clearActivity/activity`，纯内存不落盘，仅伙伴窗口 |
| [07-keypad.md](./hardware/07-keypad.md) | 小键盘页面（2026-09-08，09-09 动作注册表重构 + 序列化，09-10 打开网页 + 短按/长按互斥判定，09-11 媒体键 + 长按行为由队列形状推导 + 断开即停，**09-15 控件模型重构**）：串口输入设备（9600，行协议 **`<控件id>,<信号>[,<幅度两位>]` 无行尾分隔符**，支持任意控件数）；**控件模型三层**=基础类型（`button` 自带 on/off、`knob` 自带 left/right）+ 拓展能力（`press` 可按压叠加 on/off、`detent` 有极让转动信号带幅度）+ **派生信号集**（`@common/keypad/controls` 的 `keypadControlSignals`/`keypadControlBindSignals`，两张 Record 表穷尽校验）——**一个控件占一个 id**（取代旧「旋钮拆成 10/11/12 三个伪键位」，旧扁平 bindings 归一化自动迁移为 `{on:绑定}`）；`KeypadBindSignal = on|left|right`（**off 仅释放语义不可绑定**）、**转动路无长按**（`keypadSignalSupportsHold` 仅 on 成立）、**幅度定长两位是硬约束**（无分隔符，变长会与下条消息粘连）；**每路信号绑定动作序列数组**——模拟按键（koffi 系统级组合键：普通键走 CGEventCreateKeyboardEvent / keybd_event，**媒体键走 macOS NX_SYSDEFINED 系统定义事件（type14/subtype8/data1=(NX_KEYTYPE<<16)|0xa|0xb<<8，字段号 83/149/150 实测）+ Windows VK_ 系列**，八种媒体键中文名下拉、无修饰语义且不可录制；亮度 Windows 无标准虚拟键静默跳过；**Fn 归修饰键（09-12）**：kVK_Function 0x3F + kCGEventFlagMaskSecondaryFn 1<<23，setFlags 无条件调用防粘连、主键可缺省=只按住修饰键，Windows 无 VK 静默跳过；macOS 需辅助功能授权，引用计数+releaseAll 防修饰键卡死）/ 打开应用（appCatalog 扫描 + creatable 自定义路径）/ 执行脚本（cliRun）/ 权限审批（允许/拒绝最近待审）/ 延时等待（50–60000ms sleep Promise 形成序列间隔）/ **打开网页**（shell.openExternal，`isValidKeypadUrl` 仅收 http/https）；三端注册表（@common KEYPAD_ACTIONS 定义 / main KEYPAD_ACTION_EXECUTORS 执行器 / 渲染层 KEYPAD_ACTION_EDITORS 编辑器）映射类型穷尽校验，新增动作=各端一文件+登记一行；**信号路由键 `controlId:signal`**（按压路 on/off 归一为 `controlId:on`）+ 每路独立重入守卫；**main 拆分三模块**：keypadService（配置/连接/路由/**转动瞬时高亮 rotation 180ms 过期**）、keypadSequence（会话世代 endSession/isLive + runSequence 世代竞速 + dispatchSequence 重入守卫）、keypadHold（startHold 按队列形状 keep 保持/repeat 循环/once 一次 + endHold 倒序抬起）；**短按/长按互斥判定**（`KeypadBinding.holdActions?` + 全局 `KEYPAD_HOLD_MS=600`，按下起计时、到时仍按住执行长按 / 阈值内松手执行短按，未配置保持按下立即执行零回归）；**长按行为由队列形状推导**（`resolveKeypadHoldBehavior` 两端共用）：单条普通模拟按键=keep（pressCombo 不自动抬起、抬手 releaseCombo）；多条=repeat（每轮 `holdRepeatMs` 20–5000ms 缺省 100、串行不重叠、总时长上限 `KEYPAD_REPEAT_MAX_MS=60000`）；单条非模拟按键=once；单条媒体键例外走循环；**断开即停**（主动/拔线/换连接/保存绑定统一 resetPressed）：先 resetSequences 换代中止在途序列（Promise.race 与世代信号竞速）、清计时/长按会话/信号运行态并 releaseAll，disconnect 先 closePort 再 reset；**实体键盘外观**：键帽 div+css 立体效果+按下动画（鼠标+设备 pressed 同步）、键帽显示**绑定摘要（name 命名优先，未命名回退首条动作+「共 N 个动作」小字**；app=图标+名称，图标走本地 server `/icon/app` 纯 Node 解析 .app 内 icns 提取 PNG 缓存）、点击键帽右侧常驻配置面板（**显示名称 + 信号路切换条（仅多路控件=旋钮）+ 序列编辑**：序号+图标+摘要行、上下移/删除、手风琴展开、添加动作=类型卡片网格、normalize 预校验禁保存；**转动路不渲染长按区块**）；键盘样式 `config.layout` 持久化（keypadLayouts 注册表：**分组 + 统一 ControlCell（kind + controlId + capabilities）+ preset**，样式一 4×2 键1竖跨/键6横跨，样式二 = 左 4×2 八键 + 视觉分隔 + 右 1×2「上旋钮(控件10,press)/下按键 9」）；`preset` 仅补未绑定的信号路不覆盖已有；选中态/路由派生抽 `keypadSelection.ts` 防越行数红线；SerialService `subscribePortData` + keypadProtocol 文法流式解析（分段前缀判定） |
| [08-permission-bridge.md](./hardware/08-permission-bridge.md) | 权限审批基座（2026-09-09，opencode 权限双向回传）：本地事件服务从单向升级为双向——不走未接线的 `permission.ask` 钩子（#7006），插件 `permission.asked` 事件 POST `/buddy/permission/ask` 挂起等决定、`client.permission.respond` 自动应答、`permission.replied` 撤下待审项；**main 基座 permissionService 与业务解耦**（注册表/全量广播/4.5min 超时回 ask/requestId 复合键幂等），消费者各自挂载：伙伴窗口应用集成卡片待审批面板、小键盘「权限审批」原生动作（三端注册表）、HTTP `/decide` 外部脚本端点；双端互答收敛、终端原生询问永不被覆盖；扩展点：LCD 屏显内容（需固件配套）、更多接入来源 |
| [09-zcode-integration.md](./hardware/09-zcode-integration.md) | ZCode 接入（2026-09-09，hooks 配置合并路线，第二个接入软件）：官方 hooks 子进程协议（config.json `hooks` 键）替代插件市场（注册表未文档化不可自动写）；脚本装 `~/.mistrelle/integrations/zcode/` + 幂等合并 config.json（只动 hooks 键、写前 .bak、标记识别本方条目、解析失败即中止）；**PermissionRequest 原生阻塞钩子**直接代答（空输出回落原生询问，无需 replied 回传）；8 事件子集（`ZCODE_HOOK_EVENTS`）无节流（无流式钩子+独立进程）；`SoftwareName` 加成员自动放行白名单，软件页签/绑定面板/占位图标/默认绑定四处登记；支持一键卸载（摘本方条目还原 config.json+删脚本目录，幂等） |
| [10-claude-codex-integration.md](./hardware/10-claude-codex-integration.md) | Claude Code / Codex 接入（2026-09-10，第三、四个接入软件）：三家 hooks 机制同源 → **脚本共享**（`resources/plugins/hooks/`，平台名 argv 传入；zcode 同步迁移，存量用户点一次更新恢复）、仅配置挂载与条目 schema 有差（claude=settings.json exec form 秒级 timeout / codex=hooks.json 专用文件 shell form+async 转发）；**Codex 非托管钩子须 `/hooks` 审查信任后才执行**（未信任静默跳过，effectHint 提示）；`HOOK_PLATFORM_EVENTS`（原 ZCODE_HOOK_EVENTS 改名）三家共用 8 事件子集；权限代答/待审面板/keypad 全链路对新平台零改动生效 |

### todo/ —— 规划与待办

| 文档                                                                       | 描述                                                                                             |
|----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| [01-design-agent-architecture.md](./todo/01-design-agent-architecture.md) | 海报设计 Agent 插件技术架构方案：双形态并存、项目/页面/设计图三层、编辑分层（基础+轻量分组/高级布局给 AI）、模板与复用清单 |

---

## 维护约定

- **新增文档**：新建 `docs/<模块>/<NN>-<名称>.md`，并同步在本文档对应分组下登记一行索引。
- **更新文档**：标题或职责变更时，同步修正本文档中的描述，避免索引与实际内容脱节。
- **删除文档**：同步移除本文档对应行。
