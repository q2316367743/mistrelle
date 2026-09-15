# 15 - ask 工具（询问用户）

> 更新：2026-09-15 —— 多选支持（`multiple` 参数）+ 修复「所有选项同时呈选中态」bug（option key 归一化）。

## 概述

`ask` 工具让模型在需要用户决策 / 补充信息时发起问答卡片：模型给出问题与 2-5 个候选选项，用户逐题作答（可选预设选项或自行输入），答案以文本形式回给模型。支持单问题与多问题（`questions` 数组）两种调用形态，2026-09-15 起支持按问题开启多选。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/renderer/src/windows/main/modules/tool/components/ask.ts` | 工具定义（name/description/parameters schema）、`normalizeAskArgs` 参数归一化、`formatAskResult` 结果格式化，schema 常量 `ASK_OPTIONS_PROPERTY` 供 UI 卡片共用 |
| `src/renderer/src/windows/main/modules/chat/agent/agentTools.ts` | 执行侧拦截：`runSingleTool` 中 `ASK_TOOL_NAME` 分支，`markToolInteractive('ask')` → `interactive.awaitDecision` 挂起等答案 → `applyResult` 回填（同时写 `ext.askItems` 供 UI 结果卡片渲染） |
| `src/renderer/src/windows/main/modules/chat/agent/interactive.ts` | `InteractiveBridge` 交互桥：`awaitDecision` 返回 Promise 挂起，UI `resolve(toolCallId, string[])` 兑现；支持排队项直接出队（并行 ask 各自作答） |
| `src/renderer/src/windows/main/components/chat/chat-assistant/tool/AskChatTool.vue` | 问答卡片容器：多问题循环、`allAnswered` 提交门控、跳过（resolve null）、结果态渲染（`ext.askItems` →「问题 → 答案」列表） |
| `src/renderer/src/windows/main/components/chat/chat-assistant/tool/AskChatQuestion.vue` | 单问题渲染：单选用 `t-radio-group`（缺省选第一项），多选用 `t-checkbox-group`（缺省全不选）；自定义答案输入框 |

## 数据契约

### 参数（模型 → 工具）

```ts
interface AskOption { key: string; label: string; description?: string }
interface AskQuestion { question: string; options: AskOption[]; multiple?: boolean }
interface AskArgs {
  question?: string          // 单问题模式题干
  options?: AskOption[]      // 单问题模式选项
  multiple?: boolean         // 单问题模式是否多选
  questions?: AskQuestion[]  // 多问题模式，提供后无需 question/options
}
```

- `multiple: true`（问题级或单问题顶层）= 用户可勾选多个选项；缺省单选。
- 多选答案以「、」连接成单字符串返回（如「选项A、选项B、自定义文本」），对模型而言仍是普通文本答案。

### 用户作答（UI → 桥 → 模型）

- `bridge.resolve(toolCallId, string[])`：按问题索引的答案数组（**存 label 文本而非 key**），`null` 表示跳过。
- 模型可见结果 = `formatAskResult(items)` 文本（`用户回答：\n1. 问题：…\n   回答：…`；全空 → `用户未回答，请自行判断或继续推进任务`）。
- UI 可见结构化数据写 `ext.askItems: AskAnswerItem[]`（`{ question, answer }`），**不进模型上下文**。

## 注意事项

### option key 必须归一化（防整组串选）

**Bug 案例**：模型偶尔漏发 option 的 `key`（或发重复 key），`AskChatQuestion` 的 radio `:value` 全为 `undefined`，tdesign 选中判定 `props.value === radioGroup.value` 使 `undefined === undefined` 恒真 → 所有选项同时高亮。

**修复**：`normalizeAskArgs` 内 `normalizeOptions` 统一兜底——key 取 `key ?? label ?? 丢弃`（label 为最终兜底）、冲突 key 追加 `-N` 后缀去重、label 缺失回退 key、两者全空剔除。UI（`AskChatTool`）与执行侧（`agentTools`）共用该函数，**任何消费 ask 参数的路径都必须经 `normalizeAskArgs`，禁止直接透传模型原始 options**。

### 交互细节

- 单选缺省选中第一个选项（答案恒非空）；多选缺省全不选，**至少勾选一项或填写自定义文本才能提交**（父组件 `allAnswered` 门控）。
- 自定义答案伪选项 key = `__custom__`：单选中与普通选项互斥（输入即切换）；多选中是可勾选的附加项（勾选自动聚焦输入框、输入自动勾选、取消勾选清空文本），可与普通选项叠加。
- 自定义输入框 `@click.stop` 防止点击触发行选中切换。
- `typecheck` 不校验 AskChatQuestion 对 `customInputRef`（结构化类型 `{ focus: () => void }`），t-input 实例暴露 `focus()`。

### 恢复与状态

- 应用重启后 `agentResume.resumePendingInteractives` 重新挂起未作答的 ask，作答链路不变。
- 消息块状态走四态 `ToolPhase`（confirm 相出表单），UI 纯 phase 驱动，见 docs/chat/17。
