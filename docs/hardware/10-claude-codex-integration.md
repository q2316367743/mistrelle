# 10 - Claude Code / Codex 接入（hooks 三平台共享脚本）

> 2026-09-10。继 opencode（插件路线）、zcode（hooks 合并路线）之后的第三、四个接入软件。
> 核心发现：**ZCode 的 hooks 机制本就仿照 Claude Code**，Codex 又 adopting 了同款设计，
> 三家的 stdin/stdout 子进程钩子契约同源，因此三家共用一套钩子脚本，仅配置文件与
> 条目 schema 有差异。接入手册见 `docs/hardware/09`（zcode 首创的路线与语义）。

## 1. 三家 hooks 机制对照

| 维度 | ZCode | Claude Code | Codex |
|---|---|---|---|
| 配置文件 | `~/.zcode/cli/config.json` 顶层 `hooks` 键 | `~/.claude/settings.json` 顶层 `hooks` 键 | `~/.codex/hooks.json` 专用文件 |
| 事件表挂载 | `hooks.events.<事件名>`（另强制 `hooks.enabled=true`） | `hooks.<事件名>`（无 enabled 概念） | `hooks.<事件名>`（`features.hooks` **默认启用**，无需动 config.toml） |
| 条目包装 | `{ matcher?, hooks: [...] }` | 同左 | 同左 |
| handler 形式 | `type:'command'` shell form；PermissionRequest 用 `type:'process'`+args | 统一 `type:'command'` **exec form**（`command:'node'`+`args` 数组，免引号转义） | 仅 **shell form**（无 args 字段）；转发钩子 `async:true` 后台零阻塞 |
| timeout | `timeoutMs` 毫秒（15s 转发 / 330s 权限） | `timeout` 秒（同 15/330） | `timeout` 秒（同 15/330） |
| 生效方式 | 新开会话 | 新开会话（settings 有 watcher，但会要求确认 hooks 变更） | 新开会话 + **首次须在 Codex 内 `/hooks` 审查信任**（非托管钩子按 hash 信任，未信任被静默跳过——check 无法感知，靠 effectHint 提示） |
| 钩子事件全集 | 7 个（含 PostToolUseFailure） | 同 zcode（同源命名） | 6 个（无 PostToolUseFailure） |

PermissionRequest 决策输出三家一致（stdout JSON，空输出回落原生询问）：

```json
{ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": { "behavior": "allow" } } }
```

deny 附 `message` 字段回传拒绝原因；Codex 端多条决策合并规则「有 deny 以 deny 为准，
allow 直接放行不再弹原生审批」。Codex 文档警告勿返回 `updatedInput` 等字段（会导致
拒绝）——本方脚本只输出 decision，安全。

## 2. 共享钩子脚本（关键重构）

- 模板从 `resources/plugins/zcode/` 迁至 **`resources/plugins/hooks/`**（`forward.mjs`
  事件转发 + `permission.mjs` 权限双向流），**平台名由 hooks 条目以 argv[2] 传入**
  （`node "<脚本路径>" claude`），脚本内有平台白名单 Set 防误用，URL 的
  `platform=`/`source=` 用该参数。
- 映射逻辑三家零分支：`SessionStart`（source=compact → `session.compacted`）、
  `UserPromptSubmit → message.updated`、`PreToolUse → tool.execute.before`、
  `PostToolUse(+Failure) → tool.execute.after`（编辑类工具加发 `file.edited`，编辑
  工具名单含 codex 的 `apply_patch`）、`Stop → session.idle`、
  `PermissionRequest → permission.asked`（+ 挂起等决定代答）。
- **zcode 同步迁移到共享脚本**：安装目录（`~/.mistrelle/integrations/zcode/`）与
  条目 marker 不变，仅条目 command 追加 ` zcode` 参数——存量 zcode 用户集成状态变
  outdated，点一次「更新」即恢复（幂等替换按 marker 摘旧条目）。
- 打包：resources 整体 asarUnpack（electron-builder.yml），adapter 以 `__dirname`
  相对定位模板，dev/打包通用。

## 3. 关键文件

