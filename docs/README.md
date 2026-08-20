# docs/ 文档索引

> 本目录存放项目技术文档，供后续 AI 参考。 **请先读本文件**，按功能定位目标文档，无需逐个查看文件名。

## 索引

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
| [01-electron-preload-migration.md](./migration/01-electron-preload-migration.md) | uTools → Electron 迁移：进程职责划分（特权操作进 main / 纯函数留 preload，例外：net 下载因 onDownloadProgress 回调无法过 IPC 而保留 preload）、IPC 通道表、lmdb 数据层（无 rev/附件）、ffmpeg 首次远程下载、sharp 移植、renderer 异步化适配清单 |
| [02-local-protocol.md](./migration/02-local-protocol.md)                       | `mistrelle://` 本地资源协议：渲染层 URL 加载本地字体/图片，规避 dev 下 http 页面加载 file:// 被 Chromium 拦截；`registerLocalSchemes` 须在 app ready 前注册、handler 读盘返回 |
| [03-lmdb-to-json.md](./migration/03-lmdb-to-json.md)                           | lmdb → 本地 JSON 收尾迁移：剩余消费点（network/global/secure/default setting、workspace 历史）映射与行为变化（rev 删除、不预写空文件、init 后注册 watch、孤儿 AiWorkspaceStore 直接删除）、lmdb 全链路删除清单、`~/.mistrelle/` JSON 存储全景 |

### browserTool/ —— 浏览器工具

| 文档                                                              | 描述                                                                                                                       |
|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| [01-browser-tool.md](./browserTool/01-browser-tool.md)            | 浏览器工具执行核心（browser_fetch / browser_actions 统一入口）：主进程一个方法 `browserTool:run`，载荷判别联合（fetch/actions），无 runner 子进程/无链式客户端；步骤表与 IPC 契约 |

### subscribe/ —— 订阅

| 文档                                                                  | 描述                                                                                                        |
|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| [01-subscribe-module.md](./subscribe/01-subscribe-module.md)           | 订阅模块：博主→视频订阅→详情三级、策略接口（自实现）、ffmpeg 转音频、FunASR 转写（识别参数）、AI 总结流水线 |

### canvas/ —— 画布

| 文档                                                                    | 描述                                                                                               |
|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| [02-canvas-node-model.md](./canvas/02-canvas-node-model.md)             | 画布节点模型与批量编辑（v2）：图层树 + 区域分组、`canvas_batch_edit`、调色板 token、内置设计 skill；对齐枚举含 START/END（≡MIN/MAX）；text 行高绝对测量；渐变 from/to 仅 9 个 Leafer 方位（渲染层归一化存量脏数据） |
| [03-canvas-animation-export.md](./canvas/03-canvas-animation-export.md) | 画布动画与视频导出（v3）：声明式动画、逐帧渲染 + ffmpeg 导出、剪映式全屏进度遮罩；离屏 Leafer 挂临时容器避免污染 body 的 `user-select` |
| [04-canvas-element-tree.md](./canvas/04-canvas-element-tree.md)         | 画布元素树：设计侧边栏全屏左栏，`selectedId` 驱动元素树 ↔ 画布双向选中联动                      |
| [05-canvas-property-panel.md](./canvas/05-canvas-property-panel.md)     | 画布元素属性面板：全屏三栏第三栏，本地草稿 +「保存」按钮显式写回（batchEdit update，与 AI 同链路）；x/y 禁改、渐变/$token/布局关键字降级策略、按类型字段矩阵 |

### design/ —— 设计风格

