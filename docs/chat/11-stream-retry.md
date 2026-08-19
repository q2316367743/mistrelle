# 聊天流式请求自动重试（streamAgentStep）

> agent 单步流式请求失败后自动重试（指数退避 2s → 4s → 8s，默认最多 3 次），重试过程以提示块写入 assistant 消息并持久化，聊天记录可见「第几次重试」。主 Agent、子 Agent（`subagent/runner.ts`）、触顶收尾（`runFinalizeStep`）均经 `streamAgentStep`，一处生效全覆盖。

## 设计决策：重试放在 agent 层而非 http 层

`plugin/http.ts` 的 `requestStream` 是通用字节流层，重试在此无法把「第几次重试」写进聊天记录，也无法区分 4xx 与 5xx。`streamAgentStep` 是单步请求的完整消费点：能捕获错误、能按 `stepId` 清理失败尝试的半截内容、能向 assistant 消息追加提示——重试与记录展示在同一层闭环。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/renderer/src/modules/chat/agent/agentStream.ts` | 重试循环：`runOnce(stepId)` 单次尝试（原流消费逻辑）+ 外层 attempt 循环、`isRetryableError`、`abortableDelay` |
| `src/renderer/src/modules/chat/agent/agentMessages.ts` | `removeStepContents`（按 stepId 清半截内容）、`upsertStepNotice`（提示块原地更新 / 追加） |
| `src/renderer/src/modules/ai/transport.ts` | `HttpError = Error & { status }` 与 `isHttpError` 守卫（`buildHttpError` 构造时附带状态码） |
| `src/renderer/src/components/chat/chat-assistant/MChatAssistant.vue` | `isRetryNotice` 分支：提示块渲染为 `RefreshIcon` + 灰色状态行 |

## 错误分类

| 错误 | 行为 |
|------|------|
| AbortError / `signal.aborted` | 不重试，原样上抛（走既有「停止」路径） |
| HTTP 429、5xx（`isHttpError` 且 status 匹配） | 重试 |
| 其余 HTTP 4xx（401/403/400…） | 不重试，立即上抛（鉴权 / 参数错误，重试无意义） |
| 网络 / 流中断错误（无 status 的普通 Error） | 重试 |
| 非 Error 抛出值 | 不重试 |

## 重试流程（attempt 循环）

1. `stepId = nanoid()` 每次尝试新生成，`runOnce(stepId)` 内部逻辑与重构前一致；
2. catch 判定顺序：**中止 → 上抛**；**seq 过期（新一轮已开始）→ 返回 `cancelled`**；不可重试或已耗尽 → 上抛；
3. 进入重试：`removeStepContents(stepId)` 清掉本次尝试已写入的 thinking/markdown 半截内容（**必须清理**，否则重试成功后同段文本出现两遍；toolcall 块在流完成后才写入，天然不受影响）；
4. `upsertStepNotice` 写提示「请求出错（xxx），N 秒后自动重试（第 i/3 次）」；
5. `abortableDelay(retryInterval * 2^attempt, signal)` 等待，期间消息 status 保持 `streaming`（UI 加载动画持续）；等待中被中止则抛 AbortError 走停止路径。

## 提示块数据结构

```ts
{
  type: 'text',
  data: '请求出错（HTTP 429: rate limited），2 秒后自动重试（第 1/3 次）',
  ext: { retryKey: '<nanoid>' },  // 每个重试序列唯一
  time: 1234567890
  // 无 stepId：不参与 appendAssistantContent 的同 stepId 文本合并
}
```

- 同一序列内多次失败**原地更新**同一块（按 `retryKey` 全量查找——收尾时该块可能已被恢复后的正文盖住）；
- 结局文案：重试成功 → 「已自动重试 N 次，请求恢复」；耗尽 → 「已自动重试 N 次，仍未成功」（最终错误仍由 `handleRequestError` 追加，历史完整呈现全过程）；
- 提示块随消息经既有 throttledWatch 持久化，重启后仍可见；
- `MChatAssistant.finalContent` 判定排除 retryNotice，避免提示块被当作「最终回复」。

## 配置（ChatServiceConfig 既有字段，本次接上）

| 字段 | 默认 | 说明 |
|------|------|------|
| `maxRetries` | `3` | 最大重试次数（不含首次请求）；`0` 可关闭重试 |
| `retryInterval` | `2000` | 退避基准毫秒数，实际等待 `retryInterval * 2^已重试次数` |

## 注意事项

- `onRequest` 覆盖每个重试序列仅计算一次，重试复用相同请求参数；
- `continueAgent` 续跑同一 assistant 消息时，`retryKey` 唯一性保证不覆盖历史提示；
- 非 agent 消费方（会话命名 `createChatCompletion`、`requestStream` 其他调用方）不重试；
- 不解析 `Retry-After` 响应头（需跨层透传 headers，暂不引入）。
