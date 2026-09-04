# 工具安全策略注册与模块循环依赖约束（toolPolicy）

## 背景

`toolPolicy.ts` 提供工具专属安全策略的注册与裁决：

- `registerToolPolicy(policy)`：按 `policy.name`（工具全名）注册策略
- `resolveToolPolicy(tool, args, ctx)`：裁决本次工具调用权限（allow / ask / deny）

多类工具在各自模块**顶层**调用 `registerToolPolicy` 完成策略注册（article / novel /
canvas / design 系工具）。这要求 `toolPolicy.ts` 的模块级 `toolPolicies` 常量在任何注册
调用发生前必须已完成初始化。

## 曾经的崩溃（TDZ）

`toolPolicies` 是 `const`（暂时性死区 TDZ）。当模块循环依赖导致 `toolPolicy.ts` 处于
**import 求值阶段**（其顶层 `const toolPolicies` 尚未初始化）时，循环路径恰好回到某个
在模块顶层调用 `registerToolPolicy` 的模块 → 访问 TDZ 中的 `toolPolicies` →
`ReferenceError: Cannot access 'toolPolicies' before initialization`（曾命中
`articleTools.ts:227`）。

原循环链（两条均把 chat / store 全量图拉进 `toolPolicy` 的 import 闭包）：

```
toolPolicy ─► SettingSecureStore ─► @/entity ─► AiChat ─► chat ─► AgentChat ─► ChatTypeConfig ─► articleTools / novelTools / canvasTools / design ─► toolPolicy(未初始化)
toolPolicy ─► httpDownloadPolicy ─► @/modules/tool/index ─► components/agent ─► @/store ─► ... 同上
```

## 修复：保持 toolPolicy 的 import 为叶子

让 `toolPolicy.ts` 的 import 闭包**全部为叶子模块**（不含任何 `registerToolPolicy` 调用方），
则 `toolPolicies` 在任何模块加载顺序下都先于所有注册方完成初始化，从结构上消灭该崩溃类。

改动点：

| 文件 | 改动 | 作用 |
|------|------|------|
| `modules/tool/policies/httpDownloadPolicy.ts` | `ToolPolicy` 类型改从 `@/modules/tool/toolPolicyTypes` 导入（type-only） | 切断 `toolPolicy → @/modules/tool/index` 全量图 |
| `store/setting/SettingSecureStore.ts` | `buildSettingSecure` / `getDefaultEgoBrowserPath` 改从 `@/entity/setting/SettingSecured` 直接导入 | 切断 `@/entity → entity/ai → chat` 全量图（该函数本就定义于此，`@/entity` 仅 re-export） |

## 约束（后续 AI 必须遵守）

1. **禁止**在 `toolPolicy.ts` 中新增非叶子 import。若需读取 store / 实体，必须改为从最具体的
   叶子文件导入（如 `@/entity/setting/SettingSecured`），禁止从 `@/entity`、`@/store`、`@/modules/tool` 等 barrel 导入。
2. **禁止**在可被上述循环链触及的模块顶层调用 `registerToolPolicy`。新增工具策略时，
   注册位置与工具工厂保持一致（如设计工具注册在 `design/*` 模块顶层、`fontListTool` 在
   `fontTools.ts` 顶层），前提是这些模块不被 `toolPolicy` 的 import 闭包反向触及。
3. 新增工具策略后运行 `npm run typecheck`，并确认 `toolPolicy.ts` 的 import 闭包中
   不存在模块顶层 `registerToolPolicy` 调用。

## 验证

- `npm run typecheck` 通过
- `npm run dev` 启动无 `ReferenceError`（此前在加载期即崩溃）
- ESM 求值模拟：修复后从任何入口求值，模块顶层 `registerToolPolicy` 均发生在
  `toolPolicies` 初始化之后

## 关键文件

- `src/renderer/src/modules/tool/toolPolicy.ts`（注册表与裁决）
- `src/renderer/src/modules/tool/toolPolicyTypes.ts`（`ToolPolicy` / `ToolPolicyContext` 类型）
- `src/renderer/src/modules/tool/policies/*`（browser_actions / http_download 等默认策略）
- `src/renderer/src/store/setting/SettingSecureStore.ts`、`src/renderer/src/entity/setting/SettingSecured.ts`

## 2026-08 升级：聊天级目录白名单 + skill 脚本放行 + 可信区命令放行

### 1. 聊天级目录白名单（「此目录以后都允许」）

确认卡片（`ConfirmChatTool.vue`）在工具参数含 `path` 时显示勾选项「此目录以后都允许（仅本聊天）」；
勾选并批准后，`args.path` 的 `dirname` 进入本聊天的白名单，后续该目录内的路径操作与命令执行均免审批。
**仅本聊天生效**（不跨聊天、不写入全局安全中心），随 `AiChatContent.allowedDirs` 持久化。

