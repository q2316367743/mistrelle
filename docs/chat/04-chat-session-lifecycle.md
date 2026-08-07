# 04 会话生命周期与空闲自动回收（ChatSessionManager）

> 会话管理器（`src/modules/chat/agent/ChatSessionManager.ts`）对已打开过的聊天会话做统一生命周期管理：
> 会话跨组件挂载存活，后台作答不中断；组件已关闭且非运行中的空闲会话按 TTL 自动销毁回收，避免内存无限累积。

## 实现思路

模块级 `sessions: Map<string, ChatSession>` 原为「只增不减」，仅删除聊天（`destroyChatSession`）时才释放， 导致所有打开过的会话（
`ToolChat` 引擎 + 每 1s 节流的常驻持久化 watcher + 消息数组）永久驻留内存。

改为「空闲过期自动回收」：

- **挂载豁免**：正在被组件消费（`activeCount > 0`）的会话永不回收；
- **运行豁免**：作答中（`status === 'pending' | 'streaming'`，含子 Agent 执行期）的会话永不回收；
- **过期回收**：组件已卸载且非运行中的会话，空闲超过 `IDLE_RECLAIM_TTL`（5 分钟）后 `destroy()` 并移出 Map；
  回收后再次打开会新建会话并从磁盘水合（watcher 保证落盘与内存最多差 1s），行为与重启应用一致。

## 关键文件

- `src/modules/chat/agent/ChatSessionManager.ts` —— 会话类 + 管理器 + 回收逻辑
- `src/components/chat/LChatEngine.vue` —— 唯一会话消费方，挂载时经 `getChatSession`（隐式 touch），卸载时
  `releaseChatSession`

## 生命周期与关键 API

| API                                                        | 调用方                 | 作用                                                         |
|------------------------------------------------------------|------------------------|--------------------------------------------------------------|
| `getChatSession(storageKey, options)`                      | 组件 setup             | 新建或复用会话，并 `touch()`（`activeCount++`、取消待回收）  |
| `releaseChatSession(storageKey)`                           | 组件 `onBeforeUnmount` | 注销挂载消费（`activeCount--`），归 0 且未运行则安排过期回收 |
| `ChatSession.load()`                                       | 组件 `onMounted`       | 水合 + 建立常驻持久化 watcher 与状态 watcher                 |
| `ChatSession.destroy()`                                    | 管理器回收 / 删除聊天  | 停 watcher、清定时器、销毁引擎                               |
| `destroyChatSession(s)` / `destroyChatSessionsByPrefix(p)` | 删除聊天 / 项目        | 立即销毁，不等 TTL                                           |

### 状态机（`status` watcher，仅在 `load()` 后生效）

```
运行中(pending/streaming)  ──▶ cancelIdleReclaim()（豁免）
非运行(idle/complete/...) + activeCount===0  ──▶ scheduleIdleReclaim()
定时器触发  ──▶ 二次校验 activeCount===0 && !isRunning  ──▶ onIdleExpire()（destroy + 出 Map）
```

## 数据结构 / 契约

- 常量：`IDLE_RECLAIM_TTL = 5 * 60 * 1000`（`ChatSessionManager.ts:9`），调整 TTL 只需改此值。
- 运行态判定：`ChatStatus` 中 `'pending' | 'streaming'` 视为运行；`'idle' | 'complete' | 'stop' | 'error'` 视为空闲。
- `ChatSession` 新增私有字段：`activeCount`（挂载消费计数）、`idleTimer`、`unWatchStatus`； 新增公开方法 `touch()` /
  `release()`，私有 `scheduleIdleReclaim()` / `cancelIdleReclaim()`。
- 构造签名变更：`new ChatSession(options, onIdleExpire: () => void)`，仅管理器构造，回调内执行 `destroy()` +
  `sessions.delete(key)`。

## 注意事项

- **release 配对**：回收依赖组件正确调用 `releaseChatSession`。当前唯一消费方是 `LChatEngine.vue`， 若新增消费方必须同样在
  `onBeforeUnmount` 释放，否则会话永不回收。
- **destroy 破坏性**：`ToolChat.destroy()` 会清空内存消息（`AgentChat.ts:783`），因此回收前必须保证
  `activeCount === 0`（挂载中绝不回收），定时器回调内二次校验兜底。
- **定时器与复用竞态**：JS 单线程下 `getChatSession`（touch 取消定时器）与定时器回调不会交错；
  回调内二次校验「释放瞬间又复用 / 转入运行态」的边界。
- **回收后重开**：消息等状态来自磁盘水合（`persist()` 节流 1s），最多丢失 1s 内的增量，与重启应用行为一致，属可接受。
- 会话 `load()` 未完成即被 destroy 时（水合期间删除），`load()` 内部已按 `destroyed` 早退，不重建 watcher（原有逻辑，保持兼容）。
