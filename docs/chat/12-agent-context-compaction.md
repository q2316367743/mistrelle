# 12. 历史工具上下文紧凑化（瘦身 + 过期）

> 模块：`chat/agent`。目标：回传给模型的工具历史不再携带冗余大字段，降低上下文 token。
> 核心原则：**只作用于请求构建，不动持久化**——磁盘 JSON（`~/.mistrelle/workspace/{chatId}/message/main.json`）完整保留 args / result 原文，UI 渲染、审计、重试不受影响。

## 1. 背景与问题

`toAgentRequestMessages`（`agentContext.ts`）回传历史时原样携带工具结果：同一文件被读 N 次就有 N 份全文；写入类工具的完整内容（如 `file_write.content`、`canvas_batch_edit.operations`）也随 args 全文回传。

原有瘦身机制 `ToolFunction.stripFields` 实际**从未生效**：消费方 `slimToolArgs` 查 `toolMap`，而 `file_write`（fileTools）、画布 / PPT / 文章 / 小说工具均为工厂动态组装、不在 `toolMap` 中。该机制已整体移除，由规则注册表取代。

## 2. 设计决策（已确认）

| 决策点 | 结论 |
|---|---|
| 写类参数瘦身方式 | **整体删除字段 + 结果侧省略注记**。曾采用「替换为占位串」上线即触发模型复读故障（见 §5），已废弃 |
| 写后旧读 | **写入使旧读取过期**：read A → write A → 结束时旧 read 标记过期，上下文永不包含比最新写入更旧的文件内容；模型需要时重读 |
| 生效范围 | **仅历史消息**（活跃 assistant 消息之前）；当前轮完整回传，保证轮内消息序列字节稳定（prompt 前缀缓存友好）、进行中任务不被自己刚写入的占位参数打断 |

## 3. 架构

```
AgentChat.runAgentLoop（每步）
  └─ buildRequestMessages → toAgentRequestMessages(messages, activeId, refCtx)
        ├─ buildToolCallCompactPlan(messages, activeId)   ← 新：预扫描历史，产出紧凑化方案
        │     ToolCallCompactPlan {
        │       expiredToolCallIds: Set<string>      // result → 过期提示
        │       slimmedArgs: Map<id, string>         // args 删除大字段后的字符串
        │       omittedArgFields: Map<id, string[]>  // 被删字段名 → 结果侧注记
        │     }
        └─ appendAssistantStep 回传时消费 plan：
              arguments = slimmedArgs.get(id) ?? 原文
              content   = expired ? EXPIRED_TOOL_RESULT_PLACEHOLDER
                        : omitted  ? result + 省略注记
                        : 原文
```

### 3.1 规则注册表（`modules/tool/contextRules.ts`，可扩展核心）

按**工具名**注册、与 ChatType 无关——未注入该工具的模式规则自然空转，无需改 `ChatTypeConfig`：

```ts
export interface ToolContextRule {
  stripArgs?: string[]                                  // 写类：args 大字段，历史回传时整体删除
  resource?: (args, state) => string | undefined        // 读类：资源键，同键仅保留最新
  writeResource?: (args, state) => string | undefined   // 写类：使同资源更早读取过期
  track?: (args, state) => void                         // 调用后更新游走状态
}
export interface ContextWalkState { canvasVersion?: number }
```

首版规则（资源键粒度）：

| 工具 | 资源键 / 行为 |
|---|---|
| `file_read` / `file_read_docx` / `file_read_xlsx` / `file_read_pdf` | `file:${path}`（同路径跨格式共享） |
| `file_write` / `file_write_xlsx` | stripArgs（`content` / `sheets`）+ writeResource `file:${path}` |
| `canvas_open` / `canvas_read` | `canvas:${version}`；open 另经 track 更新 `state.canvasVersion` |
| `canvas_get_nodes` / `canvas_batch_edit` | `canvas:${state.canvasVersion ?? '?'}`（无 version 参数，靠 open 的 track 定位） |
| `ppt_get_nodes` / `ppt_batch_edit` | `ppt:${pptId}:${slideId}` |
| `article_read` | `article:${id}` |
| `novel_read` / `novel_read_setting` | `novel:${id}` / `novel-setting:${id}` |
| `novel_character_upsert` | stripArgs（`content`）+ writeResource `novel-setting:${id}` |

**新增工具族**：在 `toolContextRules` 加条目即可；需要跨调用状态的在 `ContextWalkState` 加字段并配 `track`（参考 `canvas_open`）。

