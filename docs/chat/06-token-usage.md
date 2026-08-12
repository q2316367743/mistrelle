# 06 · Token 用量记录与上下文占用展示

## 背景与目标

- 每条 AI 回复记录自己消耗了多少 token（API `usage` 字段）。
- 发送栏按钮展示「当前上下文占用」：当前对话所有消息 + system 前缀占模型上下文窗口的比例，用于判断何时该新开聊天。
- 点击按钮弹出面板，展示上下文按来源拆分的构成明细（系统提示词 / 工具及子智能体 / 对话消息 / 技能）。

### 口径说明

- **当前上下文** = 最近一次请求发送给模型的全部内容 token 数（≈ API 返回的 `usage.prompt_tokens`）。
  它只存在一个（每次请求都传全部历史），不存在「总上下文」与「当前上下文」两种上下文——需要区分的是
  「窗口占用」（本次请求会花多少）与「累计消耗」（会话所有请求的总和，远超窗口）。
- 本项目只展示**窗口占用**：上下文接近窗口上限时应新开聊天。
- 四类明细 API 不返回，需**本地估算**（按文本估算 token）后**归一化**到 API 精确的 `prompt_tokens`。

---

## 数据流

```
OpenAI 流式响应 chunk.usage
  → agentStream.ts 捕获（需请求体 stream_options.include_usage=true）
  → StreamStepResult.usage
  → AgentChat.runAgentLoop / runFinalizeStep 每步 setAssistantUsage（累计）
  → 完成时 estimateAndStoreBreakdown（估算四类 + 归一化到 promptTokens）
  → AIMessage.usage / AIMessage.tokenBreakdown（随消息持久化）
  → LChatEngine.tokenUsage computed（取最后一条 assistant 消息）
  → LChatSender 按钮圆环 + TokenUsagePanel 弹窗
```

---

## 类型契约

`src/domain/ChatMessage.ts`：

```ts
export interface ChatUsage {
  promptTokens: number      // 最近一步的 prompt（≈当前上下文大小）
  completionTokens: number  // 各步累加
  totalTokens: number       // 各步累加
}
export interface TokenBreakdown {
  system: number        // 系统提示词
  tools: number         // 工具及子智能体
  conversation: number  // 对话消息
  skills: number        // 技能
}
```

`AIMessage` 新增：`usage?: ChatUsage`、`tokenBreakdown?: TokenBreakdown`。

- 两条字段随消息 JSON 持久化（`ChatSessionManager.persist` 走 `toRaw(messages)`），应用重启后自动恢复。
- agent loop 多步调用时：`promptTokens` 取**最近一步**（上下文随步骤增长，代表完整上下文）；
  `completionTokens` / `totalTokens` 各步累加。

---

## 关键实现

### 1. 捕获 usage：`src/modules/chat/agent/agentStream.ts`

- 请求体新增 `stream_options: { include_usage: true }`（OpenAI 标准机制，`onRequest` 可覆盖）。
- 流式循环中在 `if (!choice) continue` **之前**读取 `chunk.usage`（usage 出现在带 include_usage 的末个
  chunk，choices 为空）。`StreamStepResult` 新增 `usage` 返回。

### 2. 写入消息：`src/modules/chat/agent/agentMessages.ts`

- `setAssistantUsage(messages, messageId, usage)`：累计写 `usage`。
- `setAssistantTokenBreakdown(messages, messageId, breakdown)`：写 `tokenBreakdown`。

### 3. 估算构成：`src/utils/tokenEstimate.ts`

- `estimateTokens`：从 `GroupChatEngine.ts` 迁移来的通用估算（CJK 约 1 token/字，其余约 1 token/4 字符）。
  `GroupChatEngine` 与 `GroupChatContextBar` 的 import 已同步更新，不再重复定义。
- `formatTokens(n)`：`≥1m → "1.0m"`、`≥1k → "192.0k"`、否则原值。
- `estimateTokenBreakdown(apiMessages, tools, skillCatalogPrompt)`：
  - 系统提示词 = 全部 system 消息（**减去**技能目录文本）
  - 对话消息 = user / assistant 消息文本
  - 工具及子智能体 = tool 结果 + assistant tool_calls 参数 + 工具定义 JSON（spawn_agent 摘要作为 tool 结果计入）
  - 技能 = 技能目录（`buildSkillCatalogPrompt`）+ `load_skill` / `read_skill_file` 的工具结果
    （第一遍先收集 `tool_call_id → 工具名` 映射，再给 tool 结果归类）
- `normalizeTokenBreakdown(breakdown, targetTotal)`：按占比缩放并修正取整误差，使四类之和**严格等于**
  `promptTokens`。

### 4. 引擎记录：`src/modules/chat/agent/AgentChat.ts`

- `buildRequestMessages` 缓存 `this.lastSkillCatalogPrompt`（供估算时拆分技能目录）。
- `runAgentLoop` 每步记录 `result.usage`；无工具调用收尾时调用 `estimateAndStoreBreakdown`。
- `runFinalizeStep`（触顶收尾）同样记录 usage 并估算。
- `estimateAndStoreBreakdown`：`usage` 或 `apiMessages` 缺失时跳过（避免渲染全 0 明细）。

### 5. UI 接入

- `src/components/chat/LChatEngine.vue`：
  - `tokenUsage` computed：取**最后一条 assistant 消息**的 `usage.promptTokens` 为 `contextTokens`，
    `contextWindow` = `optionMap.get(modelKey)?.context || DEFAULT_CONTEXT_WINDOW`。
  - 传给 `LChatSender` 的 `token-usage` prop。
- `src/components/chat/sender/LChatSender.vue`：
  - 按钮：`t-popup trigger="click"` 包住圆形 `t-progress`，圆环 percentage = `contextTokens / contextWindow`，
    旁显示 `formatTokens(contextTokens)`。
- `src/components/chat/sender/TokenUsagePanel.vue`（弹窗内容）：
  - 头部：`13% 已使用 25.0k/192.0k`
  - 分段进度条：四段宽度 = 各分类 token / contextWindow，颜色与明细圆点一致
  - 四行明细：圆点 + 标签 + 百分比（各分类 token / contextWindow）

### 6. 常量：`src/global/Constant.ts`

- `DEFAULT_CONTEXT_WINDOW = 192_000`：模型未配置 `AiModel.context` 时兜底。

---

## 注意事项

- `AiModel.context`（总上下文大小）目前**没有 UI 写入**，`optionMap.get(...)?.context` 基本为空，
  实际几乎都走 `DEFAULT_CONTEXT_WINDOW`（192k）。如需每个模型单独配置窗口，需另加设置项。
- 删除历史消息后，`tokenUsage` 仍取最后一条 assistant 消息的旧 `prompt_tokens`，会**偏大**（无新请求、
  API 不会重算）；该消息存在即展示，删除到无 assistant 消息时隐藏。
- 部分厂商不支持 `stream_options.include_usage`：此类接口流式末尾无 usage，`AIMessage.usage` 保持
  undefined，UI 自动隐藏（`tokenUsage` 为 undefined）。`onRequest` 可覆盖 body 去掉该字段。
- 工具结果分类依赖 `tool_call_id → 工具名` 映射，要求 assistant 的 tool_calls 与 tool 消息成对出现
  （`agentContext.appendAssistantStep` 保证），历史异常数据可能归类不准，仅影响估算精度。
