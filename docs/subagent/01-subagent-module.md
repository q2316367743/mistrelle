# 01 子 Agent 模块

> 独立、健壮的子 Agent 能力模块：按「能力类型 × 聊天类型」矩阵约束可派发的子 Agent，支持调研型 / 设计型 / 生图型。
> **生图型（2026-09-14 新增）**：`image` 型子 Agent 只做文生图（自行撰写英文描述 → `image_generate` → 落盘 → 返回路径），
> 能力面完全封闭（无记忆 / todo / ask / shell / 文件 / skill / 渐进装载器），需审批即自动拒绝。

## 背景与动机

子 Agent 原先只是 `SubAgentRunner.ts` 中的单一函数 + `agentTools.ts` 里的一个拦截分支，能力单一（只读调研）、无法按场景差异化。
本次重构拆为独立模块，并引入能力矩阵：

- **调研型（research）**：只读调研 / 分析，返回结构化摘要（默认，行为与旧版一致）。
- **设计型（design）**：用画布工具（canvas_*）创作配图 / 设计稿，产物落盘到可信区并返回路径。
- **生图型（image）**：只做文生图，`image_generate` + `image_crop` + `image_info`，任务描述进来自行撰写生图提示词。
- **能力矩阵**：不同聊天类型允许派发的类型不同，防止无关能力泄漏。

## 模块结构

```
src/modules/subagent/
├── index.ts            # 对外导出
├── types.ts            # SubAgentType / SUB_AGENT_ALLOW 矩阵 / isSceneToolsOnlyAgent / SubAgentOptions / SubAgentResult / resolveSubAgentType
├── tool.ts             # spawn_agent 工具工厂（createSpawnAgentTool，按允许类型动态裁剪 schema）+ SPAWN_AGENT_TOOL_NAME
├── prompt.ts           # buildSubAgentSystemPrompt：按类型构建 systemPrompt（research / design / image）
├── policy.ts           # SUB_AGENT_SCENE：能力类型 → 聊天场景（design → 'design'；image → undefined，工具走专用集）
├── runner.ts           # runSubAgent 主流程（创建 ToolChat、持久化 watcher、级联终止、摘要提取）
├── registry.ts         # 运行中子 Agent 注册表（UI 实时绑定消息流）
├── summary.ts          # extractFinalSummary：从消息提取最终摘要
└── persistence.ts      # sub_{id}.json 读写 + readMainContent / readSubAgentContent
```

## 能力矩阵（单一数据源）

`types.ts` 中 `SUB_AGENT_ALLOW`：

| 聊天类型 | 允许的子 Agent 类型 |
|---|---|
| office（日常办公） | research |
| design（设计创意） | research（画布在主对话，子 Agent 不重复设计能力） |
| writing（写作） | research + design + **image**（文章封面 / 配图走生图型；design 型留给需要排版的画布稿） |

`spawn_agent` 工具按当前聊天类型动态裁剪 `type` 枚举（`AgentChat.getFunctions`），
拦截处再按矩阵兜底校验（`resolveSubAgentType`），双保险。

## 仅场景工具型子 Agent（生图型）

`types.ts` 的 `isSceneToolsOnlyAgent(type)` 是唯一判定源（当前 `image → true`）。判定为真时整条链路切换为**封闭工具面**：

| 环节 | 常规子 Agent | 生图型（封闭） |
|---|---|---|
| 工具面（`agentFunctions.buildBaseFunctions`） | 默认常驻 + 场景工具 + 用户勾选 + todo + 装载器 | **只 ** `ctx.functions` + `SUB_AGENT_TOOL_CONFIG[type]`（见 global/ChatTypeConfig），无默认常驻 |
| 渐进装载（`applyLoadedCollections`） | 已装载集合整组并入 | 直接返回（无装载器概念） |
| 执行期兜底（`resolveForExecution`） | toolRegistry 第三层兜底自动复装 | **关闭**：模型凭历史直呼未注入工具 → 直接「未找到工具」，不静默恢复 |
| 提示词（`agentPrompts`） | skill 目录 / 工具集合目录 / todo 指导 / 工作空间设定文件 | 全部不注入（只留 `## 文件系统` 段落供拼产物路径） |

专用工具集在组合根 `global/ChatTypeConfig.ts` 的 `SUB_AGENT_TOOL_CONFIG` 注册（`image` → `createImageSubAgentTools`），
工厂本体在 `tool/components/design/imageSubAgent.ts`。

## 关键流程

### spawn_agent 调用链

