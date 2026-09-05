# 渐进式工具加载（Progressive Tool Collection）

> 2026-08-27 落地，同日修复合并缺失并演进为洋葱式解析。参考 skill 的「轻量目录 + 按需加载」设计
> （design doc: dist/temp.md），把可选工具组从「用户手工逐条勾选」升级为「模型看目录自助整组装载」。

## 背景与问题性质

- 可选能力分组（日期/剪贴板/媒体/浏览器/文档处理/设计风格/AI热点等）历史上**不默认注入**：只有用户在输入框
  面板手动插入工具节点，或专家 `agent.tools` 声明，才会进入请求的 tools 列表（见 `AgentChat.getFunctions`）。
- 因此本功能解决的问题**不是节省存量 token 浪费**，而是打通**能力自助通道**：
  - 模型可以阅读 8 行级目录发现可用能力组；
  - 任务中途需要某组能力时自主装载，不必用户预判勾选或中途打断求助；
  - 同一消息任务内装载一次全程可用；跨消息凭历史记忆调用未装载工具时由洋葱解析静默恢复。
- 成本面：每请求固定增加目录提示词（约数百 token，进稳定 system 前缀可被前缀缓存摊薄）+ 一个装载工具 schema。
  装载一组即回本（单组 schema 数百到上千 token）。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `src/renderer/src/modules/tool/index.ts` | `ToolGroup` 含 `id` / `description` / `group`；派生全局注册表 `toolRegistry` |
| `src/renderer/src/modules/tool/components/collectionLoader.ts` | 装载工具工厂 `createToolLoadTool(loadedRef)` + 目录提示词 `buildToolCatalogPrompt()` |
| `src/renderer/src/modules/chat/agent/AgentChat.ts` | 三层洋葱解析、生命周期清理、目录注入 |
| `src/renderer/src/modules/tool/components/agent/index.ts` | `list_tools` 输出补充集合维度（id/description），仅信息性 |
| `src/renderer/src/components/chat/chat-assistant/tool/ConfirmChatTool.vue` | 并行审批卡片（待审块均可作答） |
| `src/renderer/src/components/chat/RChatList.vue` | 待审横幅：计数 + 前往第一个未决块 |

## 数据结构

```ts
export interface ToolGroup {
  id: string          // AI 装载用稳定标识（kebab）：date / clipboard / media / browser / doc / design-style
  description: string // 给 AI 的能力描述（进 <available_tool_collections> 目录）
  group: string       // 人类显示名（UI 选择器分组标题），与 id 无关
  tools: ToolFunction[]
}

export interface ToolRegistryEntry {
  fn: ToolFunction
  groupId: string     // 归属集合 id：隐式命中时据此整组装载
}
// 全局注册表：基于过滤后的 toolGroups 构建，internal 工具不入表（防止幻觉调用解锁 list_tools 等）
export const toolRegistry: Record<string, ToolRegistryEntry>
```

- 分组单一数据源仍是 `toolGroups`；internal 过滤逻辑不变（`expert` 组全 internal，运行时不出现在目录中）。
- 显式选择直通不受 gating：用户勾选的节点内容（ToolContent）与专家 `agent.tools` 声明照旧精确按名注入。

## 洋葱式三层解析（核心契约）

工具调用的名字按固定顺序解析，「内置 → 已装 → 全局」：

1. **①基础层** `buildBaseFunctions(params)`：常驻默认 + 类型场景 + 显式勾选 + todo + 装载器，
   含子 Agent / 隐私 / spawn_agent 裁剪规则；
2. **②已装载层** `applyLoadedCollections(map)`：本条消息内已装载集合（`loadedCollections`）的工具整组并入，
   显式选择过的名字不覆盖；
3. **③全局层** `resolveForExecution(names, base)`：执行前逐名兜底查 `toolRegistry`——命中即静默装载其所属集合并
   并入函数表，放行本次调用。

三个消费点：
- **请求侧 schema 下发** `getFunctions()` = ①+②（未装载组不下发，保持轻量）；
- **执行期** runAgentLoop 的 executeToolCalls 前走 `resolveForExecution(toolCallNames, functions)`；
- **重启恢复挂起审批** resumePendingInteractives 同样走 `resolveForExecution`。

跨 Loop 自动恢复链路：Loop 结束 `beginRequest()` 清空②层 → 下一轮模型凭历史记忆直呼工具名 → ①②查不到 →
③命中注册表 → 自动复装该集合并放行当轮调用，后续轮次该组 schema 常驻。

