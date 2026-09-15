# 01 子 Agent 模块

> ⚠️ 2026-09-15 场景注册表重构：本文所述 `global/ChatTypeConfig.ts`（CHAT_TYPE_CONFIG / WRITING_SCENE_CONFIG / DESIGN_SCENE_CONFIG / getSceneExcludedTools / getSceneSubAgentAllow / SUB_AGENT_ALLOW）已删除，配置迁移至 `src/renderer/src/windows/main/modules/chat/scenes/`（SceneDefinition 叶子场景定义）。现行契约见 [docs/chat/19](../chat/19-scene-registry-refactor.md)，本文以下内容为当时实现的历史记录。


> 独立、健壮的子 Agent 能力模块：按「能力类型 × 聊天类型」矩阵约束可派发的子 Agent，支持调研型 / 生图型。
> **生图型（2026-09-14 新增）**：`image` 型子 Agent 只做文生图（自行撰写英文描述 → `image_generate` → 落盘 → 返回路径），
> 能力面完全封闭（无记忆 / todo / ask / shell / 文件 / skill / 渐进装载器），需审批即自动拒绝。
> **2026-09-14 精简**：删除 design 型子 Agent（设计创意主对话本就直持画布工具，子 Agent 不重复该能力）；
> 底部 Agent tab 栏一并移除，子 Agent 聊天记录改在右侧侧栏以精简会话视图展示。

## 背景与动机

子 Agent 原先只是 `SubAgentRunner.ts` 中的单一函数 + `agentTools.ts` 里的一个拦截分支，能力单一（只读调研）、无法按场景差异化。
本次重构拆为独立模块，并引入能力矩阵：

- **调研型（research）**：只读调研 / 分析，返回结构化摘要（默认，行为与旧版一致）。
- **生图型（image）**：只做文生图，`image_generate` + `image_crop` + `image_info`，任务描述进来自行撰写生图提示词。
- **能力矩阵**：不同聊天类型允许派发的类型不同，防止无关能力泄漏。

## 模块结构

```
src/modules/subagent/
├── index.ts            # 对外导出
├── types.ts            # SubAgentType / SUB_AGENT_ALLOW 矩阵 / isSceneToolsOnlyAgent / SubAgentOptions / SubAgentResult / resolveSubAgentType
├── tool.ts             # spawn_agent 工具工厂（createSpawnAgentTool，按允许类型动态裁剪 schema）+ SPAWN_AGENT_TOOL_NAME
├── prompt.ts           # buildSubAgentSystemPrompt：按类型构建 systemPrompt（research / image）
├── runner.ts           # runSubAgent 主流程（创建 ToolChat、持久化 watcher、级联终止、摘要提取）
├── registry.ts         # 运行中子 Agent 注册表（UI 实时绑定消息流）
├── summary.ts          # extractFinalSummary：从消息提取最终摘要
└── persistence.ts      # chat_sub 表读写（buildChatSubKey = sub:{chatId}:{subId}）+ readSubAgentContent
```

> `policy.ts`（原 `SUB_AGENT_SCENE`：能力类型 → 聊天场景）已随 design 型一并删除：
> 删后各类型均无场景工具（research 只读、image 走专用集），`sceneType` 恒为 `undefined`，
> 该字段及 `AgentChat.sceneType` / `agentFunctions` 的 fallback 分支均成为死代码一并移除。

## 能力矩阵（单一数据源）

`types.ts` 中 `SUB_AGENT_ALLOW`：

| 聊天类型 | 允许的子 Agent 类型 |
|---|---|
| office（日常办公） | research |
| design（设计创意） | research（画布在主对话，子 Agent 不重复设计能力） |
| writing（写作） | research + **image**（文章封面 / 配图走生图型） |

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
   `subAgentType` 透传给 ToolChat（生图型据此走封闭工具面）。
4. 子 Agent 消息节流持久化到 `chat_sub` 表（`sub:{chatId}:{subId}`），完成后提取摘要返回主 Agent。

### 子 Agent 工具面注入

`AgentChat.getTypeTools()`：

- 主 Agent：按 `chatType` 注入（`CHAT_TYPE_CONFIG[chatType].tools`）。
- 子 Agent：查 `SUB_AGENT_TOOL_CONFIG[subAgentType]`（生图型 → 专用集）；未命中（research）→ 无场景工具。

