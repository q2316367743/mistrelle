# docs/ 文档索引

> 本目录存放项目技术文档，供后续 AI 参考。 **请先读本文件**，按功能定位目标文档，无需逐个查看文件名。

## 索引

### app/ —— 应用外壳

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [AppSide.md](./app/AppSide.md)       | 主应用左侧导航栏：AppSide 外壳 + SideMenu/SideMenuNode 递归菜单组件（SideMenuItem 数据模型、active 推导、展开/收起高度动画）、menuTree 映射与导航约定 |
| [01-app-shell.md](./app/01-app-shell.md) | 应用外壳生命周期：托盘常驻（显示 AI 窗口/退出）+ AI 主窗口启动即建（默认显示/关闭只隐藏）、Dock 点击打开主窗口、闪退修复（close 拦截只隐藏 + before-quit 放行真退出 + closed 置空引用）、AI 主窗口模块（createAiWindow/showAiWindow）、index.ts 仅生命周期编排 |

### auth/ —— 服务端账号

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [01-server-auth.md](./auth/01-server-auth.md)                 | 服务端账号接入（better-auth）：主进程 AuthService 单例共享状态 + 状态广播、API Key + 会话双存凭证（safeStorage 落盘）、Bearer 规避 CSRF、`/api/auth/*` 与 `/api/user/*` 契约、公开档位/增量包 SKU、登录弹窗与用户菜单接入；账户页布局见 setting/06 |
| [02-activation-and-features.md](./auth/02-activation-and-features.md) | 激活码与会员档位功能控制：verify/redeem 五层链路（redeem 后自动 refresh 广播；会员只决定每日赠送，增量包 30 天账本可重复买）、档位页收敛入口选 SKU 结算（无支付，确认文案 30 天清零）、AuthStore.features 门控 |

### ai/ —— AI 请求

| 文档                                                          | 描述                                                                                                          |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| [01-ai-request-module.md](./ai/01-ai-request-module.md)       | AI 请求统一模块：替代 openai SDK（preload Node http 通道免疫 CORS）、三格式（chat/responses/anthropic）适配器、流式通道（preload 薄桥 + plugin/http.requestStream + 渲染层 SSE 分帧归一）、消费方改造 |
| [02-ai-agent-store.md](./ai/02-ai-agent-store.md)             | AI Agent 配置存储：`~/.mistrelle/agent.json`（`AiAgentService` 读写 + `AiAgentStore` 契约、内置 Agent 只读不落盘）；从 lmdb DbStorage 迁移，旧数据不迁移 |

### note/ —— 笔记

| 文档                                                        | 描述                                                                                                   |
|-------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| [01-note-module.md](./note/01-note-module.md)               | 项目笔记模块：`~/.mistrelle/project/{id}/notes`（并入项目，独立笔记已删）+ Obsidian 附件规范（a.md ↔ a.assets）、右键菜单增删改、tiptap 编辑器 + tab 多开 |

### plugin/ —— 插件基础设施

| 文档                                                           | 描述                                                                                             |
|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| [01-shell-exec.md](./plugin/01-shell-exec.md)                 | shell 执行插件：cliRun / jsRun 双层超时保障（底层 kill + 前端 IPC 挂起兜底）、超时契约与兼容性   |

### migration/ —— 平台迁移

| 文档                                                                           | 描述                                                                                                                                                     |
|--------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| [01-electron-preload-migration.md](./migration/01-electron-preload-migration.md) | uTools → Electron 迁移：进程职责划分（特权操作进 main / 纯函数留 preload，例外：net 下载因 onDownloadProgress 回调无法过 IPC 而保留 preload）、IPC 通道表、lmdb 数据层（无 rev/附件）、ffmpeg 二进制随包分发（见 build/03，旧远程下载方案已移除）、sharp 移植、renderer 异步化适配清单 |
| [02-local-protocol.md](./migration/02-local-protocol.md)                       | `mistrelle://` 本地资源协议：渲染层 URL 加载本地字体/图片，规避 dev 下 http 页面加载 file:// 被 Chromium 拦截；`registerLocalSchemes` 须在 app ready 前注册、handler 读盘返回 |
| [03-lmdb-to-json.md](./migration/03-lmdb-to-json.md)                           | lmdb → 本地 JSON 收尾迁移：剩余消费点（network/global/secure/default setting、workspace 历史）映射与行为变化（rev 删除、不预写空文件、init 后注册 watch、孤儿 AiWorkspaceStore 直接删除）、lmdb 全链路删除清单、`~/.mistrelle/` JSON 存储全景 |