| 文件 | 职责 |
|---|---|
| `resources/plugins/hooks/forward.mjs` `permission.mjs` | 三平台共享钩子脚本（argv 平台参数） |
| `src/main/src/buddy/integrations/hooksAdapter.ts` | hooks 系共用基建（脚本三态检查/安装、marker 摘条目、条目齐全校验、卸载骨架）+ zcode/claude/codex 三家 adapter 完整实现 |
| `src/main/src/buddy/integrations/platformConfig.ts` | opencode adapter + 四家 ADAPTERS 注册表（`Record<SoftwareName, PlatformAdapter>` 穷尽校验，漏登记 typecheck 即报错） |
| `src/common/types/trafficLight.ts` | `SoftwareName` 加 `'claude' \| 'codex'`（Options 名称映射，派生物自动更新） |
| `src/renderer/.../integrations/registry.ts` | `HOOK_PLATFORM_EVENTS`（原 `ZCODE_HOOK_EVENTS` 改名，三家共用的 8 个 Buddy 事件子集，保留旧名导出兼容）+ `INTEGRATION_REGISTRY` 登记 claude/codex 卡片 |
| `src/renderer/.../traffic-light/softwareRegistry.ts` | 红绿灯软件页签 +2 |
| `src/renderer/.../traffic-light/components/software/ClaudePanel.vue` `CodexPanel.vue` | 事件→灯态绑定面板（从 ZcodePanel 复制改造；SoftwareTabs 约定「不做通用面板」，每软件独立组件） |
| `SoftwareTabs.vue` / `SoftwarePlaceholder.vue` | PANELS / SOFTWARE_ICONS 登记（claude=StarIcon、codex=RobotIcon） |

## 4. 行为与语义

- **check 三态**：脚本逐字节比对模板（缺=missing、异=outdated）→ 配置条目 JSON.stringify
  相等校验（zcode 额外要求 `hooks.enabled===true`）。条件不齐一律 missing（配置与脚本
  同装，不会出现半装态）。
- **install**：落脚本 → 读配置（解析失败/非 JSON 对象即中止绝不覆写）→ `.bak` 备份 →
  按 marker（`.mistrelle/integrations/<平台>/` 路径）摘本方旧条目（用户自有条目保留）→
  追加新条目 → 回写。codex 首装时补 `description`（已有则不覆盖）。
- **uninstall**：摘本方条目 → 摘空的事件键删除 → 收尾分型：zcode 逐级还原本方容器键
  （events/hooks，宿主 config.json 绝不删文件）；claude 摘空仅删 hooks 键（settings.json
  其余键保留）；codex 本方条目摘空且文件仅剩 description/hooks 时删整个文件（专用文件
  语义）。均幂等（再卸返回成功）+ 删脚本目录。
- **权限审批双向流**：三家共用 permission.mjs——异步投 `permission.asked` 点灯 →
  阻塞 POST `/buddy/permission/ask?source=<平台>` 等 mistrelle 面板/小键盘/HTTP 决定 →
  输出决策代答；'ask'（超时/无人处理）或任何失败静默退出回落原生询问。mistrelle 端
  permissionService 的 source 是自由 string（无白名单），新平台零改动接入；待审面板
  （PermissionRequestPanel 按 props.source 过滤）、keypad 代答、HTTP decide 全链路自动生效。

## 5. 注意事项

- **Codex 信任门槛**：install 成功 ≠ 生效，未信任前 Codex 静默跳过钩子。UI 各处
  effectHint/告警文案已写明「/hooks 审查信任」。排查「装了没事件」先想到这个。
- **Claude Code hooks 变更审查**：外部改动 settings.json 后 Claude Code 可能提示确认，
  采纳即可；运行中的会话不热加载。
- 三家配置文件都是宿主软件共享配置，**解析失败必须中止**（readJsonConfig 返回 null
  即 fail-fast），绝不可覆写用户手改过的配置；`.bak` 备份语义与 zcode 一致。
- `ZCODE_HOOK_EVENTS`（渲染层）已改名 `HOOK_PLATFORM_EVENTS`，旧名保留导出兼容
  ZcodePanel 等存量引用；新代码请用新名。
- ESP32 LCD 心跳仍固定盯 opencode（esp32LcdService lastPlatform 默认值），未随新平台扩展。
