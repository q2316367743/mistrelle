# 设计风格接入 design 聊天（锁定 + 提示词注入）

## 功能概述

design 类型聊天在「新增页」可选绑定一个设计风格（可选，不选则维持默认）。风格在新建对话时选定、创建后锁定（与 `type` / `writingScene` 同语义），并持久化到 `AiChatContent.designStyleId`。会话运行期间，锁定的风格对象被转成一段「设计风格」提示词注入 design 类型的稳定 system 前缀，让 AI 的产出全程遵守该风格。聊天室发送栏以只读形式展示已锁定的工作空间与设计风格。

## 数据契约

- `AiChatContent.designStyleId?: string`（`src/entity/ai/AiChat.ts`）：设计风格 id，design 类型创建后锁定；旧数据缺省无。
- `ChatRequestParams.designStyleId?: string`（`src/modules/chat/engine/ChatCommon.ts`）：新建页随首条消息透传到 `AiChatStore.add()`。
- `ChatSenderInitial.designStyleId?: string`：聊天室 sender 水合展示只读标签用。
- `ChatSession.designStyleId = ref('')`（`ChatSessionManager.ts`）：跨挂载存活；`load()` 水合、`persist()` 落盘；`send()` 明确不从 params 更新（锁定语义）。

## 提示词注入链路

1. 新建页选择风格 → `add({ ...message, designStyleId })` → `AiChatStore.add` 写入 content（含 draft）。
2. 进入聊天室 → `ChatSession.load()` 水合 `designStyleId`，`useDesignStyleStore().getDetail(id)` 读一次完整风格，`buildDesignStylePrompt(style)` 生成提示词段落，`ToolChat.setDesignStylePrompt()` 注入引擎。
3. `AgentChat.buildTypePrompt()`：`chatType === 'design'` 且 `designStylePrompt` 非空时，拼在 `buildDesignCanvasPrompt` 之后（`[base, designStylePrompt].filter(Boolean).join('\n\n')`）。风格锁定 → 提示词稳定 → 不破坏稳定 system 前缀的 prompt 缓存。
4. 风格文件被删除 → `getDetail` 返回 undefined → 跳过注入，行为回落默认。

## 提示词格式（`buildDesignStylePrompt`）

位于 `src/modules/design/service/DesignStylePrompt.ts`，按以下结构输出，空字段跳过。`withVisualPrompt: false`（PPT）时跳过「正向提示词 / 反向排除词」两段；**「细节规范」段始终输出**（PPT 不接生图也能拿到间距 / 圆角 / 边框 / 阴影 / 动效细节）：

```text
## 设计风格
本次设计采用风格「{name}」，{description}

### 正向提示词          # withVisualPrompt 时输出
{visualPrompt}

### 反向排除词          # withVisualPrompt 时输出
{negativePrompt}

### 签名手法（必须落地，只换色板不算换风格）  # signature 非空时
{signature}

### 留白与画幅
- 留白目标：约 {whitespaceRatio}%
- 常用画幅：...

### 适用与禁忌          # suitableFor / unsuitableFor 非空时
...

### 配色方案
...

### 字体规范
...

### 细节规范            # 始终输出（tokens）
...

### 布局约束
- {layoutRules each}
```

## UI 行为

- **新增页**（`PageNew.vue`）：`type === 'design'` 时在类型选择下方、输入框上方渲染 `t-select`（clearable + filterable），`t-option` 自定义 content（名称 + 内置徽标 + 描述），数据源 `useDesignStyleStore().all`（列表缓存）。切换类型离开 design 时清空选择。
- **聊天室发送栏**（`LChatSender.vue`）：
  - 工作空间：`lockWorkspace`（由 `LChatEngine` 传 true，覆盖所有聊天类型）→ 未选择时隐藏、已选择时只读（`AiWorkspace.vue` 新增 `readonly` prop：仅图标 + basename，无下拉）。新建页 sender 不传该 prop，仍可自由选择。
  - 设计风格：`designStyleId` 存在时在工作空间右侧显示只读 `t-tag`（palette 图标 + 名称，无关闭按钮）；名称取自缓存列表 `getById`（列表缓存、详情不缓存），风格被删时回退「设计风格」。

## 缓存策略

- **列表缓存**：`DesignStyleStore.state` + `all`（预设常量合并）内存缓存，供选择器 / tag 名称解析，不读盘。
- **详情不缓存**：已移除 `detailCache` Map，`getDetail` 每次读单条文件（预设仍走常量）；会话的提示词在 `load()` 时构建一次并常驻引擎（锁定后无需重复读盘）。

## 涉及文件

| 文件 | 角色 |
|------|------|
| `src/entity/ai/AiChat.ts` | `AiChatContent.designStyleId` 字段 |
| `src/modules/chat/engine/ChatCommon.ts` | `ChatRequestParams.designStyleId` 字段 |
| `src/modules/design/service/DesignStylePrompt.ts` | 风格 → 提示词段落（`buildDesignStylePrompt`） |
| `src/modules/chat/agent/ChatSessionManager.ts` | 会话级水合 / 持久化 / 提示词构建 |
| `src/modules/chat/agent/AgentChat.ts` | `setDesignStylePrompt` + `buildTypePrompt` 注入 |
| `src/components/chat/useChatSession.ts` | `initialState.designStyleId` 透出 |
| `src/components/chat/sender/LChatSender.vue` | 工作空间锁定 + 风格只读 tag |
| `src/components/chat/AiWorkspace.vue` | `readonly` prop |
| `src/components/chat/LChatEngine.vue` | 聊天室传 `lock-workspace` |
| `src/pages/new/PageNew.vue` | 风格选择器 + 提交携带 |

## 注意事项

- 锁定语义：`ChatSessionManager.send()` 不得更新 `designStyleId`，与 `type` / `writingScene` 一致，靠 `load()` 从持久化恢复。
- 聊天室工作空间锁定为全局行为（所有聊天类型），工作空间只能在新增页选定；这是有意的产品决策。
- 子 Agent 不注入类型提示词（`buildTypePrompt` 对 `isSubAgent` 直接返回空串），风格约束仅作用于主 Agent。
