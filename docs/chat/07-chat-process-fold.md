# 助理消息过程折叠（MChatAssistant）

> 助理消息完成后默认折叠执行过程：仅显示折叠条 + 最终回复，节省空间并减少渲染节点；无最终回复时（被中止 / 整轮只有 toolcall）折叠后仅显示折叠条 +「异常停止」提示。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/renderer/src/windows/main/components/chat/chat-assistant/MChatAssistant.vue` | 助理消息组件：过程折叠判定、折叠/展开渲染、异常停止提示 |

## 折叠判定逻辑

- `isCompleted`：`message.status === 'complete' | 'stop'`，或 `status === 'streaming'` 且 `isLoading` 为 false。
  - `isLoading` = 消息状态与会话状态同时处于 pending/streaming。
  - **为什么补 streaming 兜底**：点「停止」时 abort 若落在工具执行间隙，`runAgentLoop` 的循环因 `signal.aborted` 正常退出（非 AbortError 抛错），消息状态会残留 `streaming` 且不折叠。UI 用「会话不再运行」判定本轮已结束，兼容历史持久化的脏数据。
- 引擎侧 `AgentChat.executeRequest` 已在 abort 后显式 `setAssistantStatus('stop')`，新停止的消息落盘即为 `stop`；UI 兜底仅用于旧数据与残留状态。
- `finalContents`：最终回复集合，默认取 content 中**最后一条**非 `continueHint` / `retryNotice` 的 text/markdown（agent 循环最后一步的输出）。
- **record_memory 收尾锚定**：AI 常在回答结束后追加 `record_memory` 调用及收尾补充说明（常带一段简短收尾 thinking），回答可能被记忆调用切成上下两段。`finalContents` 判定规则：
  1. `isRecordMemoryCall`（`type === 'toolcall' && data.toolCallName === 'record_memory'`，硬编码风格与 RChatTool 一致）找**第一个** record_memory 的索引。
  2. 其后仍存在**非 record_memory 的 toolcall**（`hasWorkAfterMemory`）→ 记忆后还在继续执行，非收尾调用，维持默认逻辑，仅保留最后一条文本，避免「中途记忆后继续干活」场景把过程铺垫当结论。收尾 thinking **不计**为继续干活（记忆后跟收尾思考是模型常态，见 §渲染规则 的实战形状）。
  3. 否则视为收尾调用：**同时保留**第一个 record_memory 之前与之后的各最后一条文本（`findLastText` 倒序查找），兼容「结论放上」与「结论放下」两类模型；任一侧无文本时只保留另一侧，两侧都无则回退为空（触发「异常停止」）。
- `hasProcess`：content 中存在 `finalContents` 与 `continueHint` 之外的过程项（thinking / toolcall / 中间文本）。
- **`canCollapse` = `isCompleted && hasProcess`**：完成 + 有过程内容即可折叠，**不要求有最终回复**（此前要求有最终回复，导致中途停止、无文本回复的消息无法折叠，已修复）。
- `processCount`：thinking + toolcall 数量（不含最终回复），用于折叠条文案「已折叠执行过程（N 步）」。

## 渲染规则（`visibleContents`）

- 进行中（streaming/pending）：全量平铺，实时展示过程。
- 完成且折叠：仅保留 `finalContents`（收尾记忆时含上下两段）+ 全部 `continueHint`（继续按钮是操作入口，必须始终可见）；收尾的 record_memory 调用与其间 thinking 归入过程，折叠态不显示（仍计入 `processCount` 步数）。
  - **实战形状**（2026-08-24 依真实落库数据修正）：模型收尾常见 `[markdown(真正回答), toolcall(record_memory) × N, thinking(收尾思考), markdown(收尾备注)]`。此前「其后仍有 thinking → 走原逻辑」会把收尾备注当成最终回复折叠展示；随后改为只锚定记忆调用之前的回答；现改为**上下两段都保留**，收尾备注不再被折叠（结论放在记忆那一段之后的模型同样可见）。
- 完成且展开 / 无过程可折叠：全量。
- 无最终回复时的折叠态：`filter` 结果仅剩 continueHint，过程内容由折叠条 +「异常停止」提示（`showAbortedHint`）概括，避免折叠后空白无解释。

## 异常停止提示

- `showAbortedHint` = `isCompleted && !processExpanded && hasProcess && finalContents.length === 0`：无最终回复且处于折叠态时，在折叠条下方渲染 `ErrorCircleIcon`（`--td-error-color`）+「异常停止」。
- 展开后提示消失（此时过程内容全量可见，无需额外说明）。

## 注意事项

- `processExpanded` 默认 `false`（默认折叠），为消息级独立状态。
- 折叠文案、提示文案与图标均在组件内维护，改动需保持 tdesign token 风格（颜色使用 `--td-*` CSS Token）。
