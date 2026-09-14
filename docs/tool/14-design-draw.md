# design_draw 工具（画布绘图）

> 2026-09-14 落地。`design_draw(prompt, path?, size?)` —— 以「设计创意画布 agent」为内核的绘图工具：
> 参数对齐生图接口，内部驱动一个**工具面封闭**的画布 agent 逐层构建设计图，跑完由 runner 导出 PNG，
> 产物以 `image` 内容块直接展示在对话中。

## 定位：为什么有了 image_generate 还要它

| | `image_generate`（扩散生图） | `design_draw`（画布绘图） |
|---|---|---|
| 产出方式 | 扩散模型一次成像 | 模拟设计师在画板上逐层绘制（几何图形 + 真实素材 + 精确排版） |
| 文案与版式 | 不可控，文字常渲染错误 | **精确可控**（文字是真实 text 节点，位置尺寸可核对） |
| 画面观感 | 强 AI 感 | 干净、无明显 AI 感 |
| 适用 | 写实插画 / 照片质感素材 | 海报 / 封面 / 社交配图 / 知识卡片 / 图文排版 |
| 依赖 | 服务端生图（需登录、扣积分） | 本地 leafer 渲染 + 用户自己的聊天模型额度 |

> 用户判断：**画布绘图比扩散生图高一档**——因为它没有 AI 感。两者互补而非替代，工具 description 与
> 类型提示词都写明了分工，由模型按用途自选。

## 参数契约

| 字段 | 类型 | 说明 |
|---|---|---|
| `prompt` | string（必填） | 绘图需求：用途与主题、需出现的文案、风格倾向、配色偏好（中文即可） |
| `path` | string | 输出 PNG 路径；缺省 `{sandbox}/outputs/images/design-{时间戳}.png` |
| `size` | string | 宽高（`1024x1024`）或比例（`16:9` / `1:1` / `3:4` / `2:3` / `9:16` / `2.35:1`）；缺省 `1024×1024` |

返回值（回传给模型的部分）：`{ success, path, width, height, size, note }`。
`chatImages` 为执行器消费标记，用于生成 `image` 内容块，回传模型前被剥离。

`resolveDesignDrawSize(raw)`：显式 `WxH` 原样采用；比例查 `RATIO_SIZE_MAP`（标准值见下）；非法/缺失回退方形。

| 比例 | 尺寸 | 比例 | 尺寸 |
|---|---|---|---|
| `1:1` | 1024×1024 | `16:9` | 1280×720 |
| `3:4` | 1080×1440 | `9:16` | 720×1280 |
| `4:3` | 1440×1080 | `2.35:1` | 900×383（公众号封面） |
| `2:3` | 1000×1500 | | |

## 实现结构

```
tool/components/canvas/designDraw.ts
├── DESIGN_DRAW_TOOL_NAME            # 'design_draw'
├── resolveDesignDrawSize(raw)       # size 解析
├── buildDesignDrawPrompt(size, ws)  # 内部 agent 专用系统提示词（模块内私有）
├── createDesignDrawTool()           # 对外工具定义（handler 占位）
├── runDesignDraw(options)           # 内部 runner：建 agent → 跑完 → 导出 PNG
└── registerToolPolicy(design_draw)  # 路径感知策略
```

### 为什么必须由 agentTools 拦截而非纯 handler

`ToolFunction.handler` 签名是 `(...params: unknown[]) => Promise<unknown>`，**拿不到**：
- `messages` → 取不到模型（`findLastUserModel`）
- `policyContext.abortSignal` → 用户点停止时无法级联中止内部绘制
- `policyContext.chatId` / `sandboxDir`

因此执行走 `chat/agent/agentTools.ts` 的 `DESIGN_DRAW_TOOL_NAME` 分支（与 `spawn_agent` 同款），
handler 只作占位并返回「应由引擎拦截处理」。

### 内部 runner 关键点

- **动态 import 断环**：`ChatTypeConfig → designDraw → AgentChat → agentFunctions → ChatTypeConfig` 成环，
  故 `runDesignDraw` 内部 `await import('.../AgentChat')` 取 `ToolChat`（与 `agentTools` 对 `runSubAgent` 同款做法）。
- **不注册运行中注册表**：绘制过程不可见（用户决策），故不调 `registerRunningSubAgent`，也不做节流持久化。
- **导出由 runner 负责**：内部 agent 的提示词明确「**不要 canvas_export**」——因为设计创意主提示词含
  「未经用户要求禁止导出」铁律（`canvasPrompt.ts:39`），本工具必须导出交付，故采用独立提示词并由 runner
  显式调用 `canvas_export` 的 handler（传沙盒内目标路径）。这也是**不复用 `buildDesignCanvasPrompt`** 的原因。
- **提示词另写明**「不要向用户提问、不要等待确认」——内部 agent 无交互通道，必须独立完成决策。
- 尺寸由 runner 给定并写入提示词（避免模型自选错尺寸）；`maxSteps = MAX_SUB_AGENT_STEPS`、
  `finalizeOnMaxSteps = true`；内部 agent 用**用户配置的聊天模型**（继承主会话最后一条 user 消息）。

## 安全模型（四层纵深）

> 本工具刻意**不提供**任何「自动批准全部 ask」的开关。内部 agent 处理外部输入触发的内容，
> 一旦全局放宽审批，安全中心黑名单（`toolPolicy.ts:217-223` 只把 allow 升级为 ask，不区分来源）
> 就会被静默绕过。因此采用四层收敛：