### data/ —— 数据存储

| 文档                                                        | 描述                                                                                 |
|-------------------------------------------------------------|--------------------------------------------------------------------------------------|
| [01-sqlite-storage.md](./data/01-sqlite-storage.md)         | SQLite 存储层：Drizzle + better-sqlite3（主进程持有全部 DB 逻辑）、DB 路径 `~/.mistrelle/db/mistrelle.db`、schema、IPC 领域方法契约、aihot 去重/分页、drizzle-kit 迁移流水线 + 资源目录规范、后续模块复用步骤；陷阱：复合列 onConflictDoUpdate 须先声明复合主键（chat_sub 0004 修复）、多语句 DDL 须带 statement-breakpoint |
| [02-chat-sqlite-migration.md](./data/02-chat-sqlite-migration.md) | 聊天域迁移 SQLite：chat/chat_content/chat_sub 三表、会话键路由（chat:{id}/sub:{chatId}:{subId}，项目任务保持文件）、记忆进度键改写、`test/migrate-chat-to-sqlite.mjs` 手动迁移脚本（--dry-run、删除范围=index.json+message/、保留 outputs） |

### browserTool/ —— 浏览器工具

| 文档                                                              | 描述                                                                                                                       |
|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| [01-browser-tool.md](./browserTool/01-browser-tool.md)            | 浏览器工具执行核心（browser_fetch / browser_actions 统一入口）：主进程一个方法 `browserTool:run`，载荷判别联合（fetch/actions），无 runner 子进程/无链式客户端；步骤表与 IPC 契约 |

### subscribe/ —— 订阅

| 文档                                                                  | 描述                                                                                                        |
|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| [01-subscribe-module.md](./subscribe/01-subscribe-module.md)           | 订阅模块：博主→视频订阅→详情三级、策略接口（自实现）、ffmpeg 转音频、FunASR 转写（识别参数）、AI 总结流水线 |

### attachment/ —— 附件与资讯页

| 文档                                                          | 描述                                                                                                                          |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| [01-aihot-page.md](./attachment/01-aihot-page.md)             | AIHOT 资讯页：t-tabs 四视图（精选/动态/热点/日报）；精选=本地缓存、动态=在线全量池（lazy 懒挂载）；时间轴；精选集 snapshot/changes 增量同步；日报不可变缓存、429 Retry-After 等接入文档约定落地；已读/未读标记（read 列持久化、点击打开即标记） |
| [02-aihot-embedded-link-viewer.md](./attachment/02-aihot-embedded-link-viewer.md) | 内嵌网页浏览抽屉（公共组件 `LinkPreviewDrawer`，原 AihotLinkDrawer 提升）：链接出口统一走 `openLinkPreview` → DrawerPlugin + `<webview>`（webviewTag: true）；选型结论（vs WebContentsView）、UA 覆写防白屏、`persist:link-preview` 会话隔离、did-fail-load -3 忽略等注意事项 |
| [03-image-generate-page.md](./attachment/03-image-generate-page.md) | 文生图页面（`/attachment/image`）：生成表单（模型选择：显式 imageOptions 优先、缺省默认；提交即清空、可并行连续生成）+ 历史网格；复用 `generateImage` 服务、`image_generate` 表 + `db:image:*` IPC、图片按月分桶 `~/.mistrelle/image/generate/{yyyy-MM}/{id}.png`；pending→success/failed 状态机（单例跨路由存活、settle 排除运行中、删除防 upsert 复活）、`${provideId}:${identifier}` 模型 key 约定、五处同步清单 |
| [04-file-preview-dialog.md](./attachment/04-file-preview-dialog.md) | 文件预览弹窗（公共组件 `FilePreviewDialog`，原 chat-assistant/modals 提升并按约定拆外壳+内容）：`FilePreviewItem` 契约与分发（url→链接抽屉 / md / **html、htm→webview 渲染预览** / code / image / video / audio / showInFolder 兜底）；mistrelle:// 协议仅默认 session 注册故 html webview 不写 partition、主进程 MIME 补 text/html 等 |

