# 19 - Agent 场景注册表重构（引擎抽离 + 场景即插件）

> 2026-09-15 落地。本次重构回答一个问题：**新增一种聊天场景，最少要改几处？**
> 答案：1 个场景定义文件 + 1 条注册（+ 可选的侧边栏组件目录），其余全部自动生效，
> 且漏注册会被 TS 穷尽约束在编译期拦下，不存在「静默空白侧边栏」类事故。

## 一、三层架构

```
┌──────────────────────────────────────────────────────┐
│ 场景层（上层建筑）modules/chat/scenes/                 │
│ SceneDefinition 单注册表 = 四件套自包含：              │
│ prompt + skills + tools + aside（另含注册表杂项字段）  │
├──────────────────────────────────────────────────────┤
│ 注入层（正交贡献者）agentPrompts 声明式管线            │
│ 专家=提示词段+agent.tools / skill 目录段 / 场景内置    │
│ skill / 记忆 / todo —— 统一 PromptContribution 契约   │
├──────────────────────────────────────────────────────┤
│ 引擎层（场景无关）modules/chat/agent/                 │
│ AgentRuntime 接口 + loop/stream/toolExec/surface     │
└──────────────────────────────────────────────────────┘
```

## 二、引擎抽离：AgentRuntime 契约

新文件 `modules/chat/agent/runtime.ts` 定义 `AgentRuntime` 接口（原 ToolChat「协作面」成员的正式化）：

- 状态组：`messages / status / toolCalls / interactive / loadedCollections / hitMaxSteps / reachedMaxSteps / ctx / mode / workspace / lastSkillCatalogPrompt`
- 配置组：`isSubAgent / maxSteps / finalizeOnMaxSteps`
- 能力组：`canStartRequest / resolveModel / getFunctions / resolveForExecution / buildRequestMessages / buildPolicyContext / sweepPendingToolCalls`

- `agentLoop.ts` / `agentResume.ts` 的签名从 `chat: ToolChat` 改为 `runtime: AgentRuntime`，
  两处对 AgentChat 的 type-only 反向依赖删除，环自然消除
- `ToolChat implements AgentRuntime`；`agentStream / agentTools / agentMessages` 本就是纯参数化，未动
- 接口成员按「实际被引擎读取」收窄：`closedToolSurface / todos / allowedDirs` 等只经快照
  （ToolSurfaceContext / PromptContext / ToolPolicyContext）进入引擎

## 三、场景注册表

### SceneDefinition（scenes/types.ts）

一个场景 = 一段提示词 + 一组内置 skill（可选）+ 一组工具 + 一个侧边栏，四件套自包含：

| 字段 | 说明 |
|---|---|
| `prompt(ctx)` | 提示词工厂，进稳定 system 前缀（场景创建后锁定）；可依赖登录态等运行时设置 |
| `skills?` | `BuiltInSkill[]`（name/description/content 内联），仅当前场景的 `<available_skills>` 可见 |
| `tools(ctx)` | 场景专属工具工厂 |
| `aside?` / `asideProps?(ctx)` | 侧边栏组件 + props 映射器（从统一状态包 SceneAsideContext 挑选，防 DOM 属性污染） |
| `excludedTools?` | 剔除的常驻工具名（请求侧 + 执行期兜底同源消费） |
| `subAgentAllow` | 子 Agent 能力矩阵（spawn_agent 枚举下发与执行期校验共用） |
| `personalizeScope?` | soul/\*.md 专属段落作用域（'design' / 'writing'） |
| `sandboxDirs?` | 沙盒内预建目录（相对沙盒根） |
| `autoExpandAside?` | 会话页默认展开侧边栏 |

### 注册表与解析（scenes/index.ts）

- `SCENES: { office: SceneDefinition; writing: Record<WritingScene, …>; design: Record<DesignScene, …> }`
  —— Record 嵌套保穷尽，新增家族 / 子场景漏注册编译期报错
- `resolveScene(type, writingScene?, designScene?)` —— switch **不带 default**：
  新增 ChatType 联合成员时函数出现不返回路径，编译期报错，杜绝静默回退
- `SCENE_FAMILY_META: Record<ChatType, SceneFamilyMeta>` —— 家族显示元数据（label/description/icon/
  variants 二级选项/）；`FAMILY_ORDER: Record<ChatType, number>` 穷尽展示顺序；`SCENE_FAMILIES` 按序派生
- `SUB_AGENT_TOOL_CONFIG` —— 子 Agent 能力类型 → 专用工具工厂（与场景正交，随迁至此）
- `findBuiltInSkill(name)` —— 全部场景内置 skill 的全局查找（load_skill 解析链兜底）

### 存储兼容

存储 schema 不动：chat 表 `type` 列（家族）+ content JSON 的 `writingScene / designScene`（子场景）
创建后锁定语义保持，`resolveScene` 负责 1:1 映射到叶子场景。

## 四、UI 注册表化（原 7 处静默分支清零）

| 消费点 | 现状 | 原状 |
|---|---|---|
| `LChatAside.vue` | `<component :is="scene.aside" v-bind="sceneProps">` 动态组件 | 无兜底的 v-if 链（漏分支=侧栏静默空白） |
| `LChatEngine.vue` | `resolveScene(...).autoExpandAside` | `['design','writing'].includes(type)` |
| `ChatList.vue` | `getSceneFamily(type).icon` | v-else-if 图标链（漏分支退化为办公图标） |
| `PageNew.vue` | 家族/子场景选择器从 `SCENE_FAMILIES` 派生，二级选择器由 `family.variants` 通用渲染 | 每类型硬编码模板分支 |
| `ChatService.aiChatSandbox` | `scene.sandboxDirs()` | `if (type === 'writing')` 硬编码 |
| `PersonalizeService` | `scene.personalizeScope` 按声明匹配 | else 兜底 `chatType === 'writing'`（新类型会误入 writing 作用域——已修） |
| 选项常量 | `CHAT_TYPE_OPTIONS / WRITING_SCENE_OPTIONS / DESIGN_SCENE_OPTIONS` 已删除 | chatType.ts / writingScene.ts / designScene.ts 各持一份 |

