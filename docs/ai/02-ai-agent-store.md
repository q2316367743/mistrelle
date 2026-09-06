# AI Agent 配置存储（~/.mistrelle/agent.json）

## 功能概述

用户自建的 AI Agent（`AiAgent`）列表已从 lmdb（`/list/ai/group`，经 `DbStorageUtil` 的 `listByAsync` / `saveListByAsync` 读写，
带 `rev` 乐观并发）迁移到根数据目录下的单一 JSON 文件 **`~/.mistrelle/agent.json`**。

> 不迁移旧 lmdb 数据：`agent.json` 不存在时按空列表初始化，`~/.mistrelle/db` 中的旧数据保留但不再读取（与 `model.json` 迁移先例一致，见 `docs/setting/02-ai-model-store.md`）。

## 文件结构

| 文件                                                        | 角色                                            |
|-------------------------------------------------------------|-------------------------------------------------|
| `src/renderer/src/modules/agent/service/AiAgentService.ts`  | 读写 `agent.json` 的 Service（唯一 IO 入口）    |
| `src/renderer/src/store/ai/AiAgentStore.ts`                 | Pinia Store：内存态 + 计算属性 + 增删改（调用 Service） |
| `src/renderer/src/global/Constant.ts`（`getAgentPath`）     | 文件路径工厂                                    |
| `src/renderer/src/entity/ai/AiAgent.ts`（`AiAgent`）        | 数据结构契约                                    |
| `src/renderer/src/global/BuiltInAgent.ts`                   | 内置 Agent 预置（代码定义，不落盘）             |

## 文件路径

```ts
// src/renderer/src/global/Constant.ts
export const getAgentPath = () => window.preload.path.join(dataFolder, 'agent.json')
```

`dataFolder` 即 `~/.mistrelle`。文件仅存 **用户自建 Agent**（`Array<AiAgent>`，直接 JSON 数组，无 rev / 无包裹对象）；
内置 Agent（`BUILTIN_AGENTS`）由代码预置，仅在 `all` 计算属性中拼在前面，不写入文件。

## 数据结构

```json
[
  {
    "id": "1234567890123456789",
    "createdAt": 1720000000000,
    "updatedAt": 1720000000000,
    "name": "翻译助手",
    "description": "中英互译",
    "identity": "你是一名专业翻译……",
    "personality": "",
    "aboutMe": "",
    "tools": [],
    "model": "xxx:yyy",
    "placeholder": "",
    "think": false,
    "category": "content-creation",
    "top": false
  }
]
```

字段契约见 `src/renderer/src/entity/ai/AiAgent.ts`：`AiAgent extends BaseEntity, AiAgentForm`，
`BaseEntity = { id, createdAt, updatedAt }`。`category` 取值见 `AI_AGENT_CATEGORIES`。

## Service API

`src/renderer/src/modules/agent/service/AiAgentService.ts`

| 函数         | 签名                                        | 说明                                                          |
|--------------|---------------------------------------------|---------------------------------------------------------------|
| `agentList`  | `() => Promise<Array<AiAgent>>`             | 读取全部自建 Agent；文件不存在返回 `[]`（不预写空文件）       |
| `agentSave`  | `(list: Array<AiAgent>) => Promise<void>`   | 全量覆写 `JSON.stringify(list)`；无冲突控制（单进程唯一写者） |

读写基于 `window.preload.fs`（`existsSync` / `readTextFile` / `writeTextFile`），与 `ModelService` 的文件 JSON 模式一致。

## Store 契约

`AiAgentStore`（`useAiAgentStore`）对外 API 签名不变，全部调用方（chat / discussion / project 等 17 处）零改动：

- `all`：内置 Agent + 自建 Agent（响应式）
- `options`：`CommonSelect[]`（label = name，value = id）
- `put(form: AiAgentForm, id?: string): Promise<string>`：新增 / 更新后全量 `agentSave`
- `remove(id: string)`：删除后全量 `agentSave`
- `getById(id?)`：内置走 `BUILTIN_AGENTS` 全量、自建走 `state`（不随会员过滤，见下方门控章节）
- 内置 Agent 只读保护：`BUILTIN_IDS` 命中时 `put` / `remove` 直接短路返回，不写文件

移除项：`rev` 冲突控制、`DbStorageUtil` / `LocalNameEnum.LIST_AI_AGENT` 依赖。

## 内置 Agent 会员门控（BUILTIN_AGENT_FEATURE_GATES）

绑定会员能力的内置 Agent 以「id → feature key」映射统一门控（语义见 `docs/auth/02`）：

| 内置 Agent | feature key |
|------------|-------------|
| `builtin:design-style`（设计风格创建助手） | `extendedDesignStyles` |
| `builtin:card-style`（卡片风格创建助手，绑定 cardStyleTools） | `extendedCardStyles` |

- `all` / `options` 按会员档过滤：`features[key] === false` 时剔除对应内置 Agent（映射常量 `BUILTIN_AGENT_FEATURE_GATES`，新增 gated Agent 只改映射一条）。消费 `all` 的入口（对话 Expert 面板、专家管理页、发送器专家下拉、`list_agents`）自动隐藏，无需逐个改。
- **`getById` 不随 `all` 过滤**：直接在 `BUILTIN_AGENTS` + `state` 全量底层查找，会员期内用这些 agent 开过的历史聊天免费档仍可继续（防 brick，同 `DesignStyleStore.getDetail` 先例）。仅「新建 / 切换」入口经 `all` 不可见，达成隐藏语义。
- `put` / `remove` 对内置 id 只读保护不变（与会员无关）。
- 引 `useAuthStore` 须**直连 `@/store/AuthStore` 文件**：本模块经 `@/store` index 再导出，经 index 引 `AuthStore` 会成环（`index → AiAgentStore → index`），与 `DesignStyleStore.ts` 同一先例。

## 注意事项

- 文件读写是全量覆写（无差分合并），单实例运行下安全。
- store 创建即异步 `init()`，init 完成前 `all` 仅含内置 Agent（与旧方案行为一致，消费方已兼容）。
- `LocalNameEnum.LIST_AI_AGENT` 已删除，`/list/ai/group` 的 lmdb 残留数据不再被读取（不清理）。
- lmdb 已全量移除：各 Setting store、AiWorkspace 等剩余模块已于本地 JSON 迁移收尾，见 [migration/03-lmdb-to-json.md](../migration/03-lmdb-to-json.md)。
