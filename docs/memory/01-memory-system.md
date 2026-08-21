# 记忆系统（soul/）

> 记忆 / 反思 / 总结系统：对话中自动提取短期记忆 → 每日后台合并为长期记忆（有最大长度）→ 新对话注入，把 agent 升级为具有跨会话连续性的 harness。

## 文件结构

```text
~/.mistrelle/soul/
├── MEMORY.md            # 长期记忆：LLM 合并生成，结构化分节，≤ 4000 字
├── memory/
│   └── YYYY-MM-DD.md    # 每日短期记忆：每行一条 `- [HH:mm] [类别] 内容`，≤ 2000 字/天
└── state.json           # { memoryEnabled, lastConsolidateDate, extracted: Record<storageKey, 消息数> }

# 同目录下的个性化设定文件（IDENTITY/DESIGN/WRITE/AGENT/USER.md）属个性化系统，@see docs/personalize
```

路径工厂：`global/Constant.ts` 的 `getSoulDir / getSoulMemoryPath / getSoulMemoryDir / getSoulMemoryDayPath / getSoulStatePath`。

## 数据流

```text
对话进行（任意会话）
  │ 一轮回复结束（status → 空闲）
  ▼ 空闲防抖 5 分钟（继续对话自动顺延）；会话空闲回收时立即触发
MemoryExtractor.extractSession(storageKey = `chat:{id}`)
  读该会话消息体（SQLite chat_content，经 aiChatContentGet(键)）自 extracted[storageKey] 之后的新消息
  → flattenMessages 紧凑转写（仅 user/assistant 文本 + 工具名，≤ 30k 字符）
  → LLM 提取（快速/总结模型，输出条目或 [NONE]）
  → 追加到 soul/memory/今日.md（超 2000 字丢最旧）→ 推进进度
  ▲ 兜底：extractPendingSessions 扫描未提取完的会话补提（合并前 + 设置页手动触发）

每日合并（App 启动 15 秒后检查 + 每小时跨天检查，或设置页手动）
MemoryConsolidator.runConsolidation()
  先执行 extractPendingSessions 兜底补提（含 app 退出时丢在防抖窗口内的尾段）
  → 消费「日期 >= lastConsolidateDate 且 < 今天」的每日文件（今日文件不消费，天然与追加无竞争）
  → 现有 MEMORY.md + 待合并文件 → LLM 合并去重/淘汰过时
  → 超长按行截断硬保护 → 写回 MEMORY.md → lastConsolidateDate 推进到本次消费最大日期的下一天（nextDayKey）

新对话（主 Agent 每轮请求）
AgentChat.buildRequestMessages
  → buildMemoryPrompt()：MEMORY.md 全文 + 未合并每日文件（倒序累计 ≤ 4000 字）
  → 独立 system 消息注入（不污染稳定可缓存前缀；子 Agent 不注入）
```

`record_memory` 工具（随默认工具常驻，`risk: safe` 免审批）：用户说「记住某事」或 agent 察觉重要偏好 / 纠正 / 事实 / 教训时，立即写入当日文件（条目带 `（对话记录）` 标注）。

## 关键设计

- **lastConsolidateDate 语义**：下一个待消费日期（含边界，消费条件「日期 >= 该值 且 < 今天」）。合并后经 `nextDayKey` 推进到本次消费最大日期的下一天，每个日期的文件恰好被消费一次、不重复。注意：合并完成后该日期文件若再被追加（跨零点防抖落盘竞态），追加部分不会被再次消费。
  - 旧版语义为「已消费最大日期 + 严格大于」，存在启用当天（首启基线日）文件永不消费的缺陷；旧存量值在新语义下基线日文件至多被重新消费一次，由合并提示词去重吸收，无需数据迁移。
- **首启基线**：state.json 首次创建时 `lastConsolidateDate = 今天`，不回溯提取历史会话，记忆从启用日开始积累，启用当天的每日文件自次日起可被合并消费。
- **模型**：提取与合并走 `defaultSummaryModel || defaultQuickModel` 兜底链（同订阅总结），`createChatCompletion` 非流式调用。
- **长度上限（MemoryConstant.ts）**：长期 4000 字（合并输出超限按行截断兜底）、单日 2000 字（追加时丢最旧）、注入每日预算 4000 字、提取输入 30k 字符。
- **注入缓存**：buildMemoryPrompt 按「开关 + MEMORY.md mtime + 各每日文件 mtime」签名缓存，agent loop 每轮调用无额外读盘；所有写入操作自动失效缓存。
- **提取进度**：state.extracted 以 storageKey（`chat:{id}`，聊天消息体迁 SQLite 后由键路由替代原 main.json 路径；历史键由迁移脚本改写）为键记录已消费消息数；LLM 判定无可记（[NONE]）也推进进度，失败不推进（下次重试）。extractPendingSessions 以「最后合并日」为时间下界、按 `chat_content.updated_time` 记忆去重（替代原文件 mtime），重复调用只做轻量戳查询。

## 关键文件

| 文件 | 职责 |
|------|------|
| `modules/memory/MemoryConstant.ts` | 长度上限、防抖延迟、日期工具 |
| `modules/memory/MemoryPrompt.ts` | 提取 / 合并提示词、record_memory 使用指导 |
| `modules/memory/MemoryService.ts` | soul 文件读写、状态管理、注入段组装（mtime 缓存）、LLM 调用封装 |
| `modules/memory/MemoryExtractor.ts` | 消息转写、增量提取、防抖调度、extractPendingSessions 全量扫描补提（mtime 去重） |
| `modules/memory/MemoryConsolidator.ts` | 长期记忆合并（内存锁防并发 + 长度硬保护） |
| `modules/memory/memoryTool.ts` | record_memory 工具 |
| `modules/memory/index.ts` | 聚合导出 + initMemorySystem（定时器） |
| `pages/setting/soul/SoulSettingPage.vue` | 管理页（开关 / 立即提取 / 编辑 / 每日查看删除 / 立即整理） |

接线点：`App.vue onMounted → initMemorySystem()`；`ChatSessionManager`（status watcher 防抖 + 空闲回收立即提取）；`AgentChat.buildRequestMessages`（稳定前缀加工具指导 + 独立 system 消息注入记忆）；`modules/tool/index.ts getDefaultTools` 注册 record_memory。

## 已知取舍

- app 退出时未决的防抖提取尽力而为（beforeunload 无法 await LLM）：次日合并的兜底补提前置执行，尾段会补提进次日文件；设置页「立即提取」可随时手动补齐。
- 用户主动删除的聊天（destroyChatSession）不提取——视为用户不想要该对话的记忆。
- 手动「立即整理」只消费昨日及更早的每日文件，当日文件仍需等待次日（保证合并与追加无竞争）；「立即提取」产出的条目写入当日文件，同样次日并入。
- 提取 / 合并是低频小额的快速模型调用；`memoryEnabled` 关闭后提取、合并、注入、record_memory 全部停止。