## 五、注入管线（agentPrompts.ts）

稳定 system 前缀的 11 段拼接改为声明式贡献者管线：

```ts
interface PromptContribution {
  id: string
  segment: (ctx: PromptContext, params: ResolvedChatRequestParams) => string | Promise<string>
}
const STABLE_CONTRIBUTIONS = [base, expert, personalize, skillCatalog, toolCatalog,
  todoGuide, workspace, workspaceSettings, scene, memoryTool, subAgentGuide]
```

- 门控收进各段内部：`sealedSurfaceOf(ctx)`（closedToolSurface / 生图型子 Agent）、`isSubAgent`、
  `privacy` 判断不再散落在组装函数体
- **专家** = `expert` 贡献者（`buildAiAgentPrompt`）+ `agent.tools` 工具注入（agentFunctions），机制不变
- **skill** = `skillCatalog` 贡献者 + `load_skill` 常驻工具，机制不变，且目录扩展为
  「用户目录 skills（启用过滤）+ 当前场景内置 skill」
- **场景内置 skill**：`BuiltInSkill { name, description, content }` 内联在场景定义中；
  `load_skill` 解析链 = 用户目录优先 → `findBuiltInSkill` 兜底（content-only，无脚本免审批；
  建议命名带场景前缀，被用户同名 skill 遮蔽属预期）
- 工作空间设定缓存改经 `ctx.settingsCache` 缓存盒原地回写（PromptContext 可变字段），
  `BuiltRequestMessages` 不再携带 settingsCache
- 三层工具面洋葱（base → loaded → registry 兜底）保持不动

## 六、旧 → 新对照表（供检索历史文档）

| 旧（已删除） | 新 |
|---|---|
| `global/ChatTypeConfig.ts`（CHAT_TYPE_CONFIG / WRITING_SCENE_CONFIG / DESIGN_SCENE_CONFIG / getSceneExcludedTools / getSceneSubAgentAllow / SUB_AGENT_TOOL_CONFIG） | `modules/chat/scenes/`（index.ts / types.ts / office.ts / writing.ts / design.ts） |
| `subagent/types.ts` 的 `SUB_AGENT_ALLOW` | 各叶子场景的 `subAgentAllow` |
| `chatType.ts / writingScene.ts / designScene.ts` 的 OPTIONS 常量 | `SCENE_FAMILY_META` 的 variants 选项 |
| `agentPrompts.buildTypePromptBody`（类型+场景拼接与 design/writing 特判） | 叶子场景 `prompt`（摊平进各叶子）+ `scene` 贡献者 |
| `ChatTypeToolContext`（工具工厂上下文） | `SceneContext`（增 designStylePrompt，design 风格拼接迁入 design 叶子） |
| `AgentChat.getType / getWritingScene / UseChatOptions.enableSkill` | 已删（无调用方的死代码） |
| `WritingAside.vue` 二段分发包装 | 已删除：注册表直连 ArticleAside / NovelAside，包装层失去存在意义 |

## 七、新增场景操作指南

以新增场景「XX」（家族为示例独立家族）为例：

1. **家族与子场景**：`chatType.ts` 的 `ChatType` 加联合成员（如无子场景则不新增 XxxScene 类型）；
2. **场景定义**：`modules/chat/scenes/xx.ts` 导出 `SceneDefinition`（四件套：
   prompt / tools / skills? / aside?，按需 excludedTools / subAgentAllow / sandboxDirs / personalizeScope）；
3. **注册**：`scenes/index.ts` —— `SCENES` 加条目（Record 穷尽强制）、`SCENE_FAMILY_META` 加家族元数据、
   `FAMILY_ORDER` 给序号；`resolveScene` 加分支（漏加编译报错）；
4. **侧边栏**（可选）：`windows/main/components/chat/aside/xx/` 目录 + aside 组件，props 经 `asideProps` 映射器精确挑选；
   ⚠️ aside 组件**严禁反向 import** `chat/scenes`（依赖方向：scenes → 组件）；
5. **新建页**：零改动（选择器从注册表派生）；聊天列表图标：零改动（家族 icon）；
   沙盒目录：零改动（sandboxDirs）；个性化作用域：零改动（personalizeScope）。
6. 文档：按 RL-06 新建编号文档并更新 `docs/README.md`。

## 八、关键文件

- `modules/chat/agent/runtime.ts` —— AgentRuntime 契约
- `modules/chat/scenes/{types,index,office,writing,design}.ts` —— 场景注册表
- `modules/chat/agent/{agentLoop,agentResume,agentFunctions,agentPrompts,agentTools,AgentChat}.ts` —— 引擎消费方
- `windows/main/components/chat/aside/LChatAside.vue` / `LChatEngine.vue` / `pages/app/components/ChatList.vue` / `pages/new/PageNew.vue` —— UI 消费方
- `modules/chat/service/ChatService.ts` / `modules/personalize/PersonalizeService.ts` —— 服务消费方
- `modules/tool/components/skill/index.ts` —— load_skill 解析链扩展