### extend/ —— 闲庭漫步工具页

| 文档                                                          | 描述                                                                                                                          |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| [01-model-health-tool.md](./extend/01-model-health-tool.md) | 可用性检测工具（`/attachment/test`，参考 aibase llm-health）：已配置模型一键选择（含禁用项）自动填充 / 5 维度 12 检测项（基础 4 / 完整 12，共享观测降成本、30s 超时、connect 失败级联跳过）；`model_health` 表 + `db:health:*` IPC；渲染层执行（复用 modules/ai 三格式适配器）+ 模块级单例 composable 单任务锁 + keep-alive（`ExtendTestPage`）切页不中断；逐项落库累积、孤儿 running 收尾；审计报告 = EJS 模板（`resources/templates/`，主进程 templateRender 统一渲染服务 + `template:render` 通道，新域模板可复用）动态生成不落库，抽屉导出 HTML 走 dialog.save 用户自选路径（2026-08-26 起不再落固定目录）；API 密钥不落库 |
| [02-model-compare-tool.md](./extend/02-model-compare-tool.md) | 模型对比检测工具（`/attachment/compare`）：2-6 模型横向对比（速度 TTFT/tokS 中位数、题集判分、身份自述、一致性、usage 计量），三种执行模式（默认混合=速度轮串行+其余并发）、in-flight 水位标注评估并发影响；**题库 `compare_question` 表 + 记录 `model_compare` 表**（标量+JSON 文本列、分页；2026-08-26 由文件 json 迁库防手改出错）+ md 报告**手动导出**（dialog.save 自选路径，EJS 模板 `<%- %>` 例外）；题目编辑 DialogPlugin 命令式；t-table 动态列 cell 渲染函数（TNode 首参 h、:deep 样式）；keep-alive `ExtendComparePage`；无偏好持久化 |

### canvas/ —— 画布

| 文档                                                                    | 描述                                                                                               |
|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| [02-canvas-node-model.md](./canvas/02-canvas-node-model.md)             | 画布节点模型与批量编辑（v2）：图层树 + 区域分组、`canvas_batch_edit`、调色板 token、内置设计 skill；`canvas_guidelines("styles")` 动态风格目录；场景指南结构含文案容量/安全区/翻车点 |
| [03-canvas-animation-export.md](./canvas/03-canvas-animation-export.md) | 画布动画与视频导出（v3）：声明式动画、逐帧渲染 + ffmpeg 导出、剪映式全屏进度遮罩；离屏 Leafer 挂临时容器避免污染 body 的 `user-select` |
| [04-canvas-element-tree.md](./canvas/04-canvas-element-tree.md)         | 画布元素树：设计侧边栏全屏左栏，`selectedId` 驱动元素树 ↔ 画布双向选中联动                      |
| [05-canvas-property-panel.md](./canvas/05-canvas-property-panel.md)     | 画布元素属性面板：全屏三栏第三栏，本地草稿 +「保存」按钮显式写回（batchEdit update，与 AI 同链路）；x/y 禁改、渐变/$token/布局关键字降级策略、按类型字段矩阵 |

### design/ —— 设计风格

| 文档                                                          | 描述                                                                                                      |
|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| [01-design-style.md](./design/01-design-style.md)             | 设计风格模块：落盘契约、**8 套本地内置预设**（2 产品 UI + 各类各 1；更多走在线库）、配方字段（aliases / signature / whitespaceRatio / preferredFormats / suitableFor）、tokens + 提示词注入签名手法 |
| [02-design-style-chat.md](./design/02-design-style-chat.md)   | 设计风格接入 design 聊天：`designStyleId` 创建后锁定、风格转提示词注入稳定 system 前缀、聊天室工作空间/风格只读展示、列表缓存详情不缓存 |
| [03-design-style-agent.md](./design/03-design-style-agent.md) | 设计风格创建助手：工具 schema 含签名手法等配方字段；create 强调 signature 必写 |
| [04-chart-tool.md](./design/04-chart-tool.md)                 | 图表工具：`chart_generate`（echarts option → SVG 落盘沙盒 → svg 节点 imageUrl 引用，支持全部内置图表）+ `renderChartOptionToSVG` SSR 渲染助手；集成形式调研（leafer 无 SVG 元素、SVG 渲染器 SSR、落盘而非内联的取舍） |
| [05-style-preview.md](./design/05-style-preview.md)           | 风格预览所见即所得：`AiDesignStyleItem` 索引项扩展 typography/tokens/whitespaceRatio（旧数据读取兜底）、`StyleCardFace` 按规范整卡渲染（`--sp-*` 变量换算、留白密度、对比度文字色）、列表卡壳 + 面与详情大样张、新建聊天页下拉面板底部悬停实时预览 |

