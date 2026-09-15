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
- `finalContent`：最终回复，默认取 content 中**最后一条**非 `continueHint` / `retryNotice` 的 text/markdown（agent 循环最后一步的输出）。
- **record_memory 收尾锚定**：AI 常在回答结束后追加 `record_memory` 调用及收尾补充说明（常带一段简短收尾 thinking），此时最后一条文本并非真正回答。`finalContent` 判定规则：
  1. `isRecordMemoryCall`（`type === 'toolcall' && data.toolCallName === 'record_memory'`，硬编码风格与 RChatTool 一致）找**第一个** record_memory 的索引。
  2. 其后仍存在**非 record_memory 的 toolcall**（`hasWorkAfterMemory`）→ 记忆后还在继续执行，非收尾调用，维持默认逻辑，避免「中途记忆后继续干活」场景回退。收尾 thinking **不计**为继续干活（记忆后跟收尾思考是模型常态，见 §渲染规则 的实战形状）。
  3. 否则视为收尾调用：最终回复锚定到**第一个** record_memory 之前的最后一条文本（`findLastText` 倒序查找），连续多次记忆调用间的中间文本随之归入过程；其前无文本（如记忆先于回答）则回退默认逻辑取其后最后一条文本，避免误显「异常停止」。
- `hasProcess`：content 中存在 `finalContent` 与 `continueHint` 之外的过程项（thinking / toolcall / 中间文本）。
- **`canCollapse` = `isCompleted && hasProcess`**：完成 + 有过程内容即可折叠，**不要求有最终回复**（此前要求有最终回复，导致中途停止、无文本回复的消息无法折叠，已修复）。
- `processCount`：thinking + toolcall 数量（不含最终回复），用于折叠条文案「已折叠执行过程（N 步）」。

## 渲染规则（`visibleContents`）

- 进行中（streaming/pending）：全量平铺，实时展示过程。
- 完成且折叠：仅保留 `finalContent` + 全部 `continueHint`（继续按钮是操作入口，必须始终可见）；收尾的 record_memory 调用、其后的收尾 thinking 与补充说明均归入过程，折叠态不显示（仍计入 `processCount` 步数）。
  - **实战形状**（2026-08-24 依真实落库数据修正）：模型收尾常见 `[markdown(真正回答), toolcall(record_memory) × N, thinking(收尾思考), markdown(收尾备注)]`。此前「其后仍有 thinking → 走原逻辑」会把收尾备注当成最终回复折叠展示；现规则下 thinking 不触发回退，锚定到第一个 record_memory 之前的回答。
- 完成且展开 / 无过程可折叠：全量。
- 无最终回复时的折叠态：`filter` 结果仅剩 continueHint，过程内容由折叠条 +「异常停止」提示（`showAbortedHint`）概括，避免折叠后空白无解释。

## 异常停止提示

- `showAbortedHint` = `isCompleted && !processExpanded && hasProcess && !finalContent`：无最终回复且处于折叠态时，在折叠条下方渲染 `ErrorCircleIcon`（`--td-error-color`）+「异常停止」。
- 展开后提示消失（此时过程内容全量可见，无需额外说明）。

## 注意事项

- `processExpanded` 默认 `false`（默认折叠），为消息级独立状态。
- 折叠文案、提示文案与图标均在组件内维护，改动需保持 tdesign token 风格（颜色使用 `--td-*` CSS Token）。