## 装载工具契约

- 名称 `load_tool_collection`，risk `safe`，label「装载工具集」；主/子 Agent 统一注册（基础层种子列表）。
- 参数 `{ ids: string[] }`（required），单次可装多组；handler 幂等去重追加进 `loadedRef`。
- 返回最小化 `{ loaded, message }`：整组 schema 由下一轮请求注入，返回不再罗列工具清单。
  非法 id 返回 error 并列出全部合法集合。
- 目录提示词风格对齐 `buildSkillCatalogPrompt`（`<available_tool_collections>` 标签块 + 使用规则三条）。

## 并行审批（渲染层配合变更）

批次内多个 ask 工具并发执行时各自入队等待批准。2026-08-27 起 UI 取消「桥的单激活位」锁：

- `ConfirmChatTool.isInteractive` 只要求「块未完成 + 桥存在」：凡待审块都直接显示批准/拒绝按钮，
  可乱序独立作答；`bridge.resolve(id)` 支持对排队中的项出队兑现（interactive.ts 既有能力，桥层零改动）。
- 「此目录以后都允许」的 path 从卡片自身 args 解析（原依赖激活项的 pending.args），多卡各自独立提交。
- 「执行中…」占位仅作无桥环境兜底。
- `RChatList` 待审清单改为**消息内容派生**（`ext.interactive==='confirm' && status ∈ {pending,streaming}`）：
  横幅 N>1 显示计数，「前往」定位第一个未决块。

## 注意事项

0. **非末位待审块不显示的根因（2026-08-27 修复）**：`appendAssistantContent` 原实现会在 push 新内容后无条件把
   「前一个块」`status='complete'`——本是为 text/thinking 流式收尾设计，但同一批工具块逐个追加时，
   后续兄弟块入列会把先行的待审批工具块误标 complete，而卡片/横幅/恢复查找均以「未完成」为条件，
   导致只有批次最后一个待审操作能渲染审批 UI。修复：收尾规则收紧为仅作用于
   text/markdown/reasoning/thinking 四类流式块；toolcall 等结构块状态只由执行器（applyResult）驱动。

0.1 **toolcall 块生命周期契约（同日补齐）**：三段式显式驱动——
   `pending`（已接收 / 待审批，agentStream 创建时）→ `streaming`（handler 实际执行中，
   `markToolExecuting` 在审批通过 / allow 直通 / spawn 派发前置位）→ `complete`（唯一终态写点
   `updateToolCallContent`，result 与 status 原子双写）。历史上块无中间态且终态依赖巧合路径：
   旧的无条件 finalize 制造「永远是执行完成」，收紧后未触达 applyResult 的块又永久悬停「等待中」。
   配套双端收割 `sweepPendingToolCalls`：①executeRequest 收束后（含错误路径）把漏网块定格；
   ②init/setMessages 水合入口治愈存量脏数据（result 在而未标完成 → 补 complete；
   非交互无结果残留 → stop+『本轮已停止』）；**带 ext.interactive 且未完成的块一律跳过**
   （它们是 resumePendingInteractives 恢复挂起审批的合法素材，不可误杀）。
1. **模块环依赖**：collectionLoader 与 modules/tool/index.ts 互相引用，采用运行时访问模式（同 components/agent 先例），
   保持 toolPolicy 叶子 import 约束不被破坏（@see docs/tool/07）。AgentChat 直接 import collectionLoader，勿经
   index.ts 中转以减少环边。
2. **计划模式**（mode=1）：resolveForExecution 在发生装载时会重新过 `filterToolsByMode`，写入类工具仍被物理隐藏；
   未装载时不装饰任何组，安全语义与旧版一致。
3. **首次实现缺陷备忘**：初版只做了装载记账、漏掉把已装载组并入 getFunctions 函数表，导致「装载成功但调用报
   未找到工具」；修复即上文②层 applyLoadedCollections，勿再拆掉。
4. **token 构成估算**：lastTools 取自实际发给 API 的当轮 tools，装载带来的 schema 增量在下一轮 breakdown 自然反映。
5. **软风险**：个别严格 API 网关可能校验历史 tool_calls 引用了不在当前 tools 列表的名字而拒绝请求；遇到时该轮报错，
   洋葱解析会自动复装后放行，有退路（主流 OpenAI 兼容端与 Anthropic/Gemini 均容忍历史引用）。
6. **不落库**：loadedCollections 是 AgentChat 实例内存态，刷新页面/重启即空，符合「仅此次 message 有效」需求。
