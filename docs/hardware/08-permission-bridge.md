# 08 - 权限审批基座（opencode 权限双向回传）

> 2026-09-09 落地。本地事件服务从「只进不出」升级为双向：opencode 发生权限请求时，
> mistrelle 侧（伙伴窗口面板 / 小键盘动作 / 外部 HTTP 脚本）可以回传允许/拒绝。
> 设计定位是**基座功能**：main 持有一个与业务解耦的权限注册表，任何消费者按设备能力
> 各自挂载（有按键的键盘做审批输入、无按键的圆屏未来做内容显示），依赖方向单向指向基座。

## 为什么不走 permission.ask 钩子

opencode 官方插件 API 定义了 `permission.ask` 钩子（`(input: Permission, output: { status }) => Promise<void>`），
但**当前版本（实测 3.1.4）没有接线**：二进制内不存在该钩子字符串（对照 `tool.execute.before` 等
钩子均存在），上游 issue sst/opencode#7006（钩子已定义未触发）仍未修复。
因此本方案走稳定公共 API 组合，不依赖钩子修复：

- 插件在 `event` 钩子里特判 `permission.asked` 总线事件（payload 含完整 `Permission`：`id/type/title/sessionID/pattern/callID/time`）；
- 决定回传调用 opencode 客户端 API `client.permission.respond({ sessionID, permissionID, response })`，
  `response ∈ 'once' | 'always' | 'reject'`（本方案映射：allow→`'once'`、deny→`'reject'`，'always' 留给终端原生交互）；
  运行时 feature-detect：新版客户端面 `permission.respond` 优先，旧版 SDK 回退 `client.postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response } })`。

事件与 respond 均为 opencode 公共契约，未来钩子修复后本方案不受影响。

## 架构分层（基座与业务解耦）

```
业务消费者（互不感知）                     基座                             接入适配
  伙伴窗口面板   ──IPC list/decide──►  permissionService  ◄──HTTP /ask /replied── opencode 插件
  小键盘动作     ──函数调用──►        （注册表/广播/决定）  ◄──HTTP /decide────── 外部脚本 / curl
  未来 LCD 屏显  ──subscribe()──►        ▲ 纯内存不落盘
```

| 层 | 文件 | 职责 |
|---|---|---|
| 基座类型 | `src/common/types/permissionRequest.ts` | `PermissionDecision`（allow/deny）、`PermissionResolveStatus`（allow/deny/ask，ask=无决定回落）、`PermissionRequestInfo`（含 `source` 来源标识）、`isPermissionDecision` 守卫、`PermissionApi` 桥契约 |
| 基座通道 | `src/common/buddy/permission/permissionChannels.ts` | `permission:list / permission:decide / permission:pending`（独立于 integrations 域） |
| 基座服务 | `src/main/src/buddy/permission/permissionService.ts` | 注册表（Map）、ingest/decide/cancel/listPending/subscribe、全量广播、超时结算 |
| 基座 IPC | `src/main/src/buddy/permission/permissionIpc.ts` | list / decide 两个 handler（registerIpc 注册） |
| 接入适配 | `src/main/src/server/index.ts` | `/buddy/permission/ask|replied|decide` 三个 POST 路由，thin 转调基座 |
| 接入插件 | `resources/plugins/opencode/mistrelle-integration.js` | asked 挂起询问 + replied 撤下 + respond 自动应答 |
| 消费者① | 伙伴窗口 `windows/buddy/pages/settings/integrations/`：`usePermissionRequests.ts` + `components/PermissionRequestPanel.vue` | 应用集成卡片内嵌「待审批请求」面板（按 `source` 过滤，空态隐藏） |
| 消费者② | keypad 三端注册表：`@common/keypad/actions/permission.ts` + `main .../actions/permissionExecutor.ts` + `actionEditors/PermissionEditor.vue` | 「权限审批」动作：按键 → 允许/拒绝最近一条待审请求，无待审空操作 |
| 消费者③ | `POST /buddy/permission/decide` | 外部脚本（如键盘「执行脚本」动作 curl）直接回传决定 |

## 契约细节

### HTTP 面（接入适配，JSON body）