1. 主 Agent 调用 `spawn_agent`（`type` 缺省 research）。
2. `agentTools.runSingleTool` 拦截：校验 task / 聊天上下文 → `resolveSubAgentType(args.type, policyContext.chatType)` 校验矩阵 →
   **生图型额外校验登录态**（`hasImageGenerateAccess()`，未登录直接回填明确错误，不起空子 Agent）→
   取最近 user 消息的模型 → `runSubAgent`。
3. `runSubAgent` 按能力类型构建子 Agent：`buildSubAgentSystemPrompt(workspace, type)` 选择 systemPrompt；
   `SUB_AGENT_SCENE[type]` 决定 `sceneType`（design → 'design'，注入画布工具）；`subAgentType` 透传给 ToolChat
   （生图型据此走封闭工具面）。
4. 子 Agent 消息节流持久化到 `message/sub_{subId}.json`，完成后提取摘要返回主 Agent。

### 子 Agent 场景工具注入

`AgentChat.getTypeTools()`：

- 主 Agent：按 `chatType` 注入（`CHAT_TYPE_CONFIG[chatType].tools`）。
- 子 Agent：先查 `SUB_AGENT_TOOL_CONFIG[subAgentType]`（生图型 → 专用集）；未命中再看 `sceneType`
  （design 型 → 画布工具）；research 型两者皆无 → 无场景工具。

### 权限模型

子 Agent 固定 `mode=0` + 禁用交互桥 + 策略上下文 `denyOnAsk: true`：

- safe 工具自动放行；白名单只读 shell 命令自动放行；
- **需审批操作**：`agentTools.runSingleTool` 见 `policyContext.denyOnAsk` 直接回填「该操作需要用户审批，本会话无审批通道，已自动拒绝」，
  不进 `interactive.awaitDecision`（子 Agent 交互桥本就禁用，等待必然落空）——与「用户拒绝」文案区分：前者是能力面限制；
- 安全中心黑名单同样生效；design / image 型的工具策略已在各自模块注册（可信区内放行），子 Agent 可直接产出，无需交互。

## 工具契约

`spawn_agent` 参数：

| 字段 | 类型 | 说明 |
|---|---|---|
| task | string（必填） | 委托任务描述，需自包含（路径 / 尺寸 / 产物保存路径等）；生图型只需「用途 + 内容要点 + 建议尺寸 + 绝对保存路径」，生图提示词由子 Agent 自行撰写 |
| type | string（可选） | 子 Agent 类型：research / design / image，缺省 research；仅当前聊天类型允许的类型可传 |

`resolveSubAgentType(raw, chatType)`：非法返回错误消息字符串，拦截处直接回填工具结果，不让模型重试无意义的能力。

## 侧边栏联动（LChatAside）

侧边栏面板类型默认等于会话类型（`ChatType`），但会**跟随活动子 Agent 的能力类型联动**（`LChatEngine.vue` 的 `asideType` computed）：

- 切到 **design 型子 Agent**（如写作对话里的绘图子 Agent）→ 侧边栏切为画布面板（`DesignAside`），并自动展开，实时展示子 Agent 生成的画布 / 导出的图；
- 主 Agent 或 **research / image 型子 Agent** → 回落到会话类型面板（office / writing / design）。

要点：

- 子 Agent 类型从主 Agent 消息里 `spawn_agent` 工具调用的 `args.type` 解析（缺省 `research`），见 `agentMessages.collectSubAgents` 的 `SubAgentInfo.type`。
- design 子 Agent 与主 Agent 共用同一 `sandboxDir`，画布产物落盘 `{sandbox}/outputs/canvas-*.canvas`，`DesignAside` 按 sandboxDir 键控渲染，因此无需额外数据传递即可看到子 Agent 的画布。
- 侧边栏「Agent 记录」里的历史子 Agent 同样带 `type`，切换到它们时也会触发联动。

## 注意事项

- **循环依赖**：`subagent/runner → AgentChat → agentTools → subagent/runner` 存在环，
  `agentTools` 对 `runSubAgent` 保持动态 import（与旧实现一致）。
- `AgentChat` 只 import `subagent/tool` 与 `subagent/types`（纯常量 / 工厂，无环）。
- `LChatEngine.vue` 从 `@/modules/subagent` 导入 `readSubAgentContent` / `getRunningSubAgentMessages`。
- 新增能力类型：改 `SubAgentType` + `SUB_AGENT_ALLOW` + `SUB_AGENT_SCENE` + `prompt.ts` 分支 + `tool.ts` 的类型说明，
  若为封闭型再在 `isSceneToolsOnlyAgent` 与 `SUB_AGENT_TOOL_CONFIG` 各注册一处，一处数据源、处处生效。
