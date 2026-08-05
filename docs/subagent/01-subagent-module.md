# 01 子 Agent 模块

> 独立、健壮的子 Agent 能力模块：按「能力类型 × 聊天类型」矩阵约束可派发的子 Agent，支持调研型 / 设计型。

## 背景与动机

子 Agent 原先只是 `SubAgentRunner.ts` 中的单一函数 + `agentTools.ts` 里的一个拦截分支，能力单一（只读调研）、无法按场景差异化。
本次重构拆为独立模块，并引入能力矩阵：

- **调研型（research）**：只读调研 / 分析，返回结构化摘要（默认，行为与旧版一致）。
- **设计型（design）**：用画布工具（canvas_*）创作配图 / 设计稿，产物落盘到可信区并返回路径。
- **能力矩阵**：不同聊天类型允许派发的类型不同，防止无关能力泄漏。

## 模块结构

```
src/modules/subagent/
├── index.ts            # 对外导出
├── types.ts            # SubAgentType / SUB_AGENT_ALLOW 矩阵 / SubAgentOptions / SubAgentResult / resolveSubAgentType
├── tool.ts             # spawn_agent 工具工厂（createSpawnAgentTool，按允许类型动态裁剪 schema）+ SPAWN_AGENT_TOOL_NAME
├── prompt.ts           # buildSubAgentSystemPrompt：按类型构建 systemPrompt（research / design）
├── policy.ts           # SUB_AGENT_SCENE：能力类型 → 聊天场景（design → 'design'，注入画布工具）
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
| writing（写作） | research + design（文章配图走 design 型） |

`spawn_agent` 工具按当前聊天类型动态裁剪 `type` 枚举（`AgentChat.getFunctions`），
拦截处再按矩阵兜底校验（`resolveSubAgentType`），双保险。

## 关键流程

### spawn_agent 调用链

1. 主 Agent 调用 `spawn_agent`（`type` 缺省 research）。
2. `agentTools.runSingleTool` 拦截：校验 task / 聊天上下文 → `resolveSubAgentType(args.type, policyContext.chatType)` 校验矩阵 →
   取最近 user 消息的模型 → `runSubAgent`。
3. `runSubAgent` 按能力类型构建子 Agent：`buildSubAgentSystemPrompt(workspace, type)` 选择 systemPrompt；
   `SUB_AGENT_SCENE[type]` 决定 `sceneType`（design → 'design'，注入画布工具）。
4. 子 Agent 消息节流持久化到 `message/sub_{subId}.json`，完成后提取摘要返回主 Agent。

### 子 Agent 场景工具注入

`AgentChat.getTypeTools()`：

- 主 Agent：按 `chatType` 注入（`CHAT_TYPE_CONFIG[chatType].tools`）。
- 子 Agent：仅当 `sceneType` 存在（design 型）时注入对应场景工具；research 型无场景工具。

### 权限模型

子 Agent 固定 `mode=0` + 禁用交互桥：

- safe 工具自动放行；白名单只读 shell 命令自动放行；
- 需审批操作因交互桥禁用自动拒绝；安全中心黑名单同样生效；
- design 型子 Agent 的 canvas 工具：canvas 安全策略已在 `canvasTools` 模块注册（sandbox/workspace 可信区内放行），
  子 Agent 可直接画图导出，无需交互。

## 工具契约

`spawn_agent` 参数：

| 字段 | 类型 | 说明 |
|---|---|---|
| task | string（必填） | 委托任务描述，需自包含（路径 / 尺寸 / 产物保存路径等） |
| type | string（可选） | 子 Agent 类型：research / design，缺省 research；仅当前聊天类型允许的类型可传 |

`resolveSubAgentType(raw, chatType)`：非法返回错误消息字符串，拦截处直接回填工具结果，不让模型重试无意义的能力。

## 注意事项

- **循环依赖**：`subagent/runner → AgentChat → agentTools → subagent/runner` 存在环，
  `agentTools` 对 `runSubAgent` 保持动态 import（与旧实现一致）。
- `AgentChat` 只 import `subagent/tool` 与 `subagent/types`（纯常量 / 工厂，无环）。
- `LChatEngine.vue` 从 `@/modules/subagent` 导入 `readSubAgentContent` / `getRunningSubAgentMessages`。
- 新增能力类型：改 `SubAgentType` + `SUB_AGENT_ALLOW` + `SUB_AGENT_SCENE` + `prompt.ts` 分支 + `tool.ts` 的类型说明，一处数据源、处处生效。
