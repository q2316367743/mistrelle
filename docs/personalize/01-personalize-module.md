# 个性化系统（soul/*.md）

> 五个用户可编辑的设定文件，注入主 Agent 系统提示词的**稳定前缀**，让助手带上用户的身份、风格与规则。与记忆系统共用 `~/.mistrelle/soul/` 目录。

## 文件与生效范围

| 文件 | 标题 | 生效范围（scope） |
|------|------|-------------------|
| `soul/IDENTITY.md` | 身份与风格 | 所有主 Agent 对话 |
| `soul/DESIGN.md` | 设计偏好 | 仅 design / ppt 类型 |
| `soul/WRITE.md` | 写作偏好 | 仅 writing 类型 |
| `soul/AGENT.md` | 行为准则 | 所有主 Agent 对话 |
| `soul/USER.md` | 用户画像 | 所有主 Agent 对话 |

单一数据源：`entity/setting/SettingPersonalize.ts` 的 `PERSONALIZE_FILE_CONFIG`（field / file / title / description / scope / placeholder），设置页 UI 与提示词注入均由此派生，新增文件只改这一处。

## 实现要点

- **存储**：真实 `.md` 文件（与 MEMORY.md 一致），用户可在应用外直接编辑；设置页只是其中一个编辑入口，清空内容写入空文件（对应段落自动跳过注入）。
- **注入**：`AgentChat.buildRequestMessages` 稳定前缀，位于 agent 人设之后——用户手编内容极少变化，不破坏前缀缓存；按聊天类型过滤 scope（`ChatType = 'office' | 'writing' | 'design' | 'ppt'`）。子 Agent 不注入（与记忆一致，任务作用域隔离）。
- **缓存**：`buildPersonalizePrompt` 以五个文件的 mtime 签名缓存已解析段落，agent loop 每轮调用无额外读盘；写入操作自动失效缓存。
- 空文件 / 文件不存在 → 跳过该段；五段全空 → 不产生任何提示词。

## 关键文件

| 文件 | 职责 |
|------|------|
| `entity/setting/SettingPersonalize.ts` | `PERSONALIZE_FILE_CONFIG` 单一数据源（原 `SettingPersonalize` 接口已被其取代：字段即文件，不再需要 JSON 实体） |
| `modules/personalize/PersonalizeService.ts` | 文件读写 + `buildPersonalizePrompt(chatType)`（mtime 缓存 + scope 过滤） |
| `pages/setting/personalize/PersonalizePage.vue` | 设置页：t-tabs 按 CONFIG 渲染编辑器（textarea + 保存） |

接线点：`AgentChat.buildRequestMessages`（一行调用）；路由 `/setting/personalize`；`AppSide.vue` settingOptions「个性化」入口。

## 与记忆系统的关系

同在 `soul/` 目录但相互独立：个性化是用户手编的静态指令（稳定前缀，利于缓存）；记忆是系统自动生成 / 整理的动态内容（独立 system 消息，按日变化）。`SettingPersonalize` 实体中原 `MEMORY` / `MEMORY_SHORT` 字段的设计由 `modules/memory` 以真实文件落地，实体不再重复声明。
