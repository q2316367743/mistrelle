# 01 AI 请求统一模块

> 统一 AI 请求入口，替代 openai SDK（浏览器 fetch → 跨域）；按 `AiProvideFormat` 分发三种 API 格式，全部走 preload Node http 通道（免疫 CORS）。

## 背景与动机

- 旧实现用 `openai` SDK（`dangerouslyAllowBrowser: true`，内部浏览器 fetch 直连 provider）→ 受渲染层 CORS 约束。
- `plugin/http.ts` 的请求走 `window.preload.axios`（Node http 适配器，无 CORS），但此前**不支持流式 / 取消**。
- AI 设置新增 `format` 字段区分 3 种协议：`chat`（Chat Completions）、`responses`（Responses API）、`anthropic`（Messages API），但请求侧此前硬编码 chat.completions。

本模块解决两件事：**(1) 统一请求通道（CORS 豁免 + 流式 + 取消）；(2) 按 format 归一化三种协议**。

## 架构分层

```
modules/ai（渲染层：协议适配与 SSE 分帧）
  ├── service.ts      createChatStream / createChatCompletion / listAiModels
  ├── transport.ts    streamSseFrames：请求流 + SSE 帧产出 + 非 2xx 错误提取
  ├── sse.ts          SseParser：字节流 → { event?, data } 帧
  ├── formats/        三份适配器（chat / responses / anthropic），实现 AiFormatAdapter
  └── types.ts        归一类型（AiMessageParam / AiTool / AiStreamChunk / AiRequestParams）
        │
plugin/http.ts  requestStream()（泛型流式：status + 字节 AsyncIterable，break/abort 自动取消）
        │
preload/src/aiStream.ts  薄桥（streamRequest / streamAbort，axios responseType:'stream' 逐块回传 ArrayBuffer）
        │
Node http 适配器（无 CORS）
```

**职责边界**：preload 桥只做字节转发，不感知 AI 协议；SSE 分帧与三种格式归一化全在渲染层 `modules/ai`。

## 三种格式契约（已对照官方文档核实）

| 维度 | chat | responses | anthropic |
|---|---|---|---|
| 端点 | `{base}/chat/completions` | `{base}/responses` | `{base}/v1/messages` |
| 认证 | `Authorization: Bearer {key}` | 同左 | `x-api-key` + `anthropic-version: 2023-06-01` |
| 消息 | `messages[]`（system/user/assistant/tool） | `input[]`（message / function_call / function_call_output） | `messages[]` + system 提为顶层字段 |
| 工具 | `tools[]`（function.parameters） | `tools[]`（name/description/parameters 平铺） | `tools[]`（input_schema） |
| 思考 | `thinking:{type}` + `reasoning_effort` | `reasoning:{effort}`（none 关闭） | `thinking:{type:'enabled',budget_tokens}`（≥1024 且 max_tokens 大于它） |
| 必填 | — | — | `max_tokens`（适配器缺省 4096） |
| 流式收尾 | `data: [DONE]` | `response.completed / incomplete`（无 [DONE]） | `message_stop` |
| 文本增量 | `choices[0].delta.content` | `response.output_text.delta.delta` | `content_block_delta` `text_delta` |
| 思考增量 | `delta.reasoning_content` | `response.reasoning_summary_text.delta` | `content_block_delta` `thinking_delta` |
| 工具增量 | `delta.tool_calls[]`（index 累积） | `response.function_call_arguments.delta`（output_index）+ `output_item.done`（call_id/name） | `content_block_start`（id/name）+ `input_json_delta`（partial_json） |
| usage | 末 chunk（`stream_options.include_usage`） | `response.completed.response.usage` | `message_start`（input）+ `message_delta`（output） |
| finish_reason | `choices[0].finish_reason` | completed→stop / incomplete→length | `message_delta.delta.stop_reason`（end_turn→stop / max_tokens→length / tool_use→tool_calls） |

**归一化输出 `AiStreamChunk`**：消费形状对齐 openai ChatCompletionChunk（`usage?` / `choices[0].{finish_reason, delta.{content, reasoning_content, tool_calls}}`），下游 `streamAgentStep` 无需感知格式。

## 对外 API（`modules/ai/service.ts`）

```ts
createChatStream(params: AiRequestParams): AsyncGenerator<AiStreamChunk>  // 流式；signal.abort / 提前 break 均取消
createChatCompletion(params: AiRequestParams): Promise<AiCompletionResult> // 非流式（命名 / 总结）；内部走 createChatStream 流式聚合
listAiModels({ baseURL, apiKey, format }): Promise<Array<{ id: string }>> // GET {base}/models；anthropic 抛「不支持在线拉取」
```

`AiRequestParams`：`baseURL / apiKey / format / model / messages / tools / thinking / reasoningEffort / maxTokens / signal / headers / bodyOverride`。

- `bodyOverride`：`ChatServiceConfig.onRequest` 返回的 body 覆盖项（格式原生 body，spread 进请求体，优先级最高）。
- `format` 缺省按 `chat` 处理（`ResolvedChatRequestParams.format ?? 'chat'`，兼容旧配置无 format 字段）。
- `createChatCompletion` **不再发送 `stream: false`**：部分 OpenAI 兼容服务端（如本地 vLLM / llama.cpp 类）不支持非流式请求，会在传输前关闭连接，axios 抛 `ERR_BAD_RESPONSE`「stream has been aborted」。统一改由 `createChatStream`（`stream: true`）逐帧累积 `delta.content`，契约 `AiCompletionResult` 不变，`UseChatName` / `UseDiscussionName` / `summarize.ts` 调用方零改动。兜底：个别服务端对 `stream: true` 仍回非流式 JSON（无 delta 只有 `message`），`AiStreamChunk.choices[0].message` 字段兜底取完整内容。
- `createChatCompletion` **只累积 `delta.content` 正文，思考增量（`delta.reasoning_content`）不混入**：该入口服务命名 / 总结等短任务，思考型模型（未显式关思考时默认开启）的思考全文若拼进结果，会把标题 / 总结污染成"对用户输入的分析与回答"。`UseChatName` / `UseDiscussionName` 另显式传 `thinking: false` 关闭思考（chat 格式 → `body.thinking={type:'disabled'}`，与主链路用户关思考同路径，兼容性已验证）。

