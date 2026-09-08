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
| [07-auto-update.md](./app/07-auto-update.md) | 客户端自动更新：electron-updater generic feed、系统设置检查/下载/重启安装、未打包环境跳过 |

### server/ —— 本地事件服务

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [01-event-server.md](./server/01-event-server.md)             | 本地事件服务（express，127.0.0.1:47743 只绑回环）：`/file/<编码绝对路径>` 资源面（渲染层加载本地字体/图片，替代已删的 `mistrelle://` 自定义协议）+ `/buddy/event` 事件面（外部进程投递，platform/event 双白名单，词汇表见 hardware/05）+ `/ping` 探活；Origin 守卫防浏览器 drive-by 读盘；端口事实源 `@common/server/eventServer.ts` |

### auth/ —— 服务端账号

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [01-server-auth.md](./auth/01-server-auth.md)                 | 服务端账号接入（better-auth）：主进程 AuthService 单例共享状态 + 状态广播、API Key + 会话双存凭证（safeStorage 落盘）、Bearer 规避 CSRF、`/api/auth/*` 与 `/api/user/*` 契约、公开档位/增量包 SKU、登录弹窗与用户菜单接入；账户页布局见 setting/06 |
| [02-activation-and-features.md](./auth/02-activation-and-features.md) | 激活码与会员档位功能控制：verify/redeem 五层链路（redeem 后自动 refresh 广播；会员只决定每日赠送，增量包兑永久积分可重复买）、档位页收敛入口选 SKU 结算（无支付，永久有效）、AuthStore.features 门控（UI 可见锁定 + AI 面过滤 + 渲染不拦，内置风格免费 / 自定义不可用于新会话 / 内置「设计风格创建助手」隐藏） |

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
| [03-image-generate-page.md](./attachment/03-image-generate-page.md) | 文生图页面（`/attachment/image`）+ **主进程 ImageService**：生图编排与运行态上移 main（单例 Map、提交/轮询/落盘/收尾/广播，跨窗口跨刷新存活、启动 cleanupOrphans 收尾），渲染层只剩视图与 `image:*` IPC 薄代理；**只调自有服务端** `/api/images/*`（Result + camelCase，统一异步任务模型；公开 models / 登录 priced 含积分），模型列表=`ImageModelStore`（未登录也可看档位，登录后展示积分，生成需登录），`defaultImageModel` 语义为服务端档位、仍是工具门控与表单默认来源；`image_generate` 工具走 `record:false` 直出模式（不进页面历史）；`db:image:*` 通道删除、`db:image:list` 迁 `image:list`；`task_id`/`poll_max_at`/`task_terminal` 续轮询语义不变（确认即落库、按剩余窗口续查、不重复扣费）；设计风格仍在渲染层拼 prompt；`defaultImageModel` 仍为表单默认与工具首选档位来源（工具门控已改登录态，见 tool/12） |
| [04-file-preview-dialog.md](./attachment/04-file-preview-dialog.md) | 文件预览弹窗（公共组件 `FilePreviewDialog`，原 chat-assistant/modals 提升并按约定拆外壳+内容）：`FilePreviewItem` 契约与分发（url→链接抽屉 / md / **html、htm→webview 渲染预览** / code / image / video / audio / showInFolder 兜底）；本地资源经本地事件服务 HTTP `/file` 面加载（见 server/01），MIME 表含 text/html 等 |

### extend/ —— 闲庭漫步工具页

| 文档                                                          | 描述                                                                                                                          |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| [01-model-health-tool.md](./extend/01-model-health-tool.md) | 可用性检测工具（`/attachment/test`，参考 aibase llm-health）：已配置模型一键选择（含禁用项）自动填充 / 5 维度 12 检测项（基础 4 / 完整 12，共享观测降成本、30s 超时、connect 失败级联跳过）；`model_health` 表 + `db:health:*` IPC；渲染层执行（复用 modules/ai 三格式适配器）+ 模块级单例 composable 单任务锁 + keep-alive（`ExtendTestPage`）切页不中断；逐项落库累积、孤儿 running 收尾；审计报告 = EJS 模板（`resources/templates/`，主进程 templateRender 统一渲染服务 + `template:render` 通道，新域模板可复用）动态生成不落库，抽屉导出 HTML 走 dialog.save 用户自选路径（2026-08-26 起不再落固定目录）；API 密钥不落库 |
| [02-model-compare-tool.md](./extend/02-model-compare-tool.md) | 模型对比检测工具（`/attachment/compare`）：2-6 模型横向对比（速度 TTFT/tokS 中位数、题集判分、身份自述、一致性、usage 计量），三种执行模式（默认混合=速度轮串行+其余并发）、in-flight 水位标注评估并发影响；**题库 `compare_question` 表 + 记录 `model_compare` 表**（标量+JSON 文本列、分页；2026-08-26 由文件 json 迁库防手改出错）+ md 报告**手动导出**（dialog.save 自选路径，EJS 模板 `<%- %>` 例外）；题目编辑 DialogPlugin 命令式；t-table 动态列 cell 渲染函数（TNode 首参 h、:deep 样式）；keep-alive `ExtendComparePage`；无偏好持久化 |

