# Skill 启用 / 禁用

> 本地 skill（`modules/skill`，扫描 `~/.agents/skills` 等 agent 目录）的启用状态管理。
> 默认全部启用，用户可在 SkillLocal 管理页禁用个别 skill，被禁用的 skill 不再进入 AI 上下文。

## 需求与语义

- **默认启用**：存储只记录被禁用的项，key 不存在即启用——新建 / 新安装（SkillHub）的 skill 天然启用，无迁移成本。
- **禁用的准确语义**：被禁用的 skill 只是**不默认加入上下文**；聊天时用户仍可通过输入框 `/` 显式指定（提及建议中带「已禁用 · 」前缀标注），指定后经 `buildPinnedContext` 生成 `load_skill` 指令照常加载，即临时加入上下文。
- **唯一过滤点**：`AgentChat.buildRequestMessages`（`modules/chat/agent/AgentChat.ts`）构建 `<available_skills>` 前过滤，禁用 skill 对模型默认不可见（模型不会主动调 `load_skill`）。
- **`/` 提及建议不过滤**（`LChatSender.vue` 保持全量、`mentionSuggestion.ts` render 标注禁用态）：显式指定是用户意图，优先于禁用配置。
- **`load_skill` 不拦截**：handler 不校验禁用状态，用户显式指定（pinned 指令）可正常加载。
- **管理页可见全量**：`localSkillList()` 永远返回全量，SkillLocal 管理页能看到被禁用的 skill 并重新启用。

## 存储结构

`~/.mistrelle/setting/skill.json`（`getSettingSkillPath()`，`global/Constant.ts`）：

```json
{ "disabled": { "system/pdf-tools": true } }
```

- key = `agentKey + '/' + dirName`（与 SkillSideList 列表 selectedKey 同粒度）。
- 实体：`entity/setting/SettingSkill.ts`（`SettingSkill` + `buildSettingSkill`）。
- Store：`store/setting/SettingSkillStore.ts`，照 `SettingGlobalStore` 模式——`readJsonFile` 初始化 + `watch(deep)` 自动 `writeJsonFile` 落盘（Vue3 reactive 的 `delete` 会触发 deep watch，启用即 delete key）。
- 暴露 API：`isSkillEnabled(skill)` 同步内存读取（可响应式）、`setSkillEnabled(skill, val)`。

## UI（SkillLocal 页面）

- `SkillSideList.vue`：每个列表项（卡片）右上角放「启用」`t-switch`（name 行 flex 布局，`@click.stop` 阻止冒泡到列表项 select），切换即时生效并自动落盘；禁用项名称置灰（`--td-text-color-disabled`），开关状态与置灰响应式读 store，切换后即时刷新。
- 筛选：搜索框旁 `t-select` 三态筛选（全部 / 已启用 / 已禁用），与 agent 筛选、关键词共同作用于 `filteredList`；「已禁用」筛选用户找回被禁 skill 重新启用。

## 注意事项

- **孤儿 key**：skill 被删除后禁用记录残留在 `disabled` map 中，无害；同名重建（同 agentKey + dirName）会继承禁用状态。
- `LocalSkill` 不加 `enable` 字段：启用状态单一数据源在 store（实时），避免 `skillList` 扫描缓存快照与 store 不一致。
- token 估算无需改动：`estimateTokenBreakdown` 读 `lastSkillCatalogPrompt`，过滤后自然跟随。
