# 09 - ZCode 接入（hooks 配置合并路线）

> 2026-09-09 落地。ZCode（终端 AI 编程 agent）经其官方 hooks 机制接入 mistrelle 事件面：
> 事件驱动红绿灯/圆屏 + 工具审批由 mistrelle 面板/小键盘代答。与 opencode 接入（hardware/06、08）
> 并列的第二条接入来源，事件词汇表、权限审批基座完全复用。

## 实现思路

### 为什么走 hooks 而不是插件体系

ZCode hooks 是文档化的「本地子进程协议」：配置在用户级 `~/.zcode/cli/config.json` 的 `hooks`
键（`enabled: true` + `events.<HookEvent>: 条目数组`），每次事件以独立子进程运行脚本，stdin 收
一行 JSON，stdout 按 JSON 协议回写。对比插件市场路线（`~/.zcode/cli/plugins/` 的
installed_plugins/known_marketplaces 注册表带 cacheTransactionId 等内部结构）：
- hooks 配置是公开契约，外部程序合并写入稳定可控 → **可真正一键安装**；
- 插件市场注册表结构未文档化，外部写入有损坏风险。

已拍板：走 config.json 合并路线（用户确认）。

### 关键优势：权限双向流更干净

ZCode 有原生的**阻塞式 `PermissionRequest` 钩子**：只在权限结果需要询问时触发，钩子进程挂起
期间原生询问等待；stdout 输出决策 JSON 即直接代答，空输出则回落原生询问。opencode 因
`permission.ask` 插件钩子未接线（#7006）只能绕道「asked 事件 + client.permission.respond」，
ZCode 不需要客户端 API、不需要 feature-detect、也不需要 `/buddy/permission/replied` 撤下回传
（hook 空退出的残留待审项由 mistrelle 基座 4.5min 超时收场，见 hardware/08「三层收场」）。

## 钩子 → Buddy 事件映射

两个模板脚本（`resources/plugins/zcode/`，纯 Node ≥18 无依赖）：

**forward.mjs**（事件转发，`type:"command"` 挂载；钩子一律内联执行，脚本只做一次本地
fetch 即退，条目 `timeoutMs: 15000` 防挂兜底）：

| ZCode 钩子 | 条件 | Buddy 事件 |
|---|---|---|
| SessionStart | source=compact | session.compacted |
| SessionStart | 其余 | session.created |
| UserPromptSubmit | — | message.updated |
| PreToolUse | — | tool.execute.before |
| PostToolUse / PostToolUseFailure | — | tool.execute.after |
| PostToolUse | tool_name ∈ Write/Edit/MultiEdit/NotebookEdit | 加发 file.edited |
| Stop | — | session.idle |

**permission.mjs**（权限双向流，`type:"process"` 同步阻塞，`timeoutMs: 330000`）：

1. 异步 GET `/buddy/event?platform=zcode&event=permission.asked`（驱动红绿灯）；
2. 阻塞 POST `/buddy/permission/ask?source=zcode`，body：`permissionId/callID = tool_use_id`、
   `sessionID = session_id`、`type/title = tool_name`；fetch 超时 5min（> 基座 4.5min）；
3. 回 `{status:'allow'|'deny'}` → 输出
   `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":…}}}`
   （deny 带 message 回传模型）；`'ask'`/任何失败 → 静默退出（空 stdout），原生询问兜底。

合计只上报 **8 个事件**（子集常量 `ZCODE_HOOK_EVENTS`，在渲染层 `integrations/registry.ts`）：
其余 16 个 Buddy 事件 ZCode 无对应钩子，不投递；集成卡片与红绿灯 zcode 面板只展示这 8 个。

**不做节流**（与 opencode 插件的 500ms 节流不同）：每次钩子是独立进程无共享状态，且 ZCode 无
message.part.updated 这类流式高频钩子，本地 GET 足以承受。

## 安装 / 检测契约（main 侧 zcode adapter）

- **脚本安装目录**：`~/.mistrelle/integrations/zcode/`（mistrelle 自有目录，config.json 以绝对
  路径引用）；**配置文件**：`~/.zcode/cli/config.json`。
