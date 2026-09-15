# 01 写作子场景（WritingScene）

> ⚠️ 2026-09-15 场景注册表重构：本文所述 `global/ChatTypeConfig.ts`（CHAT_TYPE_CONFIG / WRITING_SCENE_CONFIG / DESIGN_SCENE_CONFIG / getSceneExcludedTools / getSceneSubAgentAllow / SUB_AGENT_ALLOW）已删除，配置迁移至 `src/renderer/src/windows/main/modules/chat/scenes/`（SceneDefinition 叶子场景定义）。现行契约见 [docs/chat/19](../chat/19-scene-registry-refactor.md)，本文以下内容为当时实现的历史记录。


> writing 聊天类型内部分层：文章创作（article，默认）、短篇小说（novelShort）。新建对话时选定、创建后锁定，场景提示词与目录结构随场景差异化。

## 设计动机

`writing` 类型需要承载文章项目管理（列表 / 状态 / 平台 / 配图）与小说项目管理（角色 / 大纲 / 设定 / 文风），子场景能力差异大，
引入 `WritingScene` 维度：**大类型（chatType）管框架，子场景（writingScene）管能力**。
当前场景为 `article` 与 `novelShort`；未来新增长篇小说（novelLong）等场景只需扩展 `WRITING_SCENE_CONFIG`。

## 场景定义

`src/modules/chat/writingScene.ts`：场景类型 + UI 选项（单一数据源）；配置表在 `src/global/ChatTypeConfig.ts`。

```ts
type WritingScene = 'article' | 'novelShort'
```

| 场景 | 说明 | 提示词 | 场景工具 | 能力面收窄 |
|---|---|---|---|---|
| article | 文章创作（项目管理 + 配图，writing 默认场景） | 创作工作流 + 相对路径约定 | article_* (+ design_draw) | 无 |
| novelShort | 短篇小说（每篇含角色 / 大纲 / 设定 / 文风） | 短篇创作工作流 + 设定一致性 | novel_* (+ humanize_text) | 剔除 file 类/shell/装载器/绘图/读图，子 Agent 仅 research |

`WRITING_SCENE_CONFIG[scene]` 仿 `CHAT_TYPE_CONFIG`：`{ label, prompt, tools, excludedTools?, subAgentAllow? }`。
`WRITING_SCENE_OPTIONS`（value/label/description/icon）供新建对话页等 UI 消费，单一数据源。

### 场景能力面收窄（excludedTools / subAgentAllow）

子场景不仅能「加」工具，也能「减」——针对能力面应当更窄的场景：

- `excludedTools`：本场景要剔除的常驻工具名（`getDefaultTools` 子集 / 渐进装载器 / 场景追加工具）。
  经 `getSceneExcludedTools(chatType, writingScene)` 读取，在 `agentFunctions` 中**同时**作用于请求侧
  （`buildBaseFunctions` / `applyLoadedCollections`）与执行期（`resolveForExecution` 的注册表兜底）。
  只在请求侧过滤会被注册表兜底绕过（模型直呼被剔工具名会整组复装）。
- `subAgentAllow`：覆盖 `SUB_AGENT_ALLOW[chatType]` 的场景级子 Agent 能力矩阵，
  经 `getSceneSubAgentAllow(chatType, writingScene)` 统一裁决，`spawn_agent` 的 type 枚举下发与执行期校验共用。

短篇小说场景的完整收窄清单与理由见 [05-novel-short-scene.md](./05-novel-short-scene.md)。
注意：剔除名单放在 `ChatTypeConfig` 用**字面量**声明，不导入工具数组——`fileParse` 会拉入 mammoth / xlsx / pdf-parse 等重依赖，导入会污染配置模块图。

## 提示词注入

`AgentChat.buildTypePrompt()`：writing 类型时 = `CHAT_TYPE_CONFIG.writing.prompt`（通用写作约定，**按场景分流**）+ `WRITING_SCENE_CONFIG[scene].prompt`（场景指令）拼接。
场景创建后锁定 → 组合稳定 → 进入稳定 system 前缀不影响 prompt 缓存。
`writing.prompt` 分流的原因：文章场景提到 `file_write` / `design_draw`，小说场景两者都被剔除，提示词若不分流会诱导模型调用不存在的工具。

## 工具注入

`AgentChat.getTypeTools()`：主 Agent 按 `chatType` 注入；`writing` 时经 `ChatTypeToolContext.writingScene` 透传场景，
由 `src/global/ChatTypeConfig.ts` 分发给 `WRITING_SCENE_CONFIG[scene].tools`。子 Agent 无场景工具（research 只读 / image 走专用生图集）。

`CHAT_TYPE_CONFIG.writing.tools` 在场景工具之外，按场景决定是否追加 `design_draw`
（`excludedTools` 含 `design_draw` 的场景不追加）。这类「场景追加工具」同样受场景剔除保护。

## 目录结构（按类型预建）

`ChatService.aiChatSandbox(id, { type, writingScene })` 在创建聊天时按场景预建目录：

```
~/.mistrelle/workspace/{chatId}/
├── outputs/
│   ├── articles/            # writing + article 场景
│   │   ├── drafts/          # 文章正文 .md
│   │   └── assets/          # 配图（生图型子 Agent 产出于此）
│   └── novels/              # writing + novelShort 场景（小说子目录由 novel_create 创建，含 {id}/assets/ 封面）
├── inputs/
├── tmp/
└── message/
```

有用户工作空间（workspace）时，项目落 `{workspace}/articles/` 或 `{workspace}/novels/`；否则落沙盒 `outputs/` 下（与既有约定一致）。

## 数据流转链路

```
PageNew.vue（选 writing → 二级场景 article / novelShort）
  → LChatSender（initial.writingScene → ChatRequestParams.writingScene）
  → AiChatStore.add（aiChatSandbox 建目录 + AiChatContent.writingScene 持久化）
  → ChatSessionManager.load（恢复 writingScene 并 set 到 ToolChat；首条 draft 由此发送）
  → AgentChat（buildTypePrompt / getTypeTools 注入）
```

持久化字段：`AiChatContent.writingScene`；旧数据缺省回退 `article`（历史 free 数据自动并入文章创作）。

> **锁定约束**：`type` 与 `writingScene` 为「创建后锁定」属性，仅由 `load()` 从持久化内容恢复，
> `ChatSession.send()` 不得修改（运行期发送消息不透传类型变更）。

## 关键文件

- `src/modules/chat/writingScene.ts`：场景类型 + UI 选项（新增场景唯一改动点）
- `src/global/ChatTypeConfig.ts`：`CHAT_TYPE_CONFIG` / `WRITING_SCENE_CONFIG` 组合配置（跨模块组合根）
- `src/modules/chat/chatType.ts`：`ChatTypeToolContext.writingScene` + `CHAT_TYPE_OPTIONS`
- `src/modules/chat/agent/AgentChat.ts`：`buildTypePrompt` / `getTypeTools` / `setWritingScene` / `buildPolicyContext`（注入 `writingScene`）
- `src/modules/chat/agent/agentFunctions.ts`：场景剔除过滤（请求侧 + 执行期）+ `getSceneSubAgentAllow` 裁剪 `spawn_agent`
- `src/modules/chat/agent/agentPrompts.ts`：装载器被剔除时抑制 `<available_tool_collections>` 目录
- `src/modules/chat/agent/ChatSessionManager.ts`：writingScene 持久化与恢复
- `src/modules/chat/service/ChatService.ts`：`aiChatSandbox` 按场景建目录
- `src/pages/new/PageNew.vue` + `src/renderer/src/windows/main/components/chat/sender/LChatSender.vue`：场景透传
