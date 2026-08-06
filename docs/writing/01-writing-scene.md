# 01 写作子场景（WritingScene）

> writing 聊天类型内部分层：文章创作（article，默认且当前唯一场景）。新建对话时选定、创建后锁定，场景提示词与目录结构随场景差异化。

## 设计动机

`writing` 类型需要承载文章项目管理（列表 / 状态 / 平台 / 配图），子场景能力差异大，
引入 `WritingScene` 维度：**大类型（chatType）管框架，子场景（writingScene）管能力**。
当前默认且唯一场景为 `article`；未来新增小说（novel）等场景只需扩展 `WRITING_SCENE_CONFIG`。

## 场景定义

`src/modules/chat/writingScene.ts`（单一数据源）：

```ts
type WritingScene = 'article'
```

| 场景 | 说明 | 提示词 | 场景工具 |
|---|---|---|---|
| article | 文章创作（项目管理 + 配图，writing 默认场景） | 创作工作流 + 相对路径约定 | article_* |

`WRITING_SCENE_CONFIG[scene]` 仿 `CHAT_TYPE_CONFIG`：`{ label, prompt, tools }`。
`WRITING_SCENE_OPTIONS`（value/label/description/icon）供新建对话页等 UI 消费，单一数据源。

## 提示词注入

`AgentChat.buildTypePrompt()`：writing 类型时 = `CHAT_TYPE_CONFIG.writing.prompt`（通用写作约定）+ `WRITING_SCENE_CONFIG[scene].prompt`（场景指令）拼接。
场景创建后锁定 → 组合稳定 → 进入稳定 system 前缀不影响 prompt 缓存。

## 工具注入

`AgentChat.getTypeTools()`：主 Agent 按 `chatType` 注入；`writing` 时经 `ChatTypeToolContext.writingScene` 透传场景，
由 `chatType.ts` 分发给 `WRITING_SCENE_CONFIG[scene].tools`。子 Agent 逻辑不变（design 型 → canvas）。

## 目录结构（按类型预建）

`ChatService.aiChatSandbox(id, { type, writingScene })` 在创建聊天时按场景预建目录：

```
~/.mistrelle/workspace/{chatId}/
├── outputs/
│   └── articles/            # 仅 writing 场景
│       ├── drafts/          # 文章正文 .md
│       └── assets/          # 配图（design 子 Agent 导出于此）
├── inputs/
├── tmp/
└── message/
```

有用户工作空间（workspace）时，文章项目落 `{workspace}/articles/`；否则落沙盒 `outputs/articles/`（与既有约定一致）。

## 数据流转链路

```
PageNew.vue（选 writing → 二级场景固定 article）
  → LChatSender（initial.writingScene → ChatRequestParams.writingScene）
  → AiChatStore.add（aiChatSandbox 建目录 + AiChatContent.writingScene 持久化）
  → ChatSessionManager.load（恢复 writingScene 并 set 到 ToolChat；首条 draft 由此发送）
  → AgentChat（buildTypePrompt / getTypeTools 注入）
```

持久化字段：`AiChatContent.writingScene`；旧数据缺省回退 `article`（历史 free 数据自动并入文章创作）。

> **锁定约束**：`type` 与 `writingScene` 为「创建后锁定」属性，仅由 `load()` 从持久化内容恢复，
> `ChatSession.send()` 不得修改（运行期发送消息不透传类型变更）。

## 关键文件

- `src/modules/chat/writingScene.ts`：场景类型 + 配置表 + UI 选项（新增场景唯一改动点）
- `src/modules/chat/chatType.ts`：`ChatTypeToolContext.writingScene` + `CHAT_TYPE_OPTIONS` + writing.tools 分发
- `src/modules/chat/agent/AgentChat.ts`：`buildTypePrompt` / `getTypeTools` / `setWritingScene`
- `src/modules/chat/agent/ChatSessionManager.ts`：writingScene 持久化与恢复
- `src/modules/chat/service/ChatService.ts`：`aiChatSandbox` 按场景建目录
- `src/pages/new/PageNew.vue` + `src/components/chat/sender/LChatSender.vue`：场景透传
