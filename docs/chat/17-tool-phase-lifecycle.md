# 17 - 工具调用四态生命周期（ToolPhase）

> 2026-08-28 落地。工具调用块级状态从「消息级状态连坐 + 三方拼凑判定」重构为显式四态单一事实源，
> UI 纯状态驱动渲染；同轮将 `AgentChat.ts`（1052 行）拆分为五个内聚模块。

## 一、事故复盘：为什么需要四态

### 根因：`setAssistantStatus` 无条件连坐最后一块 content

`agentMessages.ts` 的 `setAssistantStatus` 曾把消息级状态直接写到 `assistant.content` 的最后一块：

```ts
// 旧实现（已修）
assistant.status = status
const last = assistant.content?.[assistant.content.length - 1]
if (last) last.status = status   // ← 无守卫连坐
```

这行代码是两个 bug 的**唯一共同根因**：

1. **审批卡消失（显示「执行中」）**：toolcall 以 `pending` 入列（必然是 content 最后一块）→
   `agentStream.ts` 入列后立即 `setAssistantStatus(..., 'streaming')` → 该块被连坐成 `streaming` →
   审批分支 `markToolInteractive` 只写 `ext.interactive` 不改 status → 审批卡判定 `status === 'pending'`
   失败 → 按钮永不渲染，横幅（同判定）也不出现。单工具调用批次必然中招。
2. **「DB 全是 complete 而 UI 显示执行中」悬案**：step N 工具完成后，step N+1 开始时
   `setAssistantStatus(..., 'streaming')` 把已 `complete` 的最后一块改回 `streaming`。
   全部写入方盘点中（入列只写 pending、`markToolExecuting` 有 complete 守卫、
   `updateToolCallContent` 只写 complete、sweep 只写 complete/stop），这是唯一能把终态改回非终态的路径。

### 为什么改了几版都没好

历次修复全在下游打补丁：Confirm 卡从「桥匹配」改为「纯 status 三段式」、Ask 卡「pending/streaming 双认」、
Default/Shell 卡 `effectiveStatus` 终态覆盖（result 在场即按完成渲染）、sweep 收口收割、
`appendAssistantContent` 收窄只收尾文本前块。上游流氓写入方一直活着，status 字段永远不可信，
每个下游判定都在对冲它。**教训：块级状态出现异常时先盘点全部写入方，消灭旁路而不是加判定。**

## 二、四态模型

`domain/ChatMessage.ts`（独立命名 type，块级状态与消息级 `ChatMessageStatus` 彻底解耦）：

```ts
export type ToolPhase = 'pending' | 'confirm' | 'executing' | 'complete' | 'stop'
```

| 相位 | 语义 | 进入时机 |
|---|---|---|
| `pending` | 等待中：已入列未开始（同批其他工具执行中） | 流式接收 tool_calls 入列 |
| `confirm` | 审批中：等待用户决策（审批 / ask / font_pick 共用） | `markToolInteractive`（policy 裁决 `ask`，或 ask/font_pick 工具） |
| `executing` | 执行中：handler 运行 | `markToolExecuting`（免审批直通 / 审批通过后） |
| `complete` | 完成：结果已回填（含错误文案，以「错误:」前缀区分） | `updateToolCallContent`（applyResult 终态） |
| `stop` | 已停止：本轮中止未执行 | `sweepPendingToolCalls` 收口收割 |

生命周期：`pending → confirm → executing → complete`（confirm 仅交互工具经过）；任何相可直接被
sweep 收割为 `stop`。

### 写入方收敛（唯一推进者 = 执行器 agentTools / agentResume）

| 写入点 | 写入值 | 守卫 |
|---|---|---|
| `agentStream` 入列 | `pending` | — |
| `agentMessages.markToolInteractive` | `confirm`（同时写 `ext.interactive` kind） | — |
| `agentMessages.markToolExecuting` | `executing` | 已 complete 不回写 |
| `agentMessages.updateToolCallContent` | `complete` | — |
| `agentResume.sweepPendingToolCalls` | `complete`（补，有 result）/ `stop`（收割） | confirm 相跳过（resume 素材） |

**`setAssistantStatus` 只连坐文本类末块（text / markdown / thinking / reasoning），结构块（toolcall /
activity 等）永不触碰。** 这是本轮的灭根点。

### 旧数据归一：`toolPhaseOf(content)`

