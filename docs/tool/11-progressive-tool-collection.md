# 渐进式工具加载（Progressive Tool Collection）

> 2026-08-27 落地。参考 skill 的「轻量目录 + 按需加载」设计（design doc: dist/temp.md），把可选工具组从
> 「用户手工逐条勾选」升级为「模型看目录自助整组装载」。

## 背景与问题性质

- 可选能力分组（日期/剪贴板/媒体/浏览器/文档处理/设计风格/AI热点等）历史上**不默认注入**：只有用户在输入框
  面板手动插入工具节点，或专家 `agent.tools` 声明，才会进入请求的 tools 列表（见 `AgentChat.getFunctions`）。
- 因此本功能解决的问题**不是节省存量 token 浪费**，而是打通**能力自助通道**：
  - 模型可以阅读 8 行级目录发现可用能力组；
  - 任务中途需要某组能力时自主装载，不必用户预判勾选或中途打断求助；
  - 同一消息任务内装载一次全程可用；跨消息凭历史记忆调用未装载工具时由拦截器静默恢复。
- 成本面：每请求固定增加目录提示词（约数百 token，进稳定 system 前缀可被前缀缓存摊薄）+ 一个装载工具 schema。
  装载一组即回本（单组 schema 数百到上千 token）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `src/renderer/src/modules/tool/index.ts` | `ToolGroup` 增加 `id` / `description` 字段；派生 `toolCollectionMap`（id→组）与 `toolOwnerGroupId`（工具名→组 id） |
| `src/renderer/src/modules/tool/components/collectionLoader.ts` | 装载工具工厂 `createToolLoadTool(loadedRef)` + 目录提示词 `buildToolCatalogPrompt()` |
| `src/renderer/src/modules/chat/agent/AgentChat.ts` | 状态持有、生命周期清理、目录注入、执行前拦截器 |
| `src/renderer/src/modules/tool/components/agent/index.ts` | `list_tools` 输出补充集合维度（id/description），仅信息性 |

## 数据结构

```ts
export interface ToolGroup {
  id: string          // AI 装载用稳定标识（kebab）：date / clipboard / media / browser / doc / design-style / aihot
  description: string // 给 AI 的能力描述（进 <available_tool_collections> 目录）
  group: string       // 人类显示名（UI 选择器分组标题），与 id 无关
  tools: ToolFunction[]
}
```

- 分组单一数据源仍是 `toolGroups`；internal 工具过滤逻辑不变（因此 `expert` 组全 internal，运行时不出现在目录中）。
- 显式选择直通不受 gating：用户勾选的节点内容（ToolContent）与专家 `agent.tools` 声明照旧精确按名注入。

## 装载工具契约

- 名称 `load_tool_collection`，risk `safe`，label「装载工具集」；主/子 Agent 统一注册（getFunctions 种子列表）。
- 参数 `{ ids: string[] }`（required），单次可装多组；handler 幂等去重追加进 `loadedRef`。
- 返回 `{ loaded, collections, message }`：collections 含每组全部工具的 name/label/description——模型无需靠记忆猜名字。
  非法 id 返回 error 并列出全部合法集合。
- 目录提示词风格对齐 `buildSkillCatalogPrompt`（`<available_tool_collections>` 标签块 + 使用规则三条）。

## 生命周期规则

| 时点 | 行为 |
| --- | --- |
| 发送新消息 / 继续推进 / 重启恢复（beginRequest） | `loadedCollections = []`（Loop 级自动清理） |
| 每轮请求构建 | `buildToolCatalogPrompt()` 进稳定 system 前缀（静态可缓存） |
| AI 调 load_tool_collection(ids) | 校验 → 去重追加 → 当轮即可执行（loader 本就在函数表内）；下一轮请求 getFunctions 重建自然带全组 schema |
| AI 直接调未装载工具（历史记忆/幻觉） | runAgentLoop 执行前拦截器 `ensureCollectionsLoaded` 反查 `toolOwnerGroupId` 装载其所在集合并重建函数表放行 |
| resumePendingInteractives | 同样走拦截器，避免重启恢复挂起审批时工具「未找到」 |
| destroy | 清空 loadedCollections |

## 注意事项

1. **模块环依赖**：collectionLoader 与 modules/tool/index.ts 互相引用，采用运行时访问模式（同 components/agent 先例），
   保持 toolPolicy 叶子 import 约束不被破坏（@see docs/tool/07）。AgentChat 直接 import collectionLoader，勿经
   index.ts 中转以减少环边。
2. **计划模式**（mode=1）下 `filterToolsByMode` 物理过滤写入类工具：装载成功但工具被过滤属既有安全语义，
   未做特殊处理；文件写入类在计划模式本就不可用。
3. **token 构成估算**：lastTools 取自实际发给 API 的当轮 tools，装载带来的 schema 增量会在下一轮 breakdown 自然反映。
4. **软风险**：个别严格 API 网关可能校验历史 tool_calls 引用了不在当前 tools 列表的名字而拒绝请求；遇到时该轮报错，
   模型走重新装载路径即可，有退路（主流 OpenAI 兼容端与 Anthropic/Gemini 均容忍历史引用）。
5. **不落库**：loadedCollections 是 AgentChat 实例内存态，刷新页面/重启即空，符合「仅此次 message 有效」需求。
