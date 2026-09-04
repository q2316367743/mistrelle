# 12. 历史工具上下文紧凑化（整对剔除 + 过期）

> 模块：`chat/agent`。目标：回传给模型的工具历史不再携带冗余大字段，降低上下文 token。
> 核心原则：**只作用于请求构建，不动持久化**——磁盘 JSON（`~/.mistrelle/workspace/{chatId}/message/main.json`）完整保留 args / result 原文，UI 渲染、审计、重试不受影响。

## 1. 背景与问题

`toAgentRequestMessages`（`agentContext.ts`）回传历史时原样携带工具结果：同一文件被读 N 次就有 N 份全文；写入类工具的完整内容（如 `file_write.content`、`canvas_batch_edit.operations`）也随 args 全文回传。

原有瘦身机制 `ToolFunction.stripFields` 实际**从未生效**：消费方 `slimToolArgs` 查 `toolMap`，而 `file_write`（fileTools）、画布 / PPT / 文章 / 小说工具均为工厂动态组装、不在 `toolMap` 中。该机制已整体移除，由规则注册表取代。

## 2. 设计决策（已确认）

| 决策点 | 结论 |
|---|---|
| 写类历史处理 | **整对处理，禁止改写 args**。同资源键仅保留最后一次成功写的完整原文（tool_calls + tool result 整对回传，作为正确参数形态的参照样本）；更早的成功写、全部失败写**整对剔除**（tool_calls 条目与配对 `role:'tool'` 消息均不回传）。曾先后采用「替换为占位串」「删除大字段」两版，均触发模型复读故障（见 §5） |
| 写后旧读 | **写入使旧读取过期**：read A → write A → 结束时旧 read 标记过期，上下文永不包含比最新写入更旧的文件内容；模型需要时重读 |
| 生效范围 | **仅历史消息**（活跃 assistant 消息之前）；当前轮完整回传，保证轮内消息序列字节稳定（prompt 前缀缓存友好）、进行中任务不被自己刚写入的剔除打断 |

## 3. 架构

```
AgentChat.runAgentLoop（每步）
  └─ buildRequestMessages → toAgentRequestMessages(messages, activeId, refCtx)
        ├─ buildToolCallCompactPlan(messages, activeId)   ← 预扫描历史，产出紧凑化方案
        │     ToolCallCompactPlan {
        │       expiredToolCallIds: Set<string>   // result → 过期提示
        │       droppedToolCallIds: Set<string>   // 写类整对剔除（不回传）
        │     }
        └─ appendAssistantStep 回传时消费 plan：
              toolContents 先过滤掉 dropped / skill 类工具
              arguments = 原文 args（不改写）
              content   = expired ? EXPIRED_TOOL_RESULT_PLACEHOLDER : 原文
```

步内全部 toolcall 被剔除且无 text / reasoning 时整步跳过（`appendAssistantStep` 开头的空判天然覆盖）。

### 3.1 规则注册表（`modules/tool/contextRules.ts`，可扩展核心）

按**工具名**注册、与 ChatType 无关——未注入该工具的模式规则自然空转，无需改 `ChatTypeConfig`：

```ts
export interface ToolContextRule {
  resource?: (args, state) => string | undefined        // 读类：资源键，同键仅保留最新
  writeResource?: (args, state) => string | undefined   // 写类：资源键，同键仅保留最后一次成功写
  track?: (args, state) => void                         // 调用后更新游走状态
}
export interface ContextWalkState { canvasVersion?: number }
```

现行规则（资源键粒度）：

| 工具 | 资源键 / 行为 |
|---|---|
| `file_read` / `file_read_docx` / `file_read_xlsx` / `file_read_pdf` | `file:${path}`（同路径跨格式共享） |
| `file_write` / `file_write_xlsx` | writeResource `file:${path}` |
| `canvas_open` / `canvas_read` | `canvas:${version}`；open 另经 track 更新 `state.canvasVersion` |
| `canvas_get_nodes` / `canvas_batch_edit` | `canvas:${state.canvasVersion ?? '?'}`（无 version 参数，靠 open 的 track 定位） |
| `article_read` | `article:${id}` |
| `novel_read` / `novel_read_setting` | `novel:${id}` / `novel-setting:${id}` |
| `novel_character_upsert` | writeResource `novel-setting:${id}` |

**新增工具族**：在 `toolContextRules` 加条目即可；需要跨调用状态的在 `ContextWalkState` 加字段并配 `track`（参考 `canvas_open`）。

### 3.2 预扫描算法（`chat/agent/agentContextCompact.ts`）

两遍，均只遍历 `activeAssistantMessageId` **之前**的 assistant 消息：

