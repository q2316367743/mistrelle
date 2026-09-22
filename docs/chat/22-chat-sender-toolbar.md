# 22 - 发送栏工具条重排与权限模式四档（2026-09-22）

## 背景

发送栏原先把「模式」藏在 `+` 附件面板里（两个 `t-switch`），选中后又在工具条上以 `计划` / `完全访问` 标签回显；右侧是文字按钮「发送 / 停止」，模型与思考强度挤在同一个 popup 里。参考 zcode 的发送栏形态重排为「输入区 + 工具条」两段式，并把权限模式提为工具条上的一等入口。

## 版式

```text
┌─ 输入区（占位文案 / tipTap 编辑器）─────────────────────────┐
├─ 工具条 ──────────────────────────────────────────────────┤
│ [+] [权限模式 ⌄] │ [工作空间] [上下文标签…]   [用量] [模型] [●↑] │
└──────────────────────────────────────────────────────────┘
```

- 左组：`+` 附件面板 → 权限模式下拉 → 竖分隔线 → 工作空间选择器 → 上下文标签（Agent / 设计风格 / 隐私）。
- 右组：上下文用量圆环、模型弹窗（含思考开关与强度）、圆形发送按钮（加载中变圆形停止按钮）。
- 工具条 `flex-wrap`：窄窗口下右组自动折行，不再用媒体查询改成纵向堆叠。

## 权限模式四档（AiChatMode）

| 值 | 档位 | 引擎裁决 | 说明文案 |
|----|------|---------|---------|
| 1 | 计划模式 | `planModePolicy`：shell 需审批，写入类 deny；工具面物理过滤只留 safe + shell | 编辑前先出计划。 |
| 0 | 变更前确认（默认） | 正常权限流（safe 放行 / sensitive 审批 / dangerous 拦截，工具专属策略优先） | 改文件前先问我。 |
| 3 | 自动编辑（新增） | 文件写入 / 修改类免审批，其余（含 shell）回默认模式裁决 | 自动编辑文件。 |
| 2 | 完全访问 | 全部 `allow` | 减少确认次数。 |

- 四档互斥单选，**没有**独立的「计划」快捷开关——同一个状态不在两处表达。
- 自动编辑（3）的判定：`isFileWriteCall(tool, args)` = 非执行类（shell）工具且带 `path` 参数；工具专属策略命中时仍以专属策略为准（更具体的路径敏感策略不被放宽）。
- 四档都无法跳过安全中心黑名单：`applyBlacklistOverride` 最后生效，命中即 `ask`。
- **无落库 / 迁移**：模式存在 `chat_content.data`（`AiChatContent.mode`）与每条消息上，属 JSON 字段，新增取值无需改 schema。

## 模式与对话的绑定（实时生效）

模式是 **「随对话实时生效」** 的属性（与创建后锁定的 type / writingScene / designStyleId / privacy 不同），单一事实源是 `ChatSession.mode`：

```text
LChatModeSelect ─ v-model ─→ LChatSender.mode（defineModel）
  └─ v-model:mode ─→ LChatEngine（:mode + @update:mode="handleModeChange"）
       └─ ChatSession.setMode(mode)
            ├─ session.mode.value = mode   # 会话状态（sender 经 v-model 回读 → 切换对话即显示对应对话的模式）
            ├─ chat.setMode(mode)          # AgentChat.mode：buildPolicyContext 每次调用读取当前值 → 下一个工具批次即用新模式
            └─ persist()                   # 立即落盘 chat_content.mode，不依赖下一次发送
```