### ppt/ —— PPT 专家

| 文档                                                            | 描述                                                                                                                               |
|-----------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| [01-ppt-module.md](./ppt/01-ppt-module.md)                     | PPT 专家聊天类型（已实现，第四版契约：元素级批量操作）：POM 库调研、主进程渲染 + IPC（渲染进程零 pom）、单一文件持续编辑（{name}.ppt.json）+ 元素 TypeBox 校验、ppt_* 工具契约（ppt_batch_edit 仿 canvas 的 insert/copy/update/move/delete，≤15 个/批）/ 侧边栏 UI（视口聚焦后 ↑/↓ 方向键翻页）/ 注册链路、实现记录与实测差异；§8 节点引用与精准编辑（顶层 id + SVG 映射 + batch update）；§13 三端展示一致修复（WPS/快速预览字体替换错乱 → 后处理 wrap=none+normAutofit + 提示词文字宽度经验） |
| [02-pom-xml-guide.md](./ppt/02-pom-xml-guide.md)                | SlideNode JSON 结构与导出速查（`ppt_guidelines` 数据源，topic: json）：存储结构 / SlideNode 通用结构（含顶层 id 节点标识）/ 元素与 XML 对应 / Theme 色板 / 设计铁律 / 编辑规范与 update 精准编辑（批量操作见 `ppt_guidelines("operations")`） |
| [03-ppt-experience-guides.md](./ppt/03-ppt-experience-guides.md) | PPT 经验指南（官方三文档转写，`ppt_guidelines` 数据源）：layout 布局系统与页面模式 / nodes 20 种节点速查 / styling 配色字体样式最佳实践（SlideNode JSON 写法） |
| [04-vue-render-pptxgenjs.md](./ppt/04-vue-render-pptxgenjs.md) | PPT 渲染架构：Vue/CSS 唯一布局真相、DOM 快照二维契约、data-node-id 精确点选与双击引用、PptxGenJS PPTX 导出与 canvas PNG 导出边界 |

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

### memory/ —— 记忆

| 文档                                                          | 描述                                                                                                    |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| [01-memory-system.md](./memory/01-memory-system.md)           | 记忆系统（`~/.mistrelle/soul/`）：短期记忆空闲防抖提取 + `record_memory` 主动记录 + 设置页手动立即提取 → 每日 LLM 合并长期记忆（JSON 协议 + 分节字数预算合计 4000 字、解析失败保底重试、覆写前 .bak 备份，合并前兜底补提）→ 主 Agent 独立 system 消息注入；state.json 提取进度与合并边界语义（下一个待消费日期，含边界）、首启基线不回溯、合并成功记录上次合并时间 |

### personalize/ —— 个性化

| 文档                                                                  | 描述                                                                                                                             |
|-----------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| [01-personalize-module.md](./personalize/01-personalize-module.md)     | 个性化系统（`soul/*.md` 五文件）：IDENTITY / DESIGN / WRITE / AGENT / USER 按 scope 注入主 Agent 稳定前缀（design+ppt / writing 类型过滤）、`PERSONALIZE_FILE_CONFIG` 单一数据源、mtime 缓存、设置页 t-tabs 编辑器 |

### setting/ —— 设置

