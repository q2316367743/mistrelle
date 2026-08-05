# 01 思考模式（DeepSeek）

> 支持 DeepSeek 思考模式：是否启用思考（`thinking`）+ 思考强度（`reasoning_effort`），覆盖主对话与子 Agent 链路。

## 背景与动机

DeepSeek 模型在输出最终回答前会先输出思维链（`reasoning_content`），可提升答案准确性，但会增加延迟与 token 消耗。
接入「是否思考」开关与「思考强度」选择器，让用户按需权衡。

## API 契约（已核实）

参考 [DeepSeek 官方文档](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion)（body 级参数，均随请求 body 透传）：

| 参数 | 类型 | 说明 |
|---|---|---|
| `thinking` | `{ type: 'enabled' \| 'disabled' }` | 思考模式开关，默认 `enabled` |
| `reasoning_effort` | `'low' \| 'high' \| 'max'` | 思考强度，默认 `high`；`medium` / `xhigh` 兼容映射为 `high` |

注意：

- openai-node SDK v6 无 `extra_body` 请求选项，但 body 序列化（`FallbackEncoder` → `JSON.stringify(body)`）会原样透传对象字段，
  因此把 `thinking` 直接放入请求 body 即可，无需额外处理。
- 流式响应思维链通过 `delta.reasoning_content` 返回，已由 `ChatCommon.extractReasoningContent` 处理并渲染为 `thinking` 内容块。
- 思考模式下不支持 `temperature` / `top_p` 等采样参数（传入不报错但不生效）。
- 工具调用场景：带 `tools` 的请求需在后续轮次完整回传 `reasoning_content`，否则 API 返回 400（当前实现由多轮拼接逻辑保证）。

## 字段设计（扁平字段）

业务侧不直接存 API 的 `thinking.type`，改为扁平布尔：

```ts
thinking?: boolean         // 是否启用思考（undefined 视为未设置，走服务端默认 enabled）
reasoning_effort?: ThinkingEffort // 'low' | 'high' | 'max'
```

- `src/domain/ChatMessage.ts`：新增 `ThinkingEffort` 类型；`UserMessage` / `AIMessage` 各增加 `thinking`、`reasoning_effort`。
- `src/modules/chat/engine/ChatCommon.ts`：`ChatRequestParams.message` 增加 `thinking`、`reasoning_effort`（类型由 `'high' | 'max'` 扩为 `ThinkingEffort`）。

## 请求构建

`src/modules/chat/agent/agentStream.ts` 的 `streamAgentStep` 构建 `AgentStreamingBody`：

```ts
if (typeof options.requestParams.message.thinking === 'boolean') {
  body.thinking = { type: options.requestParams.message.thinking ? 'enabled' : 'disabled' }
}
if (options.requestParams.message.reasoning_effort) {
  body.reasoning_effort = options.requestParams.message.reasoning_effort
}
```

- `AgentStreamingBody`（`agentTypes.ts`）交叉类型新增 `thinking?: { type: 'enabled' | 'disabled' }`。
- `thinking` 为 `undefined` 时不传，走服务端默认（enabled），保证旧消息 / 旧链路行为不变。

## UI 与链路

`src/components/chat/AiModelSelect.vue`：在弹窗「模型设置」上方新增设置块：

- `t-switch`：思考模式开关（`v-model:thinking`）。
- `t-radio-group`（button 风格）：思考强度 低 / 高 / 最高（`v-model:effort`），思考关闭时禁用。

链路：

```
AiModelSelect (v-model:thinking / v-model:effort)
  → LChatSender.buildUserMessage → ChatRequestParams.message
  → AgentChat.sendUserMessage → UserMessage + AIMessage（createPendingAssistantMessage）
  → agentStream.streamAgentStep → AgentStreamingBody
```

- `AgentChat.buildResumeRequestParams` 从存储的 `userMessage` 恢复 `thinking` / `reasoning_effort`，保证 resume 续跑一致。
- `createPendingAssistantMessage`（`agentMessages.ts`）新增可选 `thinking` / `reasoningEffort`，随请求写入 assistant 消息供持久化。

## 子 Agent 继承

`spawn_agent` 派发的子 Agent 继承主 Agent 的思考配置：

- `agentTools.ts` `findLastUserModel` 增加 `thinking` 字段并透传给 `runSubAgent`。
- `subagent/types.ts` `SubAgentOptions` 增加 `thinking?: boolean`。
- `subagent/runner.ts` 解构 `thinking` 写入子 Agent 的 `ChatRequestParams.message.thinking`。

## 关键文件

| 文件 | 作用 |
|---|---|
| `src/domain/ChatMessage.ts` | `ThinkingEffort` 类型；消息字段 |
| `src/modules/chat/engine/ChatCommon.ts` | `ChatRequestParams` 请求参数 |
| `src/modules/chat/agent/agentTypes.ts` | `AgentStreamingBody` 类型 |
| `src/modules/chat/agent/agentStream.ts` | 按 thinking 构建请求 body |
| `src/components/chat/AiModelSelect.vue` | 思考开关 + 强度选择器 UI |
| `src/components/chat/sender/LChatSender.vue` | 接线发送参数 |
| `src/modules/chat/agent/AgentChat.ts` | 消息写入 / resume 恢复 |
| `src/modules/chat/agent/agentTools.ts`、`src/modules/subagent/{types,runner}.ts` | 子 Agent 继承 |

## 注意事项

- 开关默认开启（`true`）、强度默认 `high`，与 DeepSeek 服务端默认一致。
- 仅 `deepseek-v4-flash` 支持三档强度；`deepseek-v4-pro` 目前只支持 `high` / `max`（`low` 按 `high` 处理），服务端会自动映射，无需前端感知。
- 切换模型时思考配置不随模型重置，用户自定义值直接透传；如需按模型记忆可在后续版本扩展。