- **install**：复制两脚本 → 读 config.json（**解析失败即中止绝不覆写**）→ 写前备份 `config.json.bak`
  → 合并：`hooks.enabled=true`，7 个事件数组内摘除含本方标记 `.mistrelle/integrations/zcode/`
  的旧条目（幂等重装 + 路径变更清理）后追加新条目，**用户自有条目原样保留**，其余键一律不动。
- **check 三态**：脚本字节与模板不一致 → `outdated`；脚本齐全且 config.json 中 7 个条目逐一
  深相等且 `hooks.enabled === true` → `ready`；否则 `missing`。
- **uninstall**：先解析 config.json（失败即中止不碰用户配置）→ 按安装路径标记摘除本方 7 个
  条目（用户自有条目保留；摘空的事件键删除；events 全空时仅当 hooks 键已无其他遗留才整体
  还原删除）→ 删除脚本目录 → 回写（写前备份 `.bak`，语义与安装对称）。幂等：未安装也返回成功。
- **钩子条目形状（⚠️ 官方 schema 的坑）**：`events.<Event>` 数组元素是
  `{ matcher?, hooks: [ {type, command, ...} ] }` **包装对象**——直接写裸钩子对象不会被
  注册（静默无效，曾因此新会话零事件）。转发事件 = `{hooks:[{type:'command',
  command:'node "<dir>/forward.mjs"', timeoutMs:15000}]}`；PermissionRequest =
  `{hooks:[{type:'process', command:'node', args:['<dir>/permission.mjs'], timeoutMs:330000}]}`。
- **`async` 字段无运行时效果**（官方 diagnosing-hooks pitfalls #9）：钩子一律内联执行，
  转发脚本的耗时 ≈ node 启动（百毫秒级）+ 本地 fetch（毫秒级），靠秒退控制开销；
  勿依赖 async 做后台化，需要后台应让脚本自行 daemonize。

## 关键文件

| 文件 | 职责 |
|---|---|
| `resources/plugins/zcode/forward.mjs` | 事件转发模板（独立文件无法 import，SERVER_ORIGIN 与 @common/eventServer.ts 两处同步） |
| `resources/plugins/zcode/permission.mjs` | 权限审批双向流模板 |
| `src/main/src/buddy/integrations/platformConfig.ts` | zcode adapter（checkZcode/installZcode + config.json 合并） |
| `src/common/types/trafficLight.ts` | `SoftwareName` 加 `'zcode'`（SOFTWARE_NAMES 派生，事件过滤白名单自动放行） |
| `src/main/src/buddy/traffic-light/trafficLightConfig.ts` | `DEFAULT_ZCODE_BINDINGS` 默认绑定（zcode 默认停用——软件互斥，opencode 为既有主软件） |
| `src/renderer/.../settings/integrations/registry.ts` | 集成卡片登记 + `ZCODE_HOOK_EVENTS` 子集常量 |
| `src/renderer/.../traffic-light/softwareRegistry.ts` | 软件页签登记 |
| `src/renderer/.../traffic-light/components/software/ZcodePanel.vue` | zcode 专属绑定面板（只列 8 事件；仓库约定每软件独立面板组件不做通用面板） |
| `src/renderer/.../traffic-light/components/SoftwarePlaceholder.vue` | `SOFTWARE_ICONS` 补 zcode 图标（TerminalIcon） |

## 注意事项

- **生效条件 = 新会话**：hooks 配置在会话启动时快照，安装后正在运行的 zcode 会话不会热加载
  （比 opencode 的「重启软件」门槛低）。
- zcode 权限模式为自动批准（skip permissions）时 `PermissionRequest` 不触发，无审批事件——与
  opencode 行为一致。
- 权限面板显示来源为 `zcode`（ask 端点 `source` 参数自由文本，HTTP 层不校验）。
- config.json 是 ZCode 自身活动文件：mistrelle 只增改 `hooks` 键且写前留 `.bak`；若用户手动
  改坏条目，check 会落 `missing`，重装即修复（幂等）。
- 红绿灯默认绑定对齐 opencode 语义：`message.updated→绿灯闪`（ZCode 无流式钩子，用
  UserPromptSubmit 代理「开始干活」）、`tool.execute.before→黄灯闪`、`session.idle→绿灯亮`、
  `permission.asked→黄灯亮`；zcode 不上报 `session.error`，故无红灯默认绑定。
- 排障入口：伙伴窗口「设置-应用集成」zcode 卡片的「最近事件」面板（绿字=命中白名单已分发）。