| 层 | 机制 | 作用 |
|---|---|---|
| 1 | **工具面物理封闭** `closedToolSurface: true` | 只暴露画布 + 设计素材工具，模型上下文里根本看不到 `file_*` / `cli_run` / `browser_*` / `ask` / `record_memory` / `spawn_agent` / 装载器；同时关闭渐进装载与执行期 `toolRegistry` 兜底 |
| 2 | **维持子 Agent 裁决** `isSubAgent: true` → `denyOnAsk` | 任何裁决为 `ask` 的调用一律自动拒绝（文案「本会话无审批通道，已自动拒绝」）；`deny` 照旧拦截；**安全中心黑名单继续生效** |
| 3 | **既有策略零放宽** | 内部 agent 不新增 / 不修改任何 `toolPolicy`。放行的只有「本聊天沙盒 / 工作空间内」的操作——`canvas_*`、`website_logo`、`font_list` 本就 `resolve: () => 'allow'`；`canvas_export` / `image_crop` / `image_remove_background` / `image_color_map` 走既有路径感知策略，越界即 `ask` → 被第 2 层拒绝 |
| 4 | **外层工具自身把关** | `design_draw` 注册路径感知策略：`path` 位于沙盒 / 工作空间 → allow，其余 → ask，由**主会话用户**审批 |

**能力面结论**：内部 agent 只能在本聊天沙盒内画图、读取可信区内已有图片、访问公开素材 API
（icon_svg / website_logo / font_list）。无法读写任意文件、无法执行命令、无法记忆、无法再派生子 Agent。

### 内部工具面（白名单）

- 画布：`canvas_list` / `canvas_read` / `canvas_create` / `canvas_open` / `canvas_delete` / `canvas_save` /
  `canvas_export` / `canvas_batch_edit` / `canvas_get_nodes` / `canvas_inspect` / `canvas_set_palette` / `canvas_guidelines`
- 设计素材：`icon_svg` / `website_logo` / `font_list` / `image_crop` / `image_remove_background` /
  `image_color_map` / `image_info` / `chart_generate`
- **排除**：`image_generate`（AI 感，与定位相斥）、`humanize_text`（与绘图无关）、
  `font_pick`（需弹出交互面板，无通道必然落空）

来源 = `createCanvasTools(ctx)` + `createDesignTools(ctx)` 过滤掉上述三项。

## 注入范围

- **office / writing** 注入（`CHAT_TYPE_CONFIG.office.tools` / `writing.tools`）；
- **design 不注入**：设计创意主对话本就直持画布工具，再包一层无意义；
- **不做登录门控**：纯本地绘制，消耗的是用户自己的聊天模型额度，与是否登录无关
  （对比 `image_generate` 需登录，因其走服务端生图并扣积分）。

### 文章场景：配图前先定方式

文章场景主 Agent 的工具面里只有 `design_draw`——**不持有** `image_generate`（后者仅在生图型
子 Agent 的能力面内，需经 `spawn_agent(type="image")` 派发）。据此 `articlePrompt.ts` 的配图段落
（步骤 5）要求：用户本轮已明确指定方式就直接采用，**未指定时先用 `ask` 询问一次**，在
「画布绘制（`design_draw`）」与「扩散生图（生图型子 Agent）」间二选一，再按选择走对应通道。
未登录时扩散生图不可用，该段落收窄为仅画布绘制单通道、不再询问。

> ⚠️ **不注册进 `toolGroups` / `toolMap`**：若注册，`toolRegistry` 第③层「执行期兜底」会让设计创意等
> 未注入场景的模型凭历史记忆幻觉调用 `design_draw` 并静默复装，破坏「design 不注入」的决策。
> `image_generate` 同样只走 ChatTypeConfig 注入、不入 registry，两者口径一致。
> 副作用：工具页（工具选择器）看不到它，属预期。

## 关键文件

| 文件 | 职责 |
|---|---|
| `windows/main/modules/tool/components/canvas/designDraw.ts` | 工具定义 + 提示词 + size 解析 + 内部 runner + 策略注册 |
| `windows/main/modules/chat/agent/agentTools.ts` | `design_draw` 拦截分支（校验 / 取模型 / 调 runner / 回填 chatImages） |
| `windows/main/modules/chat/agent/AgentChat.ts` | 新增 `closedToolSurface` 选项与透传 |
| `windows/main/modules/chat/agent/agentFunctions.ts` | `isClosedSurface` 泛化（基础表 / 已装载 / 执行期兜底三处） |
| `windows/main/modules/chat/agent/agentPrompts.ts` | 封闭面下不注入 skill 目录 / 工具集合目录 / todo 指导 |
| `global/ChatTypeConfig.ts` | office / writing 注入 + 类型提示词说明分工 |

## 注意事项

- **产物**：PNG 落盘 + `image` 内容块直出；`.canvas` 文件保留在沙盒 `outputs/`，可在设计创意页打开继续编辑。
- **单张**：一次一张图，不支持 `n`；暂不支持设计风格参数（后续可扩展 `style`）。
- **耗时**：绘制需若干步工具调用，比生图慢，工具 description 已提示模型「耗时较长」。
- **中止**：主 Agent 中止经 `parentSignal` 级联 `abortChat()`，runner 据 stop 抛「绘图已中止」。
- 内部 agent 的 `chatId` 传空串（不参与子 Agent 文件路径构建）；绘制期间不注册运行中注册表，
  因此侧栏「子 Agent 记录」不会出现该内部 agent（过程不可见是明确决策）。