数据流：

```
ConfirmChatTool 勾选批准 → bridge.resolve({ approved: true, allowDir })
  → runSingleTool（agentTools.ts confirm 分支）→ ctx.onAllowDir(dir)
  → AgentChat.allowDir(dir)（normalizePath 去重，写入 allowedDirs ref）
  → ChatSession watch allowedDirs → persist → AiChatContent.allowedDirs（chat_content.data）
裁决：AgentChat.buildPolicyContext 携带 allowedDirs 副本
  → defaultToolPolicy 前置判定（见下）→ httpDownloadPolicy 亦检查 allowedDirs
```

契约要点：

- `InteractiveDecision` 扩展 `ConfirmDecision { approved: boolean; allowDir?: string }`（interactive.ts，
  附 `isConfirmDecision` 类型守卫）；旧 boolean 决策仍兼容。
- `ToolPolicyContext` 新增 `allowedDirs`、`onAllowDir`、`skillRootDirs` 三字段。
- 白名单判定位于 `defaultToolPolicy` 顶部、`sandbox.enabled` 早退**之前**——勾选授权不依赖沙箱开关。
- 子 Agent 的 ctx 不携带 `allowedDirs` / `onAllowDir`（保持只读约束）；重启后经
  `findPendingInteractiveToolcall` 恢复的挂起确认卡片勾选逻辑照常可用。

### 2. skill 根目录内脚本免审批

`cli_run` 的 `command` 位于任一 skill agent 根目录
（系统默认 `~/.agents/skills`、`~/.mistrelle/skills` 与用户自定义 agent）之下 → allow，
不依赖沙箱开关。根目录集合由 `AgentChat.buildPolicyContext` 调 `skillAgentList()` 注入
`ctx.skillRootDirs`——**不是** toolPolicy 直接 import SkillService（其顶层 import `@/store`
barrel，会复活上文 TDZ 循环链，这是本次实现时踩过并修正的点）。

> 2026-08-26 默认工具精简：`python_run` / `node_run` 已删除，判定只剩 `cli_run` 的
> `command`（脚本路径或整条 shell 语句两种形态均保留）。

2026-08-25 增强：模型偶发把整条 shell 语句塞进 `command`（如 `find <skill 目录> -type f | head -20`），
路径前缀匹配不上。`isSkillScriptCall` 对整串 `command` 按空白拆 token，**所有路径 token
（`/` 或 `~/` 开头）均位于 skill 根目录下**才放行，防止借 skill 路径夹带外部路径；
写类命令指向 skill 目录内文件同样放行（黑名单与计划模式仍兜底）。背景见 docs/chat/15。

### 3. 可信区内命令免审批

命令类工具（`args.cwd` 存在时）工作目录位于 sandboxDir / workspace / allowedDirs 之内 → allow，
不依赖沙箱开关（用户选择 workspace 即视为认可）。缺省 cwd 不放行，维持原裁决。

### defaultToolPolicy 前置判定顺序（sandbox.enabled 早退之前）

1. skill 根目录内脚本（`isSkillScriptCall`，基于 `ctx.skillRootDirs`）
2. 聊天白名单目录内路径（`args.path` × `ctx.allowedDirs`）
3. 可信区内工作目录的命令（`args.cwd` × `isInTrustedZone`，现已含 allowedDirs）

其后原逻辑不变。边界语义：白名单与放行仅在默认模式（mode 0）生效；计划模式 shell 仍 ask、
写入 deny；完全访问模式本就 allow；安全中心黑名单覆盖层最后兜底（allow 升 ask），任何放行都无法跳过。

### 本次涉及文件

| 文件 | 改动 |
|------|------|
| `entity/ai/AiChat.ts` | `AiChatContent.allowedDirs?: string[]` |
| `modules/tool/toolPolicyTypes.ts` | ctx 新增 `allowedDirs` / `onAllowDir` / `skillRootDirs` |
| `modules/tool/toolPolicy.ts` | `isInTrustedZone` 扩展、三项前置判定、`isSkillScriptCall` |
| `modules/tool/policies/httpDownloadPolicy.ts` | 下载路径白名单放行 |
| `modules/chat/agent/interactive.ts` | `ConfirmDecision` + `isConfirmDecision` |
| `modules/chat/agent/agentTools.ts` | confirm 分支解析新决策并回写白名单 |
| `modules/chat/agent/AgentChat.ts` | `allowedDirs` ref、`setAllowedDirs` / `allowDir`、`buildPolicyContext`（两处内联 ctx 消重） |
| `modules/chat/agent/ChatSessionManager.ts` | 水合 / watch / persist `allowedDirs` |
| `components/chat/chat-assistant/tool/ConfirmChatTool.vue` | 勾选项 + 决策构造 |