- **切换对话**：引擎按 `:key="storageKey"` 重建，`ChatSession.load()` 从磁盘恢复该对话的 `content.mode`（旧数据缺省回退 0），下拉随之回显，不会再出现「沿用上一个对话的模式」。
- **同一对话内改动**：`setMode` 立即生效，无需先发一条消息。正在执行的那一步工具批次仍按旧模式裁决，**下一个工具批次**（`buildPolicyContext` 每次调用取值）即切换；计划模式下被物理过滤掉的写类工具要等下一轮请求才会重新出现在工具面里。
- **水合守卫**：新增 `loaded` 标志，水合完成前 `setMode` 不落盘（否则会用空消息覆盖存储），水合期间用户改过的模式由 `load()` 末尾统一补写一次。
- **草稿首轮**：`load()` 改走 `this.send(content.draft)`（原先直呼 `chat.sendUserMessage`），把草稿里的模式 / 工作空间 / agent 一并同步进会话，新建页选好的模式不会丢。
- **不再走 `initial`**：`ChatSenderInitial` 已移除 `mode` 字段，避免「initial 一次性水合」与「模式可实时改」两个事实源打架；新建页（PageNew）不传 `v-model:mode`，模式即组件内部状态。

## 关键文件

| 文件 | 职责 |
|------|------|
| `windows/main/components/sender/LChatSender.vue` | 发送栏外壳：输入区 + 工具条编排、props 水合、`v-model:mode`、发送/停止（≤300 行，编辑器逻辑已外移） |
| `windows/main/components/sender/useChatSenderEditor.ts` | tipTap 实例、提及标签（技能 / 工具 / 文件 / 画布节点 / 设计稿元素）、拖拽与粘贴、内容序列化 |
| `windows/main/components/sender/LChatModeSelect.vue` | 权限模式下拉：触发器 = 当前档位图标 + 名称 + chevron；面板 = 四档（图标 + 标题 + 副标题 + 选中勾） |
| `windows/main/components/sender/chatModeOptions.ts` | 档位展示元数据单一事实源（顺序由严到宽、图标、主题色、缺省回退） |
| `windows/main/components/sender/LChatSenderTags.vue` | 上下文标签（Agent / 设计风格 / 隐私），全空时不渲染 |
| `windows/main/components/sender/LChatTokenUsage.vue` | 上下文用量圆环 + 明细弹窗（原内联在 `LChatSender.vue`） |
| `windows/main/components/sender/LChatAttachment.vue` | 附件面板：原「模式」面板改为「隐私」面板，只保留创建后锁定的隐私开关 |
| `windows/main/components/LChatEngine.vue` | `:mode` + `@update:mode` 绑定会话模式 |
| `windows/main/components/useChatSession.ts` | `handleModeChange` → `session.setMode`；`initialState` 不再含 `mode` |
| `windows/main/modules/chat/agent/ChatSessionManager.ts` | `ChatSession.setMode()`（会话 + 引擎 + 立即落盘）、`loaded` 水合守卫、`load()` 模式水合与草稿走 `send()` |
| `windows/main/modules/tool/toolPolicy.ts` | `resolveToolPolicy` 新增 `case 3`；抽出 `resolveDefaultModePolicy`（默认模式 / 自动编辑共用）与 `isFileWriteCall` |
| `entity/ai/AiChat.ts` | `AiChatMode = 0 \| 1 \| 2 \| 3` 与档位注释 |

## 注意事项

- **面板不再提供模式开关**：模式只能在工具条下拉里改；`LChatAttachment` 的 `mode` prop 与 `update:mode` 事件已删除，改模式不要再走附件面板。
- **模式不用放进 `initial`**：它是实时状态，走 `v-model:mode`；`initial` 只承载一次性水合字段。
- **隐私入口保留在附件面板**（`activePanel === 'privacy'`）：隐私为创建后锁定属性，聊天室里 `lockPrivacy` 只回显不可改。
- **回车与提及选中的优先级不变**：`handleKeyDown` 先读 suggestion 插件的 `active` 状态，弹层可见时回车交给插件选中，不触发发送。
- **图标全部取自 `tdesign-icons-vue-next`**（`LightbulbIcon` / `ChatIcon` / `EditIcon` / `SecuredIcon` / `ArrowUpIcon` / `StopCircleIcon`），未手写 SVG。
- **已知债务**：`LChatAttachment.vue`（约 850 行）仍超 RL-05 的 300 行红线，本次只做了模式面板收敛；拆分方案（导航 / 各面板拆子组件）待单独排期。
