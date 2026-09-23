# 23 - 工作空间行上移至输入框上方（2026-09-22）

## 背景

参考 zcode 的发送栏形态：工作目录以 chip 形态落在**输入框上方**，输入框本体只承载输入与工具条。原先 `AiWorkspace` 挤在工具条左组（`+` / 权限模式 / 工作空间 / 上下文标签）中间，位置靠下、与「本次对话的目录」语义不匹配。

同时明确：**工作空间是「进入对话前」的选择**——新建页选好即随首条消息落库锁定；进入聊天页（`/chat/:id`）后输入框上方那块不再出现，聊天页也不再回显当前目录。

## 版式

```text
┌─ 发送栏卡片 ─────────────────────────────────────────────┐
│ [📁 mistrelle ⌄]        ← 工作空间行（仅新建页，聊天页整块不渲染）│
├─ 输入区（占位文案 / tipTap 编辑器）───────────────────────┤
├─ 工具条 ────────────────────────────────────────────────┤
│ [+] [权限模式 ⌄] [上下文标签…]        [用量] [模型] [●↑]     │
└─────────────────────────────────────────────────────────┘
```

## 显隐规则（单一开关）

| 场景 | `showWorkspace` | 表现 |
|------|-----------------|------|
| 新建聊天页 `PageNew.vue` | 默认 `true`（不传） | 输入框上方渲染工作空间行，可选目录 / 清除 / 选历史 |
| 聊天页 `LChatEngine.vue` | `:show-workspace="false"` | 输入框上方整块不渲染（既不可选也不回显） |
| 设计编辑器等无工作空间场景 | `false` | 同上 |

- 原来的 `lockWorkspace` prop **已删除**：它同时承担「只读回显」和「未选择时隐藏」两件事，与新的「聊天页整块隐藏」语义冲突；显隐统一由 `showWorkspace` 一个开关表达。
- 工作空间行始终在输入区上方且只读渲染工作目录本身，**不参与发送校验**：未选择目录时也能发送（无工作空间对话）。

## 关键文件

| 文件 | 职责 |
|------|------|
| `windows/main/components/sender/LChatSender.vue` | 卡片三段式编排：`l-chat-sender__workspace` 行（`v-if="showWorkspace"`）+ 输入区 + 工具条 |
| `windows/main/components/sender/LChatSender.less` | `.l-chat-sender__workspace` 行样式（`flex` + `gap: 4px` + 左右 4px 内缩，与输入区左对齐） |
| `windows/main/components/AiWorkspace.vue` | 工作空间选择器：已收敛为**单形态**（popup 选择面板） |
| `windows/main/components/LChatEngine.vue` | 聊天页传 `:show-workspace="false"` |

## 连带清理

- `AiWorkspace.vue` 的只读形态整体删除（`readonly` prop、`ai-workspace--readonly` 分支与样式、`openWorkspace`）——`LChatSender` 是唯一使用方，改后无任何调用点。
- `LChatSender.less` 的 `.l-chat-sender__divider` 删除：该竖分隔线原本用于分隔「权限模式 / 工作空间」，工作空间移出后只剩孤立分隔线。
- `AiWorkspace` 的两种形态收敛为一种后，组件从「分支渲染 popup」变为「单根 `t-popup`」。

## 注意事项

- **不要给聊天页再加工作空间回显**：会话创建后目录已落库并作用于全部工具调用，聊天页再显示一份只会造成「能改吗」的歧义；需要查看目录时走左侧聊天列表的项目分组。
- **`showWorkspace` 是唯一显隐开关**，不要再引入 `lockWorkspace` 之类的第二个 prop。
- 工作空间面板仍是 `placement="top"`（向上弹出），因为触发器已在发送栏顶部，向下弹会被输入区遮挡。
