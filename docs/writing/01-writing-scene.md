# 01 写作子场景（WritingScene）

> writing 聊天类型内部分层：自由写作（free）/ 文章创作（article）。新建对话时选定、创建后锁定，场景提示词与目录结构随场景差异化。

## 设计动机

`writing` 类型能力差异大（自由文档 vs 文章项目管理），直接塞进一个类型配置会互相污染。
引入 `WritingScene` 维度：**大类型（chatType）管框架，子场景（writingScene）管能力**。
未来新增小说（novel）等场景只需扩展 `WRITING_SCENE_CONFIG`。

## 场景定义

`src/modules/chat/writingScene.ts`（单一数据源）：

```ts
type WritingScene = 'free' | 'article'
```

| 场景 | 说明 | 提示词 | 场景工具 |
|---|---|---|---|
| free | 自由写作（现状行为） | 无额外指令 | 无 |
| article | 文章创作（项目管理 + 配图） | 创作工作流 + 相对路径约定 | article_*（模块 3 接入） |

`WRITING_SCENE_CONFIG[scene]` 仿 `CHAT_TYPE_CONFIG`：`{ label, prompt, tools }`。

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
│   └── articles/            # 仅 writing/article 场景
│       ├── drafts/          # 文章正文 .md
│       └── assets/          # 配图（design 子 Agent 导出于此）
├── inputs/
├── tmp/
└── message/
```

有用户工作空间（workspace）时，文章项目落 `{workspace}/articles/`；否则落沙盒 `outputs/articles/`（与既有约定一致）。

## 数据流转链路

```
PageNew.vue（选 writing → 二级选场景）
  → LChatSender（initialWritingScene prop → ChatRequestParams.writingScene）
  → AiChatStore.add（aiChatSandbox 建目录 + AiChatContent.writingScene 持久化）
  → ChatSessionManager.load（恢复 writingScene 并 set 到 ToolChat）/ send（透传）
  → AgentChat（setWritingScene → buildTypePrompt / getTypeTools 注入）
```

持久化字段：`AiChatContent.writingScene`；旧数据缺省回退 `free`。

## 关键文件

- `src/modules/chat/writingScene.ts`：场景类型 + 配置表（新增场景唯一改动点）
- `src/modules/chat/chatType.ts`：`ChatTypeToolContext.writingScene` + writing.tools 分发
- `src/modules/chat/agent/AgentChat.ts`：`buildTypePrompt` / `getTypeTools` / `setWritingScene`
- `src/modules/chat/agent/ChatSessionManager.ts`：writingScene 持久化与恢复
- `src/modules/chat/service/ChatService.ts`：`aiChatSandbox` 按场景建目录
- `src/pages/new/PageNew.vue` + `src/components/chat/sender/LChatSender.vue`：场景选择与透传

## 后续模块

- 模块 3：article 数据层（articleTypes / articleStore / articleTools / articlePrompt），接入 `WRITING_SCENE_CONFIG.article.tools`
- 模块 4：文章侧边栏（`aside/writing/article/`）
- 模块 5：md 图片相对路径 + 导出
