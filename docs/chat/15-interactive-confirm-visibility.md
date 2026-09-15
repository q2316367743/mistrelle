# 挂起确认的可见性与「停止 ≠ 拒绝」（confirm 卡片视口外静默阻塞事故）

## 事故复盘（2026-08-25）

一轮对话中模型并行发起 `cli_run`（需审批）与 `file_read`（safe 直接执行）：

1. `file_read` 瞬间完成，几万字符的 result 把排在它**前面**的 `cli_run` 确认卡片推出视口；
   「发送后滚动到底部」只 watch 列表长度增长，result 原地更新不触发滚动，ChatList 自动跟随
   又会被用户上滚暂停——卡片一直在视口外渲染着，用户从头到尾没见到。
2. agent 循环阻塞在 `awaitDecision` 等批准，页面无新内容也无任何提示，表现为「卡住」。
3. 用户点停止后 `abortChat → InteractiveBridge.clear()` 把挂起决策 `resolve(null)`，
   confirm 分支对 `null` 与 `false` 一视同仁，回填「用户拒绝了该工具调用」——用户从未点过拒绝。

## 修复一：挂起确认可见性（RChatList + ConfirmChatTool）

- `ConfirmChatTool.vue` 根元素带 `data-tool-call-id` 锚点（`toolCallId` computed）。
- `RChatList.vue` inject `INTERACTIVE_KEY`：
  - `pendingConfirmId` computed：当前挂起的 confirm 决策 ID（非 confirm 或无挂起为 null）；
  - 列表顶部居中胶囊横幅（warning token 配色 + `t-button` 前往），挂起期间常驻；
  - 「前往」按钮 → `scrollIntoView({ block: 'center' })` 定位卡片；
  - watch `pendingConfirmId` 激活时，卡片不在可视区域（`rect.bottom < 0 || rect.top > innerHeight`）
    自动滚动一次——只在视口外才滚，不打断正在阅读的用户。

子 Agent 消息视图复用 RChatList，但其 bridge `enabled=false`、pending 恒 null，横幅不受影响。

## 修复二：停止 ≠ 拒绝（agentTools.ts）

confirm 分支按决策值区分文案：

- `null`（挂起被 clear：停止操作 / 新请求抢占 `beginRequest` / 子 Agent 无交互桥）
  → `本轮已停止，工具未执行`；
- `false` / `{ approved: false }`（用户明确点「拒绝」）→ `用户拒绝了该工具调用`。

子 Agent 无交互桥产生的 `null` 也显示「已停止」——语义为「审批未发生、工具未执行」，可接受。

## 修复三：整串 command 的 skill 免审批盲区（toolPolicy.ts）

模型偶发把整条 shell 语句塞进 `cli_run` 的 `command`（如 `find <skill 目录> -type f | head -20`），
路径前缀匹配失败 → 弹卡片；且 `cliRun` 为 spawn 直执行，整串带管道的命令即使批准也会执行失败。

`isSkillScriptCall` 增强（详见 docs/tool/07）：`file` / `command` 为脚本路径时仍按前缀判定；
`command` 为整条语句时按空白拆 token，**所有路径 token（`/` 或 `~/` 开头）均位于 skill 根目录下**
才放行——防止借 skill 路径夹带外部路径（`cat /etc/hosts <skill>/x` 不放行）。
写类命令指向 skill 目录内文件同样放行（skill 为用户安装的可信内容，黑名单与计划模式仍兜底）。

## 关键文件

| 文件 | 改动 |
|------|------|
| `windows/main/components/chat/RChatList.vue` | 横幅 + `scrollToToolCall` + 视口外自动滚动 |
| `windows/main/components/chat/chat-assistant/tool/ConfirmChatTool.vue` | `data-tool-call-id` 锚点 |
| `modules/chat/agent/agentTools.ts` | confirm 分支区分 null（停止）与 false（拒绝）文案 |
| `modules/tool/toolPolicy.ts` | `isSkillScriptCall` 整串 command 的 token 级判定 |