| 文档                                                   | 描述                                                                                          |
|--------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| [01-ai-model-fetch.md](./setting/01-ai-model-fetch.md) | AI 设置「从接口获取模型」抽屉：`FetchModelsDrawer` 命令式外壳 + `FetchModelsContent` 内容组件；内置模型上下文表（`aiModelPresets.ts`）自动维护 `context` / `output` |
| [02-ai-model-store.md](./setting/02-ai-model-store.md) | AI 模型配置存储：`~/.mistrelle/model.json`（`ModelService` 读写 + `SettingAiStore` 契约）；提供方 `enable` 与 sortablejs 拖拽排序 |
| [03-window-glass-titlebar.md](./setting/03-window-glass-titlebar.md) | 窗口配置：三平台隐藏标题栏（macOS hiddenInset + trafficLightPosition 下移交通灯 / 其他 titleBarOverlay）+ 系统级毛玻璃（vibrancy / acrylic）；毛玻璃需透明背景才可见；useTitlePadding 跨平台标题边距（macOS 左避交通灯 / Windows 右避 overlay，l1/l2/l3/r1 数值推导与消费方） |
| [04-account-store.md](./setting/04-account-store.md) | 账户配置存储：`~/.mistrelle/account.json`（`SettingAccountService` 读写 + safeStorage 整文件加密，含明文降级）；Store 契约 `state` + 三个鉴权配置不变 |
| [05-ai-provider-builtin-relay.md](./setting/05-ai-provider-builtin-relay.md) | AI 设置内置供应商（服务端中转站）：主进程 relay IPC 代理 `/v1/models` + `/v1/chat/completions`；透传 `session_id`（渠道亲和）与 `request_id`（仅记录）；流式回调走 start/chunk/end 事件；`thirdPartyRelay` 门控 + 登录守卫 |
| [06-account-page.md](./setting/06-account-page.md) | 账号设置页 Fluent 布局：身份主视觉（可用积分 / 每日赠送）+ 账户与安全（我的会员与我的积分分开，增量包挂在会员下）+ 第三方密钥；进入页 1 分钟节流刷新；积分流水抽屉；档位页收敛入口 + 增量包选择/结算（确认文案 30 天清零，无支付） |

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
| [09-aihot-tools.md](./tool/09-aihot-tools.md)         | AIHOT 资讯工具：匿名只读公开 API 客户端（`modules/api/aihot` 全 8 端点，skillhub 同款模式）+ 4 个 safe 工具与资讯页四页签一一对应（精选=本地镜像查询、动态=在线公开池检索、热点=热门榜、日报）；事件时间线 / 日报归档索引仅保留在页面 UI 不暴露为工具；镜像由应用侧 AihotSelectedService 维护，工具不暴露 snapshot+changes 账本协议 |
| [10-default-tools-slimming.md](./tool/10-default-tools-slimming.md) | 默认工具精简（28→20）：shell 只留 cli_run（js/python/node/git_run 彻底删+死配置清理）、浏览器只留 browser_fetch（ego 移可选）、file_exists/read_skill_file 删除（被 file_stat/file_read 覆盖）、file_write_xlsx 移「文档处理」可选组、image_info 迁 design 场景注入；历史兼容按名集合保留清单 |
| [11-progressive-tool-collection.md](./tool/11-progressive-tool-collection.md) | 渐进式工具加载：`ToolGroup` 增加 id/description、`<available_tool_collections>` 目录 + `load_tool_collection(ids)` 整组装载、洋葱式三层解析（内置→已装载→全局 toolRegistry 兜底，命中即自动复装实现跨 Loop 恢复）、beginRequest 每轮清空不落库；并行审批 UI（待审块均可作答 + 横幅计数定位）；真问题是能力自助化而非省 token |

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
| [03-ffmpeg-bundling.md](./build/03-ffmpeg-bundling.md) | ffmpeg 二进制随包分发：`scripts/fetch-ffmpeg.mjs` 从 npmmirror 镜像拉取到 `resources/ffmpeg/{os}-{arch}/`（gitignore），electron-builder `extraResources` 按平台注入（asar 外可直接 spawn）、运行时同步解析无下载；打包前必须先跑 fetch 脚本 |

### todo/ —— 规划与待办

| 文档                                                                       | 描述                                                                                             |
|----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| [01-design-agent-architecture.md](./todo/01-design-agent-architecture.md) | 海报设计 Agent 插件技术架构方案：双形态并存、项目/页面/设计图三层、编辑分层（基础+轻量分组/高级布局给 AI）、模板与复用清单 |

---

## 维护约定

- **新增文档**：新建 `docs/<模块>/<NN>-<名称>.md`，并同步在本文档对应分组下登记一行索引。
- **更新文档**：标题或职责变更时，同步修正本文档中的描述，避免索引与实际内容脱节。
- **删除文档**：同步移除本文档对应行。