### canvas/ —— 画布

| 文档                                                                    | 描述                                                                                               |
|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| [02-canvas-node-model.md](./canvas/02-canvas-node-model.md)             | 画布节点模型与批量编辑（v2）：图层树 + 区域分组、`canvas_batch_edit`、调色板 token、内置设计 skill；`canvas_guidelines("styles")` 动态风格目录；场景指南结构含文案容量/安全区/翻车点 |
| [03-canvas-animation.md](./canvas/03-canvas-animation.md) | 画布动画（v3）：`CanvasAnimation` 声明式动画字段、`@leafer-in/animate` 透传与预览自动播放、PNG 导出 settle；原随附视频导出已随 ffmpeg 移除（见 app/04） |
| [04-canvas-element-tree.md](./canvas/04-canvas-element-tree.md)         | 画布元素树：设计侧边栏全屏左栏，`selectedId` 驱动元素树 ↔ 画布双向选中联动                      |
| [05-canvas-property-panel.md](./canvas/05-canvas-property-panel.md)     | 画布元素属性面板：全屏三栏第三栏，本地草稿 +「保存」按钮显式写回（batchEdit update，与 AI 同链路）；x/y 禁改、渐变/$token/布局关键字降级策略、按类型字段矩阵 |

### design/ —— 设计风格

| 文档                                                          | 描述                                                                                                      |
|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| [01-design-style.md](./design/01-design-style.md)             | 设计风格模块：落盘契约、**8 套本地内置预设**（2 产品 UI + 各类各 1；更多走在线库）、配方字段（aliases / signature / whitespaceRatio / preferredFormats / suitableFor）、tokens + 提示词注入签名手法 |
| [02-design-style-chat.md](./design/02-design-style-chat.md)   | 设计风格接入 design 聊天：`designStyleId` 创建后锁定、风格转提示词注入稳定 system 前缀、聊天室工作空间/风格只读展示、列表缓存详情不缓存 |
| [03-design-style-agent.md](./design/03-design-style-agent.md) | 设计风格创建助手：工具 schema 含签名手法等配方字段；create 强调 signature 必写；**会员门控**（免费档隐藏 agent、getById 保留历史会话） |
| [04-chart-tool.md](./design/04-chart-tool.md)                 | 图表工具：`chart_generate`（echarts option → SVG 落盘沙盒 → svg 节点 imageUrl 引用，支持全部内置图表）+ `renderChartOptionToSVG` SSR 渲染助手；集成形式调研（leafer 无 SVG 元素、SVG 渲染器 SSR、落盘而非内联的取舍） |
| [05-style-preview.md](./design/05-style-preview.md)           | 风格预览所见即所得：`AiDesignStyleItem` 索引项扩展 typography/tokens/whitespaceRatio（旧数据读取兜底）、`StyleCardFace` 按规范整卡渲染（`--sp-*` 变量换算、留白密度、对比度文字色）、列表卡壳 + 面与详情大样张；**全局风格下拉组件 `StyleSelect`**（t-select 分组 + 选项悬浮 StyleCardFace 预览 + 非会员锁定，PageNew 与文生图表单共用，自带 overlay 全局样式） |
| [06-card-style.md](./design/06-card-style.md)                 | 卡片风格与 Markdown 卡片（2026-09-06 三层模型）：**白名单属性注册表**（快捷层，CSS/表单/AI 提示词全派生）+ **自由层 template/css**（HTML 模板 data-nc 插槽契约 + 自定义 CSS，含清洗规则；信纸横线/纸纹/装饰可行）、7 套内置预设（含自由层示范「苹果备忘录」）、管理页（/design/card 全抽屉 + 模板编辑区）、**Markdown 卡片主页面**（/attachment/card：左 Markdown 源码编辑 + 右实时预览，经 NoteCardRenderer iframe 富渲染 + 实测分页 + snapdom 导出）、内置专家「卡片风格创建助手」（cardStyleTools 含 template/css 参数，extendedCardStyles 门控隐藏；ChatType 'card' 已删）、会员键 `extendedCardStyles`（服务端暂未返回） |
| [07-design-html-engine.md](./design/07-design-html-engine.md) | 设计创意 HTML 引擎（2026-09-06）：design 类型 **DesignScene 子引擎分层**（canvas/html，创建时选定后锁定、存量缺省 canvas、子 Agent 恒为 canvas）、ChatTypeConfig 按 `DESIGN_SCENE_CONFIG` 委托两份独立提示词与工具、`modules/designHtml/` 数据层（纯 HTML 文件 + `<html data-design-*>` 元信息、sanitizeDesignHtml 清洗、图片 dataURL 解析、snapdom 导出 PNG）、`html_*` 工具面（html_write 全量重写编辑模型 + html_guidelines 白名单复用）、专有侧边栏 HtmlDesignAside/HtmlDesignPreview（iframe 预览 + contain 缩放）、**元素选中与修改**（双击蓝框选中 + contentWindow 挂事件 + body 索引路径定位 + 滚轮升降级 + 全屏元素树 + 双击注入聊天镜像画布引用链） |