### 3.2 预扫描算法（`chat/agent/agentContextCompact.ts`）

两遍，均只遍历 `activeAssistantMessageId` **之前**的 assistant 消息：

1. **事件收集**（时间顺序）：每个 toolcall 查规则 → 解析 args（失败则跳过）→ `resource` 记 read 事件（携带 result）→ `writeResource` 记 write 事件 → `track` 更新状态 → 有 `stripArgs` 的删除字段、记录 `slimmedArgs` 与 `omittedArgFields`（仅当至少一个字段真实存在）。
2. **新鲜度判定**：每个资源键取**最后事件**；若为 read 且结果非失败 → 该次读取保留原文；该键其余 read 全部进 `expiredToolCallIds`。

失败读取（`isFailedResult`）不承载内容也不改变资源状态，排除标准：结果为空、以 `{"error"` 开头（handler 返回 `{error}` 经 `serializeResult` 产出）、以 `错误` 开头（handler 抛错走 `runSingleTool` catch 分支）。因此「read 成功 → read 失败」场景下成功那份仍是新鲜保留。

## 4. 文案

- **读类过期结果**（整条替换，`EXPIRED_TOOL_RESULT_PLACEHOLDER`）：
  `[历史工具结果已省略：该资源后续已有更新的读取或写入，最新内容见后文；如需最新内容请重新调用相应读取工具]`
- **写类省略注记**（追加在配对工具 result 末尾，`appendOmittedArgsNote`）：
  `[系统注：为节省上下文，该历史调用的 operations 参数原文已省略，本条参数不完整；新调用请按工具 schema 重新构造完整参数，切勿复用或参照本条参数形态]`

两条均位于 `role:'tool'` 的自由文本侧，对模型的参数格式无示范作用。

## 5. 故障记录：占位串会被模型逐字复读（已修复）

首版实现把写类大字段**替换为占位字符串**（如 `operations: "<历史批量编辑操作已省略>"`）。上线后实测（会话 745302504190772224）：模型把 `canvas_batch_edit` 的 `operations`（schema 为数组）逐字复制成该字符串发出，工具报「操作必须是 JSON 对象」，模型自认为在发真实 JSON（思考原文：「我实际发送的参数没有被正确传递成 JSON 数组」），反复重试 **30+ 次**无法自拔；失败调用入库后再次回传，形成自我强化的死循环。

**根因**：`assistant.tool_calls.arguments` 是模型模仿「上次怎么调」的格式示范，出现类型不符的占位串即被当作合法形态复制；而 `role:'tool'` 的 result 是自由文本、无此风险。

**修复**：写类改为**整体删除字段**（不给任何可复制的值），省略说明与「切勿复用」指令移到配对工具 result 末尾。删除式处理同时**自愈已中毒会话**——历史里的占位串调用回传时字段同样被删除。

**教训（新增工具规则时必须遵守）**：任何进入 `tool_calls.arguments` 的历史改写都必须保持 schema 类型合法且不含「看似有意义的假值」；说明性文本一律放 result 侧。

## 6. 注意事项

- **prompt 缓存**：历史位于稳定 system 前缀之后；「仅历史消息生效」使轮内消息序列字节稳定（轮内历史冻结）；跨轮历史紧凑化模式变化是特性固有的代价。
- **sub-agent**（`sub_{id}.json`）同样经 `toAgentRequestMessages`，自动获益。
- 与 `SKILL_TOOL_NAMES` 整体剥离、`truncateToolResult` 128KB 截断正交，三者叠加生效。
- `activeAssistantMessageId` 未命中（findIndex = -1）时 `index >= activeIndex` 恒真，紧凑化自动关闭，安全兜底。

## 7. 关键文件

| 文件 | 职责 |
|---|---|
| `src/renderer/src/modules/tool/contextRules.ts` | 规则类型 + `toolContextRules` 注册表（单一数据源） |
| `src/renderer/src/modules/chat/agent/agentContextCompact.ts` | `buildToolCallCompactPlan` 预扫描 + 过期提示 / 省略注记构造 |
| `src/renderer/src/modules/chat/agent/agentContext.ts` | 接入：构建 plan 并在 `appendAssistantStep` 消费 |
| `src/renderer/src/domain/ChatTool.ts` | 已删 `stripFields`（孤儿清理，同 file.ts / fileParse.ts） |