1. **事件收集**（时间顺序）：每个 toolcall 查规则 → 解析 args（失败则跳过、保持原文回传）→ `resource` 记 read 事件（携带 result）→ `writeResource` 记 write 事件（携带 result）→ `track` 更新状态。
2. **读类新鲜度**：每个资源键取**最后事件**；若为 read 且结果非失败 → 该次读取保留原文；该键其余 read 全部进 `expiredToolCallIds`。
3. **写类保留判定**：每个资源键取**最后一次非失败 write** → 该次完整原文保留；其余全部 write（更早的成功写、所有失败写）进 `droppedToolCallIds` 整对剔除。

失败判定（`isFailedResult`）：结果为空、以 `{"error"` 开头（handler 返回 `{error}` 经 `serializeResult` 产出）、以 `错误` 开头（handler 抛错走 `runSingleTool` catch 分支）。失败读不承载内容也不改变资源状态；失败写无参数形态价值、直接剔除——这使**已中毒会话自愈**（历史里被污染产生的 `{}` 失败调用全部不再回传）。

无资源键（`writeResource` 返回 undefined）或 args 不可解析的写调用：不在事件流中，保持原文整对回传（保守兜底）。

## 4. 文案

- **读类过期结果**（整条替换，`EXPIRED_TOOL_RESULT_PLACEHOLDER`）：
  `[历史工具结果已省略：该资源后续已有更新的读取或写入，最新内容见后文；如需最新内容请重新调用相应读取工具]`

位于 `role:'tool'` 的自由文本侧，对模型的参数格式无示范作用。写类无任何文案——整对剔除后历史里不出现该调用，无需说明。

## 5. 故障记录：args 中间态会被模型逐字复读（两轮，已修复）

### 5.1 第一轮：占位串

首版把写类大字段**替换为占位字符串**（如 `operations: "<历史批量编辑操作已省略>"`）。上线后实测（会话 745302504190772224）：模型把 `canvas_batch_edit` 的 `operations`（schema 为数组）逐字复制成该字符串发出，工具报「操作必须是 JSON 对象」，模型自认为在发真实 JSON（思考原文：「我实际发送的参数没有被正确传递成 JSON 数组」），反复重试 **30+ 次**无法自拔；失败调用入库后再次回传，形成自我强化的死循环。

### 5.2 第二轮：字段删除后的空 `{}`

第二轮改为**整体删除字段**（`stripArgs: ['operations']`），并在 result 侧附「切勿复用本条参数形态」注记。上线后实测（2026-08-20，会话 745633862016566272）：`operations` 是 `canvas_batch_edit` 唯一参数，删完剩 `{}`——**类型合法**的空形态，比占位串更容易被模仿。68 次历史调用回传全是 `arguments:"{}"`，模型实际发出 **38 次**空调用（工具报「operations 不能为空」，思考里坚称「我的调用确实有 operations」），同样死循环。

### 5.3 根因与最终原则

**根因**：`assistant.tool_calls.arguments` 是模型模仿「上次怎么调」的格式示范，其权重压过 system 里的工具 schema 与 result 侧的自由文本指令。任何中间态改写——占位串（类型不符）或字段删除后的 `{}` / 半截参数（类型合法但语义残缺）——都会被当作合法形态复制进新调用。

**最终原则（新增工具规则时必须遵守）**：写类历史**只允许整对回传原文或整对剔除**，禁止对 `tool_calls.arguments` 做任何改写；说明性文本只能放 result 侧（但经验上对参数形态的纠偏作用有限，根治靠不出现坏形态）。

## 6. 注意事项

- **prompt 缓存**：历史位于稳定 system 前缀之后；「仅历史消息生效」使轮内消息序列字节稳定（轮内历史冻结）；跨轮历史紧凑化模式变化（新写发生后「保留最后一次写」边界移动）是特性固有的代价。
- **sub-agent**（`sub_{id}.json`）同样经 `toAgentRequestMessages`，自动获益。
- 与 `SKILL_TOOL_NAMES` 整体剥离、`truncateToolResult` 128KB 截断正交，三者叠加生效。
- `activeAssistantMessageId` 未命中（findIndex = -1）时 `index >= activeIndex` 恒真，紧凑化自动关闭，安全兜底。
- `canvas_inspect` / `canvas_export` 等未注册资源规则的工具 result 目前全量回传，是上下文消耗的另一潜在大头，需要时按 §3.1 补条目。

## 7. 关键文件

| 文件 | 职责 |
|---|---|
| `src/renderer/src/modules/tool/contextRules.ts` | 规则类型 + `toolContextRules` 注册表（单一数据源） |
| `src/renderer/src/modules/chat/agent/agentContextCompact.ts` | `buildToolCallCompactPlan` 预扫描 + 过期提示构造 |
| `src/renderer/src/modules/chat/agent/agentContext.ts` | 接入：构建 plan 并在 `appendAssistantStep` 消费（dropped 过滤 / expired 替换） |