### chat/ —— 对话

| 文档                                                                | 描述                                                                              |
|---------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| [01-thinking-mode.md](./chat/01-thinking-mode.md)                   | DeepSeek 思考模式：`thinking` / `reasoning_effort` 参数、扁平字段设计、思维链渲染、`delta.reasoning` 网关兼容、工具轮次 `reasoning_content` 强制回传契约（缺失补空串防 400） |
| [02-chat-locator.md](./chat/02-chat-locator.md)                     | 对话侧边定位器（RChatList Locator）：仅用户消息展示、tooltip 预览前 10 字         |
| [03-canvas-node-reference.md](./chat/03-canvas-node-reference.md)   | 画布节点引用：双击节点 → 输入框 canvasMention → `CanvasContent` 结构化注入        |
| [04-chat-session-lifecycle.md](./chat/04-chat-session-lifecycle.md) | 会话生命周期与空闲自动回收：挂载/运行豁免、5 分钟 TTL 过期销毁、回收后磁盘水合    |
| [05-todo-progress.md](./chat/05-todo-progress.md)                   | 待办进度按钮：头部圆环 +「第 X / N 步」、t-popup 弹层复用 TodoList、空待办隐藏    |
| [06-token-usage.md](./chat/06-token-usage.md)                       | Token 用量与上下文占用：API usage 记录、四类构成估算+归一化、发送栏圆环 + 弹窗明细 |
| [07-chat-process-fold.md](./chat/07-chat-process-fold.md)           | 助理消息过程折叠：完成 + 有过程内容即可折叠、无最终回复时折叠条 +「异常停止」提示、record_memory 收尾时锚定到第一个记忆调用之前的回答（收尾 thinking 不计继续干活） |
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

### memory/ —— 记忆

| 文档                                                          | 描述                                                                                                    |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| [01-memory-system.md](./memory/01-memory-system.md)           | 记忆系统（`~/.mistrelle/soul/`）：短期记忆空闲防抖提取 + `record_memory` 主动记录 + 设置页手动立即提取 → 每日 LLM 合并长期记忆（JSON 协议 + 分节字数预算合计 4000 字、解析失败保底重试、覆写前 .bak 备份，合并前兜底补提）→ 主 Agent 独立 system 消息注入；state.json 提取进度与合并边界语义（下一个待消费日期，含边界）、首启基线不回溯、合并成功记录上次合并时间 |

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
| [05-ai-provider-builtin-relay.md](./setting/05-ai-provider-builtin-relay.md) | AI 设置内置供应商（服务端中转站）：主进程 relay IPC 代理 `/v1/models` + `/v1/chat/completions`；透传 `session_id`（渠道亲和）与 `request_id`（仅记录）；流式回调走 start/chunk/end 事件；`thirdPartyRelay` 门控 + 登录守卫 |
| [06-account-page.md](./setting/06-account-page.md) | 账号设置页 Fluent 布局：身份主视觉（可用积分 / 每日赠送）+ 账户与安全（我的会员与我的积分分开，增量包挂在会员下）+ 第三方密钥；进入页 1 分钟节流刷新；积分流水抽屉；档位页收敛入口 + 增量包选择/结算（永久有效，无支付） |
| [07-ai-setting-page.md](./setting/07-ai-setting-page.md) | AI 设置页 Fluent 布局 + 单向数据流：编排层只传 source 快照；ProviderEditor 本地 draft；ProviderModelList 共用；侧栏 Accent 选中条；修复 form 整表替换后模型操作打到孤儿数组 |

