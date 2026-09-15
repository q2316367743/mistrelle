# 14 - 发送消息后滚动到底部

## 需求

`l-chat-sender` 发送消息后，`r-chat-list` 自动滚动到底部——即使用户此前上滚翻阅过历史。

## 根因

tdesign `@tdesign-vue-next/chat` 的 `ChatList` 内置 autoScroll（ResizeObserver 监听内容增高后自动跟随），但内部有一套「防打扰」状态机：

- 用户上滚（scrollTop 上移 ≥10px 且高度未变）→ `preventAutoScroll = true`、`isAutoScrollEnabled = false`，此后列表再增高**不再跟随**；
- 仅当滚动事件中判定贴近底部（距底 ≤50px）时才复位恢复跟随。

因此用户上翻历史后发送新消息，视图停留在原处，新消息不可见。

另一个关键约束：user 消息是**异步追加**的——`AgentChat.sendUserMessage` 先 `await resolveAttachmentFiles`（附件解析/拷贝）才写入 `messages`，所以在 sender 的 `send` 事件瞬间滚动，目标高度还不含新消息，时机不可靠。

## 实现

改动收敛在 `src/renderer/src/windows/main/components/chat/RChatList.vue`（`LChatEngine.vue` 无需改动）：

1. `<ChatList>` 加模板 ref，复用其 `expose` 的 `scrollToBottom({ behavior })` 方法。
2. watch `messages.length`：**增长且新末条为 user 角色**时，`await nextTick()` 等 DOM 渲染完成后调用 `scrollToBottom({ behavior: 'smooth' })`。

```ts
watch(
  () => props.messages.length,
  async (len, prevLen) => {
    if (prevLen === undefined || len <= prevLen) return
    if (props.messages[len - 1]?.role !== 'user') return
    await nextTick()
    chatListRef.value?.scrollToBottom({ behavior: 'smooth' })
  }
)
```

### 设计要点

- **触发信号**取「列表增长且新末条为 user」而非 send 事件：这是「发送了一条消息」在数据侧的可靠信号，天然覆盖异步追加时序；首轮草稿自动发送（`load()` 中 draft 路径同样走 `sendUserMessage`）也生效。
- **不误伤**：continue 续跑（不新增 user 消息）、删除 / 清空（长度减少）均不触发，保持用户当前视点。
- **behavior 用 smooth 且在 nextTick 后调用**：此时目标高度已含新 user + pending assistant 消息，动画终点即真实底部；到达底部后 tdesign 内部 `checkAutoScroll` 判定贴近底部自动恢复跟随，后续流式增量继续自动滚。
- ref 类型用 DOM 标准 `ScrollBehavior` 联合类型（`'auto' | 'instant' | 'smooth'`），与组件 expose 签名兼容。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/renderer/src/windows/main/components/chat/RChatList.vue` | 唯一改动点：chatListRef + 发送滚动 watch |
| `node_modules/@tdesign-vue-next/chat/es/chat-list/chat-list.mjs` | （只读参考）`expose({ scrollToBottom })` 与 preventAutoScroll 状态机 |
| `src/renderer/src/modules/chat/agent/AgentChat.ts` | （只读参考）`sendUserMessage` 异步追加时序 |