| 路由 | 入参 | 行为 |
|---|---|---|
| `POST /buddy/permission/ask?source=opencode` | `{ permissionId, sessionID, type, title, pattern?, callID?, createdAt? }` | 归一为 `PermissionRequestInfo`（requestId = `sessionID + '/' + permissionId`）→ 基座登记并广播 → **挂起响应**至结算，回 `{ status: 'allow' \| 'deny' \| 'ask' }`；缺 permissionId/sessionID 回 400；客户端提前断开即撤下待审项（防幽灵条目） |
| `POST /buddy/permission/replied` | `{ requestId }` | 接入方原生侧已先行回答（终端回答/自动接受），撤下待审项，恒 204 |
| `POST /buddy/permission/decide` | `{ requestId, decision }` | 外部消费者回传决定；命中 204、无此待审项 404、参数非法 400 |

### IPC 面（渲染层消费者）

- `permission:list` → `PermissionRequestInfo[]`（窗口懒创建后补状态）
- `permission:decide(requestId, decision)` → `boolean`（是否命中）
- `permission:pending`（main → 渲染推送）→ 全量 `PermissionRequestInfo[]`，任何变更整体推送
- preload 桥 `src/preload/src/modules/permission/permission.ts`，注入伙伴窗口 preload（`permission: PermissionApi`）；
  主窗口运行时不存在该桥（与其他 buddy 域一致）。

### 基座语义

- **requestId 复合键**：`sessionID + '/' + permissionId`，防多会话/多 opencode 实例碰撞。
- **幂等**：同一 requestId 重复 asked 复用同一挂起 Promise，不重复入列。
- **超时**：基座 4.5min 无决定 → 按 `'ask'` 结算并从面板移除；插件 fetch 另有 5min AbortSignal 兜底。
  'ask' 语义 = 应用侧无决定，插件不调 respond，opencode 原生询问流程（终端 TUI）继续等待——**任何情况下都存在可用的审批出口**。
- **双端互答收敛**：终端原生回答 / 自动接受会广播 `permission.replied`，插件据此 POST /replied 撤下应用侧待审项；
  应用侧回答则经 respond 触发同一事件。竞态安全：opencode 侧先到者生效，迟到方（respond 报错或收到 'ask'）静默吞掉，原生回答永不被覆盖。
- **为何 POST 挂起而非 SSE**：审批是低频一次性请求-应答，挂起响应的响应体本身就是回程通道（插件端零关联逻辑）；
  无请求时零连接零状态，断开即 fetch reject → 自动回落原生询问。SSE 的重连/补发/心跳成本在此场景无收益。
- **纯内存**：不落盘；应用重启待审项清空，接入方超时自然回落原生流程。

## 插件端流程（mistrelle-integration.js）

```
permission.asked ──► canRespond? ──否──► 跳过（原生流程）
                        │是
                        ▼
        POST /ask 挂起（5min AbortSignal 兜底）
                        │ {status}
        allow ─► respond('once')   deny ─► respond('reject')   ask ─► 不回话
（任何异常静默，回落 opencode 原生询问；名字投递 forward 照常，红绿灯/圆屏不受影响）

permission.replied ──► POST /replied 撤下待审项（不节流；permissionID 兼容旧协议 requestID）
```

asked/replied 的双向处理独立异步链（`void`），不阻塞事件总线、不走 500ms 节流。

## 升级注意

- 模板内容变更 → 三态检测（逐字节比对）使存量安装自动变 **outdated**，需在「设置-应用集成」点更新并**重启 opencode**（既有约定）；旧版插件运行时行为不变（无双向能力）。
- 键盘「权限审批」动作落盘于 keypad.json bindings，新增动作类型经三端注册表穷尽校验（见 hardware/07 三步指南）。

## 扩展点（本期未实现）

- **LCD 屏显权限内容**：基座 `subscribePermissions(listener)` 已备 main 内消费者入口，
  圆屏显示请求标题/类型需扩展屏显行协议（HB 行）+ ESP32 固件配套渲染，接入时只需订阅基座。
- **更多接入来源**：`source` 为字符串标识，其他外部 agent 平台仿 opencode 适配层（HTTP 路由 + 平台侧回话 API）即可接入，基座零改动。
- **主窗口消费**：preload 桥模块是通用薄封装，其他窗口在各自 preload 注入 `permissionApi` 即可。