### skill/ —— 本地 Skill

| 文档                                                     | 描述                                                                                                            |
|----------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| [01-skill-enable.md](./skill/01-skill-enable.md)         | Skill 启用/禁用：`~/.mistrelle/setting/skill.json` 仅记录禁用项（key=`agentKey/dirName`，缺省即启用）；禁用=仅不默认注入 `<available_skills>` 目录（唯一过滤点），`/` 提及仍可显式指定并标注「已禁用」、`load_skill` 不拦截；列表项右上角 t-switch + 三态筛选（全部/已启用/已禁用）；孤儿 key 继承语义 |

### subagent/ —— 子 Agent

| 文档                                                      | 描述                                                                               |
|-----------------------------------------------------------|------------------------------------------------------------------------------------|
| [01-subagent-module.md](./subagent/01-subagent-module.md) | 子 Agent 模块：能力类型 × 聊天类型矩阵、research / design 两类、模块结构与运行流程 |

### tool/ —— 工具

| 文档                                                    | 描述                                                                                                              |
|---------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| [01-browser-selector.md](./tool/01-browser-selector.md) | 浏览器工具 CSS 选择器提取：`browser_fetch` / `browser_actions` 可选 selector 参数、空结果防护                     |
| [02-asset-tools.md](./tool/02-asset-tools.md)           | 设计素材工具：`website_logo` / `icon_svg` 获取真实素材，来源打分降序尝试                                          |
| [03-font-tools.md](./tool/03-font-tools.md)             | 字体工具与渲染：`font_list` 查询 + `font_pick` 交互选字（推荐 + 全部预览）、系统 / 资源库三态统一契约、五维分类元数据（启发式推断 + 用户持久化，资源库/系统缓存均支持编辑过滤）；字体入库由资源管理页完成（不暴露 AI 工具） |
| [04-image-tools.md](./tool/04-image-tools.md)           | 图片工具四件套：`image_generate`（接口自适应）+ `image_crop` 本地切分 + `image_remove_background` flood fill 去白底（生图不支持真透明）+ `image_color_map` 网格主色 + LAB 感知色差突兀区域检测 |
| [05-file-tools.md](./tool/05-file-tools.md)             | 文件系统工具：`file_read` 主进程流式按行分页（默认 500 行/页，nextOffset/totalLines 翻页，110KB 行预算防 128KB 截断）、`file_stat` 基于 fs.stat 返回权威文件信息、`file_glob` / `file_grep` 主进程递归搜索（glob 匹配 + 内容正则，内置忽略目录与结果上限）；`image_info` 已迁 design 场景工具集、`file_exists` 已删（被 file_stat 覆盖）           |
| [06-ego-browser-tools.md](./tool/06-ego-browser-tools.md) | ego-browser 工具：`ego_browser_run` 免审批包装 CLI（nodejs 子命令经 stdin 通道传 script，其余子命令 args 透传）、`ego_browser_exist` 只读探测安装状态；可执行文件路径解析（runtime.egoBrowser 配置 → 平台默认推断 → PATH 兜底）；经「浏览器」可选分组注入（不常驻）；`cliRun` 新增 `stdin` 选项 |
| [07-tool-policy.md](./tool/07-tool-policy.md)           | 工具安全策略注册与模块循环依赖约束：`registerToolPolicy` / `resolveToolPolicy` 机制、TDZ 崩溃根因（toolPolicy import 闭包拉入 chat/store 全量图）与修复（import 叶子化）、后续新增策略的约束；2026-08 升级：聊天级目录白名单（确认卡片勾选「此目录以后都允许」→ `AiChatContent.allowedDirs`，仅本聊天）、skill 根目录脚本免审批（`ctx.skillRootDirs` 注入）、可信区内 cwd 命令免审批（不依赖沙箱开关） |
| [08-search-tools.md](./tool/08-search-tools.md)         | 搜索工具：`getDefaultTools()` 动态组装；`zhihu_search` 仅配置 Access Secret 时注入 + `any_search` 可匿名；账号设置知乎项与鉴权头 |
| [10-default-tools-slimming.md](./tool/10-default-tools-slimming.md) | 默认工具精简（28→20）：shell 只留 cli_run（js/python/node/git_run 彻底删+死配置清理）、浏览器只留 browser_fetch（ego 移可选）、file_exists/read_skill_file 删除（被 file_stat/file_read 覆盖）、file_write_xlsx 移「文档处理」可选组、image_info 迁 design 场景注入；历史兼容按名集合保留清单 |
| [11-progressive-tool-collection.md](./tool/11-progressive-tool-collection.md) | 渐进式工具加载：`ToolGroup` 增加 id/description、`<available_tool_collections>` 目录 + `load_tool_collection(ids)` 整组装载、洋葱式三层解析（内置→已装载→全局 toolRegistry 兜底，命中即自动复装实现跨 Loop 恢复）、beginRequest 每轮清空不落库；并行审批 UI（待审块均可作答 + 横幅计数定位）；真问题是能力自助化而非省 token |
| [12-chat-image-generate.md](./tool/12-chat-image-generate.md) | 通用生图对话直出：`image_generate` 升级为唯一通用工具（office + design 双引擎共用，生成图一律作为 `image` 内容块展示在对话中）、执行器 `chatImages` 标记约定（回填 image 块 + 剥离标记）、`hasImageGenerateAccess()` 登录门控（替代默认生图模型门控，4 处统一）、RChatImage 渲染组件 + 折叠白名单保留图片块 |