### 权限模型

子 Agent 固定 `mode=0` + 禁用交互桥 + 策略上下文 `denyOnAsk: true`：

- safe 工具自动放行；白名单只读 shell 命令自动放行；
- **需审批操作**：`agentTools.runSingleTool` 见 `policyContext.denyOnAsk` 直接回填「该操作需要用户审批，本会话无审批通道，已自动拒绝」，
  不进 `interactive.awaitDecision`（子 Agent 交互桥本就禁用，等待必然落空）——与「用户拒绝」文案区分：前者是能力面限制；
- 安全中心黑名单同样生效；生图型的工具策略已在生图模块注册（可信区内放行），子 Agent 可直接产出，无需交互。

## 工具契约

`spawn_agent` 参数：

| 字段 | 类型 | 说明 |
|---|---|---|
| task | string（必填） | 委托任务描述，需自包含（路径 / 尺寸 / 产物保存路径等）；生图型只需「用途 + 内容要点 + 建议尺寸 + 绝对保存路径」，生图提示词由子 Agent 自行撰写 |
| type | string（可选） | 子 Agent 类型：research / image，缺省 research；仅当前聊天类型允许的类型可传 |

`resolveSubAgentType(raw, chatType)`：非法返回 `{ ok: false, message }`，拦截处直接回填工具结果，不让模型重试无意义的能力。

## 子 Agent 记录（右侧侧栏）

子 Agent 的聊天记录不再占据主消息区，也不再有底部 tab 栏，改为在**右侧内容侧栏**（`LChatAside` 所在区域）展示：

- **打开**：点消息流里的 `spawn_agent` 工具卡片（`SubAgentChatTool` 的 `view` 事件），或侧栏 office 面板「Agent 面板」里的条目
  （`AgentHistoryList` 的 `view-agent`），两者都写 `useChatSession.activeAgentId`；`LChatEngine` 的 `watch(activeAgentId)`
  在选中非 `main` 时自动展开侧栏。
- **展示**：`LChatAside` 首位分支 `v-if="subAgent"` 渲染 `SubAgentAside`（头部：状态点 + 任务摘要 + X 关闭按钮；
  主体 `SubAgentSession` 精简会话视图——任务块 + 文本 / 思考（默认折叠）/ 工具卡片 / 图片，窄栏紧凑排版）。
- **数据**：`useChatSession.activeSubAgentMessages` —— 运行中直接绑定注册表的实时 `messages`（streaming 刷新），
  已完成回落磁盘快照（`readSubAgentContent`）；运行态切换到完成态的瞬间由一个 watch 重载快照，避免突变为空。
- **关闭**：X 按钮 → `emit('close-sub-agent')` → `activeAgentId = 'main'`，侧栏回到正常会话面板（office / writing / design）。
- 主消息区**始终显示主 Agent 会话**（`RChatList` 绑 `messages`），查看子 Agent 不打断主对话浏览。
- 子 Agent 面板**不**自动弹开：仅在用户点入口时打开。

要点：

- 子 Agent 类型从主 Agent 消息里 `spawn_agent` 工具调用的 `args.type` 解析（缺省 `research`），见 `agentMessages.collectSubAgents` 的 `SubAgentInfo.type`。
  ⚠️ 该处类型收窄原写的是 `'research' || 'design'`（漏 `'image'`），已随本次改动修正为 `'research' || 'image'`，
  否则生图型子 Agent 会被误标为 research。

## 注意事项

- **循环依赖**：`subagent/runner → AgentChat → agentTools → subagent/runner` 存在环，
  `agentTools` 对 `runSubAgent` 保持动态 import（与旧实现一致）。
- `AgentChat` 只 import `subagent/tool` 与 `subagent/types`（纯常量 / 工厂，无环）。
- `useChatSession.ts` 从 `@/windows/main/modules/subagent` 导入 `readSubAgentContent` / `getRunningSubAgentMessages`。
- 新增能力类型：改 `SubAgentType` + `SUB_AGENT_ALLOW` + `prompt.ts` 分支 + `tool.ts` 的类型说明，
  若为封闭型再在 `isSceneToolsOnlyAgent` 与 `SUB_AGENT_TOOL_CONFIG` 各注册一处，一处数据源、处处生效。