## 关键文件

| 文件 | 作用 |
|---|---|
| `src/preload/src/aiStream.ts` | 薄桥：`streamRequest(config, {onStart,onChunk})` + `streamAbort(requestId)`；AbortController 按 requestId 管理；Buffer 拷贝为独立 ArrayBuffer 再过桥 |
| `src/renderer/src/types/aiStream.d.ts` + `vite-env.d.ts` | `window.preload.aiStream` 类型 |
| `src/renderer/src/plugin/http.ts` | `requestStream(config)：Promise<{status, headers, stream}>`；队列异步迭代器 + signal→streamAbort + 提前退出自动取消 |
| `src/renderer/src/modules/ai/types.ts` | 归一类型（对齐 chat 形状） |
| `src/renderer/src/modules/ai/sse.ts` | `SseParser`：按空行分帧、多行 data 拼接、`[DONE]` 透传、flush 残余 |
| `src/renderer/src/modules/ai/transport.ts` | `streamSseFrames`：非 2xx 收集错误体抛 `HttpError`（`HTTP {status}: {message}`，附带 `status` 字段，导出 `isHttpError` 守卫供重试策略判 429/5xx）；TextDecoder 增量解码 |
| `src/renderer/src/modules/ai/formats/{chat,responses,anthropic}.ts` | 三份 `AiFormatAdapter`（buildRequest / normalizeChunk）；responses 需实例级状态（pendingArgIndices 对齐 done 事件的索引），anthropic 需实例级 usage 累积 → 用工厂 `createXxxAdapter()` 每请求新建 |
| `src/renderer/src/modules/ai/service.ts` | 对外 API + 适配器分发 |

## 消费方改造

- **流式**：`modules/chat/agent/agentStream.ts` `streamAgentStep` → `createChatStream`；请求体构建（含 thinking / stream_options）移交 chat 适配器；`onRequest` 覆盖 → `bodyOverride` / `headers`。
- **非流式**：`UseChatName` / `UseDiscussionName` / `subscribe/summarize.ts` → `createChatCompletion`（读 `option.format ?? 'chat'`）。
- **模型列表**：`pages/setting/ai/SettingAi.vue` `handleFetchModels` → `listAiModels`。
- **类型**：`agentTypes` / `agentContext` / `AgentChat` / `tokenEstimate` 的 openai 类型引用全部换为 `@/modules/ai` 的归一类型（`AiMessageParam` / `AiTool` / `AiToolCallParam`）。
- `SettingAiStore.AiProvideOption` 补 `format?: AiProvideFormat`；`ChatCommon.ResolvedChatRequestParams` 补 `format`。
- `package.json` 移除 `openai` 依赖。

## 注意事项

- 流式请求必须禁用 axios 整体超时：`aiStream.streamRequest` 强制 `timeout: 0`。axios 的 timeout 定时器在响应头到达后不会清除，会在响应体读取期间（AI 思考 / 长回答远超默认 30s）触发并 `request.destroy()`，导致流迭代抛 `AbortError`，被渲染层误判为主动取消（消息显示「已停止」）。流式超时 / 取消统一由渲染层 `AbortSignal` → `streamAbort` 控制（如 `AbortSignal.timeout(ms)`）。
- `aiStream.streamRequest` 必须 `validateStatus: () => true`：axios 默认把 4xx/5xx 当异常抛出，错误体是 Node stream，过不了 contextBridge，渲染层只剩「Request failed with status code 403」。放行后由 `transport.buildHttpError` 抽出服务端 `error.message`（如区域限制），并带上 `status` 供重试策略跳过普通 4xx。
- `http.ts` 的 `usePost` / `useGet` 第三参 `config` 类型要求 `url` 必填，需把 url 同时放进 config（沿用 `ImageGenerate.ts` 的写法）。
- 认证头由适配器缺省注入：chat / responses → `Authorization: Bearer {apiKey}`；anthropic → `x-api-key`。`AiRequestParams.headers`（`onRequest` 覆盖）优先级更高，可覆盖缺省认证。
- anthropic baseURL 归一：去尾部 `/`；若以 `/v1` 结尾再去掉，避免拼出 `/v1/v1/messages`。
- responses 的工具调用 id/name 只在 `output_item.done`（无 index）出现：用 `pendingArgIndices` 队列按完成顺序对齐 `function_call_arguments.delta` 的 output_index。
- 流式 `for await` 消费中 `return`（如 `seq` 抢占）会触发 generator finally → 自动 `streamAbort`，不会悬挂。
- 非 2xx（如 401/403）在 transport 层收集错误体并抛 `HttpError`（`HTTP {status}: {message}`），调用方无需感知流式/非流式差异。agent 流式重试只跟 429/5xx，其余 4xx 立即失败。
- AI 请求同样经 `httpRequestToAxiosConfig` 注入全局网络代理设置（`fillAxiosConfig`）与 User-Agent。