### writing/ —— 写作

| 文档                                                           | 描述                                                                                   |
|----------------------------------------------------------------|----------------------------------------------------------------------------------------|
| [01-writing-scene.md](./writing/01-writing-scene.md)           | 写作子场景（WritingScene）：大类型管框架、子场景管能力，场景 article / novelShort      |
| [02-article-data-layer.md](./writing/02-article-data-layer.md) | 文章数据层与工具：project.json 索引 + drafts 正文 + assets 配图、`article_*` 工具驱动  |
| [03-article-aside.md](./writing/03-article-aside.md)           | 文章侧边栏：writing 侧边栏按 chatType → writingScene 两层拆分、`ArticleAside` 项目容器 |
| [04-image-export.md](./writing/04-image-export.md)             | md 图片引用与 zip 导出：相对路径约定、`imageRef.ts` 解析与压缩导出                     |
| [05-novel-short-scene.md](./writing/05-novel-short-scene.md)   | 短篇小说场景：每篇一个子目录（story/角色/大纲/设定/文风）、`novel_*` 工具、侧边栏双布局 |

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
| [06-app-integrations.md](./hardware/06-app-integrations.md) | 应用集成页（2026-09-07）：插件安装从红绿灯页独立为「设置-应用集成」（设置下二级目录，含额度配置迁移）；检测/安装 IPC 迁独立 integrations 域（`integrations:check/install` + `buddy/integrations/platformConfig.ts` adapter 注册表）；插件改名 `mistrelle-integration.js`（install 清理旧名残留）；`useIntegrations` 状态单例 + `INTEGRATION_REGISTRY` 登记表（含支持事件说明）；红绿灯/圆屏硬件页按三态门控（missing 置灰引导安装、outdated 提醒不置灰）；集成卡片「最近事件」调试面板：server 零校验转发原始事件总线 + 两监听器（`buddyEventFilter` 白名单过滤供设备消费 / `integrationsActivity` 全量采集），命中白名单绿字、丢弃灰字，`integrations:getActivity/clearActivity/activity`，纯内存不落盘，仅伙伴窗口 |
| [07-keypad.md](./hardware/07-keypad.md) | 小键盘页面（2026-09-08）：6 键串口输入设备（9600，`<键位>,<on\|off>` **无行尾分隔符**，支持任意键数）；**SerialService 新增 `subscribePortData` 原始数据订阅**（分帧由订阅方解析，keypadProtocol 文法流式匹配+失步重同步）；main 域照红绿灯四层结构（`~/.mistrelle/buddy/keypad.json`、绑定=修饰键+主键组合，页面录制快捷键）；**koffi 直调系统 API 系统级模拟按键**（macOS CGEventPost 需辅助功能授权 / Windows keybd_event、引用计数、断开/拔线/退出 releaseAll 防修饰键卡死）；主键白名单元组派生类型/选项/校验 |

### todo/ —— 规划与待办

| 文档                                                                       | 描述                                                                                             |
|----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| [01-design-agent-architecture.md](./todo/01-design-agent-architecture.md) | 海报设计 Agent 插件技术架构方案：双形态并存、项目/页面/设计图三层、编辑分层（基础+轻量分组/高级布局给 AI）、模板与复用清单 |

---

## 维护约定

- **新增文档**：新建 `docs/<模块>/<NN>-<名称>.md`，并同步在本文档对应分组下登记一行索引。
- **更新文档**：标题或职责变更时，同步修正本文档中的描述，避免索引与实际内容脱节。
- **删除文档**：同步移除本文档对应行。