| 文档                                                          | 描述                                                                                                      |
|---------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| [01-design-style.md](./design/01-design-style.md)             | 设计风格模块：`~/.mistrelle/design/` 落盘（index.json 索引 + `design-{id}.json` 明细）、内置预设（isSystem 只读）、列表 + 明细页、命令式抽屉表单；tokens 细节规范（间距 / 圆角 / 边框 / 阴影 / 动效）+ 提示词固定注入「细节规范」段落（PPT 不跳过） |
| [02-design-style-chat.md](./design/02-design-style-chat.md)   | 设计风格接入 design 聊天：`designStyleId` 创建后锁定、风格转提示词注入稳定 system 前缀、聊天室工作空间/风格只读展示、列表缓存详情不缓存 |
| [03-design-style-agent.md](./design/03-design-style-agent.md) | 设计风格创建助手（内置 Agent）：`builtin:design-style` + 4 个 internal 风格工具契约（list/get/create/update）+ `font_list` 查询本机字体、`DesignStyleStore.put` 返回 id 改造 |
| [04-chart-tool.md](./design/04-chart-tool.md)                 | 图表工具：`chart_generate`（echarts option → SVG 落盘沙盒 → svg 节点 imageUrl 引用，支持全部内置图表）+ `renderChartOptionToSVG` SSR 渲染助手；集成形式调研（leafer 无 SVG 元素、SVG 渲染器 SSR、落盘而非内联的取舍） |

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
| [01-thinking-mode.md](./chat/01-thinking-mode.md)                   | DeepSeek 思考模式：`thinking` / `reasoning_effort` 参数、扁平字段设计、思维链渲染 |
| [02-chat-locator.md](./chat/02-chat-locator.md)                     | 对话侧边定位器（RChatList Locator）：仅用户消息展示、tooltip 预览前 10 字         |
| [03-canvas-node-reference.md](./chat/03-canvas-node-reference.md)   | 画布节点引用：双击节点 → 输入框 canvasMention → `CanvasContent` 结构化注入        |
| [04-chat-session-lifecycle.md](./chat/04-chat-session-lifecycle.md) | 会话生命周期与空闲自动回收：挂载/运行豁免、5 分钟 TTL 过期销毁、回收后磁盘水合    |
| [05-todo-progress.md](./chat/05-todo-progress.md)                   | 待办进度按钮：头部圆环 +「第 X / N 步」、t-popup 弹层复用 TodoList、空待办隐藏    |
| [06-token-usage.md](./chat/06-token-usage.md)                       | Token 用量与上下文占用：API usage 记录、四类构成估算+归一化、发送栏圆环 + 弹窗明细 |
| [07-chat-process-fold.md](./chat/07-chat-process-fold.md)           | 助理消息过程折叠：完成 + 有过程内容即可折叠、无最终回复时折叠条 +「异常停止」提示 |
| [08-new-page-keep-alive.md](./chat/08-new-page-keep-alive.md)       | 新建聊天页 keep-alive 保活：router-view 外套 keep-alive 缓存 /new 页（组件名 PageNew），发送后重置全部表单数据 |
| [09-user-message-expand.md](./chat/09-user-message-expand.md)       | 用户消息折叠 / 展开：限高 3 行 + 底部 backdrop-filter 渐变模糊、模糊区中央向下箭头展开 / 展开后居中向上箭头收起，溢出检测决定箭头显隐 |
| [10-ai-workspace.md](./chat/10-ai-workspace.md)                     | AiWorkspace 工作目录选择器：非只读 dropdown 选择/清除/历史，只读锁定态点击 shell.openPath 打开目录（cursor default 无动画） |
| [11-stream-retry.md](./chat/11-stream-retry.md)                     | 流式请求自动重试：agent 层指数退避（2s→4s→8s，默认 3 次）、失败清半截内容防重复、`ext.retryKey` 提示块随消息持久化；4xx（含 axios「status code 403」空壳）不重试 |
| [12-agent-context-compaction.md](./chat/12-agent-context-compaction.md) | 历史工具上下文紧凑化：请求构建时按 `toolContextRules` 注册表处理历史——写类同资源仅保留最后一次成功写完整原文、其余（含失败写）整对剔除，读类同资源仅保留最新（写入使旧读过期），仅历史消息生效、持久化原文不动；含两轮「args 中间态被模型复读」故障记录（占位串、删字段后的 `{}`，args 侧禁止任何改写） |

### memory/ —— 记忆

| 文档                                                          | 描述                                                                                                    |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| [01-memory-system.md](./memory/01-memory-system.md)           | 记忆系统（`~/.mistrelle/soul/`）：短期记忆空闲防抖提取 + `record_memory` 主动记录 + 设置页手动立即提取 → 每日 LLM 合并长期记忆（4000 字上限硬保护，合并前兜底补提）→ 主 Agent 独立 system 消息注入；state.json 提取进度与合并边界语义（下一个待消费日期，含边界）、首启基线不回溯 |

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
| [05-file-tools.md](./tool/05-file-tools.md)             | 文件系统工具：`image_info` 收敛为格式 / 宽高（去 size）、`file_stat` 基于 fs.stat 返回权威文件信息、`file_glob` / `file_grep` 主进程递归搜索（glob 匹配 + 内容正则，内置忽略目录与结果上限）           |
| [06-ego-browser-tools.md](./tool/06-ego-browser-tools.md) | ego-browser 工具：`ego_browser_run` 免审批包装 CLI（nodejs 子命令经 stdin 通道传 script，其余子命令 args 透传）、`ego_browser_exist` 只读探测安装状态；可执行文件路径解析（runtime.egoBrowser 配置 → 平台默认推断 → PATH 兜底）；`cliRun` 新增 `stdin` 选项 |
| [07-tool-policy.md](./tool/07-tool-policy.md)           | 工具安全策略注册与模块循环依赖约束：`registerToolPolicy` / `resolveToolPolicy` 机制、TDZ 崩溃根因（toolPolicy import 闭包拉入 chat/store 全量图）与修复（import 叶子化）、后续新增策略的约束 |
| [08-search-tools.md](./tool/08-search-tools.md)         | 搜索工具：`getDefaultTools()` 动态组装；`zhihu_search` 仅配置 Access Secret 时注入 + `any_search` 可匿名；账号设置知乎项与鉴权头 |

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

### todo/ —— 规划与待办

| 文档                                                                       | 描述                                                                                             |
|----------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| [01-design-agent-architecture.md](./todo/01-design-agent-architecture.md) | 海报设计 Agent 插件技术架构方案：双形态并存、项目/页面/设计图三层、编辑分层（基础+轻量分组/高级布局给 AI）、模板与复用清单 |

---

## 维护约定

- **新增文档**：新建 `docs/<模块>/<NN>-<名称>.md`，并同步在本文档对应分组下登记一行索引。
- **更新文档**：标题或职责变更时，同步修正本文档中的描述，避免索引与实际内容脱节。
- **删除文档**：同步移除本文档对应行。