`ToolCallContent.status` 类型收窄为 `ToolPhase | ChatMessageStatus`（后者仅容纳历史落库值，
写入只允许 ToolPhase）。历史数据由 `toolPhaseOf` 归一，**所有判定点（渲染 / sweep / resume /
collectSubAgents）一律经它读取，禁止直接读 status 字段**：

- 新值（ToolPhase）直通；
- `pending` + `ext.interactive` → `confirm`（旧模型 pending 兼具等待审批语义）；
- `streaming` → 有 `result` 判 `complete`、有 `ext.interactive` 判 `confirm`、否则 `executing`；
- `error` → `stop`；`undefined` → `pending`。

### UI 纯状态驱动

| 卡片 | 判定 |
|---|---|
| `RChatTool`（分派） | `ext.interactive === 'confirm' && phase === 'confirm'` → ConfirmChatTool |
| `ConfirmChatTool` | `confirm` 出审批按钮（数据自持，不依赖桥激活匹配）；`pending`/`executing` 执行中占位 |
| `AskChatTool` / `FontPickChatTool` | `confirm` 即出表单 / 选字面板（并行交互全呈现，作答经 `bridge.resolve(toolCallId)` 定向兑现——桥支持排队项直接出队） |
| `DefaultChatTool` / `ShellChatTool` / `SubAgentChatTool` | 状态标签映射五相（等待中 / 审批中 / 执行中 / 完成 / 已停止） |
| `RChatList` 横幅 | 同分派判定，计数 + 「前往」定位 |

已撤补丁：`effectiveStatus` 渲染终态覆盖（Default / Shell）、`[ToolStat]` 探针 watch ×2、
Ask 卡「pending/streaming 双认 + 桥匹配」、Confirm 卡「仅 pending 出按钮」假设。
另将八张工具卡的 `ToolCallContent` 类型来源从 `@tdesign-vue-next/chat` 统一为 `@/domain`
（tdesign 侧 status 类型不含 ToolPhase，双类型结构不兼容）。

## 三、AgentChat 拆分（1052 → 445 行）

| 模块 | 职责 |
|---|---|
| `AgentChat.ts`（445） | 会话引擎门面：响应式状态、配置 setter 群、快照构造（toolSurface / promptContext）、协作面方法 |
| `agentLoop.ts`（225） | 循环编排：`executeAgentRequest`（begin → loop → sweep → 状态回写）、`runAgentLoop`、触顶收尾、错误处理 |
| `agentResume.ts`（131） | 恢复续跑：sweep 收口收割、`resumePendingInteractives`（重启恢复挂起决策）、`continueAgentRun` |
| `agentPrompts.ts`（279） | 全部提示词构建（`buildAgentRequestMessages` + 8 个私有组装函数），依赖经 `PromptContext` 快照显式传入 |
| `agentFunctions.ts`（166） | 函数表构建与洋葱解析（基础表 / 已装载 / toolRegistry 兜底）、模式过滤、schema 组装 |

依赖方向：`AgentChat → agentLoop → agentResume → agentLoop(值)` / `agentPrompts`、`agentFunctions`
无反向值依赖（loop / resume 对 `ToolChat` 仅 type import，无运行时环）。
`ToolChat` 上标注**【协作面】**的成员（`ctx` / `loadedCollections` / `mode` / `isSubAgent` /
`resolveModel` / `getFunctions` / `resolveForExecution` / `buildRequestMessages` 等）供 agent/ 内部
模块访问，不属于对外 API。

## 四、注意事项

1. **铁律：渲染端不可独信单一状态字段**——本轮之后 status 字段可信的前提是「执行器独占推进」。
   新增任何自动推进 toolcall 状态的代码，先盘点旁路 finalize（尤其 `setAssistantStatus` 类消息级收尾）。
2. `ext.interactive`（`'ask' | 'confirm' | 'font_pick'`）仍随消息持久化：既是 `confirm` 相的
   kind 标记（RChatTool 分派、resume 恢复），也是归一 helper 判定历史数据的依据，勿删。
3. 悬停审批块（confirm 相）跨重启恢复：`findPendingInteractiveToolcall` 找 confirm 相 →
   重新挂起等作答 → 复用同一条 assistant 消息续跑（`agentResume`）。
4. 停止语义区分（沿用 docs/chat/15）：`interactive.clear()` 产生的 `null` → 「本轮已停止，工具未执行」；
   用户明确拒绝 → 「用户拒绝了该工具调用」。
5. 类型上 `ToolCallContent.status` 联合保留 `ChatMessageStatus` 是**历史数据兼容的诚实声明**，
   新代码写入只允许 ToolPhase 字面量。
