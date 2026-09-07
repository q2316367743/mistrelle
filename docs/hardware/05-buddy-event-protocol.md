# 05 Buddy 事件协议 v2（/buddy/event）

> 2026-09-07：事件投递接口从 `/buddy/traffic-light?event=<opencode 原生事件名>` 升级为
> `/buddy/event?platform=<软件>&event=<Buddy 事件词汇表>`：事件收口为**跨设备共享的白名单词汇表**，
> 红绿灯与 ESP32 LCD 等 buddy 设备统一消费同一事件流。**旧路径已删除**，旧版插件经内容比对
> 显示「待更新」，一键更新即迁移。

## 实现思路

- **词汇表事实源** `src/common/types/buddyEvent.ts`：`BuddyEventName` 联合 + `BuddyEventOptions`
  中文映射 + `BUDDY_EVENT_NAMES` 全集派生 + `isBuddyEvent` 白名单校验 + `BUDDY_EVENT_GROUPS` 分组
  （红绿灯绑定界面按组渲染）。命名以 opencode bus 事件为蓝本（同名白名单，未来接其他软件沿用扩展）。
  全集 24 个：会话 8（created/updated/deleted/diff/status/idle/compacted/error）+ 消息 4 +
  文件 2 + 权限 3 + 工具 2 + 其他 5（command.executed/todo.updated/pty.exited/vcs.branch.updated/
  installation.update.available）；排除 tui/lsp/ide 等硬件无关事件。
- **插件端**（`resources/plugins/opencode/mistrelle-integration.js`，曾用名 `mistrelle-traffic-light.js`，安装时自动清理旧名残留）：
  `EVENTS` Set 即词汇表白名单，命中才投递 `buddy/event?platform=opencode&event=<encodeURIComponent>`；
  每事件独立节流（500ms + 尾部补发）不变；投递失败静默丢弃不变。
- **服务端**（`src/main/src/server/index.ts` `dispatchEvent`）：path 判 `/buddy/event`；
  **零校验纯转发**——完整原始事件 `publishRawBuddyEvent(platform, event)` 发布到**原始事件总线**
  （`buddyEventBus.ts` 内 raw 段），server 零校验、零业务依赖。原始总线的**两个监听器**各取所需：
  ① `buddyEventFilter.ts` 白名单过滤——`platform`（isSoftwareName）与 `event`（isBuddyEvent）
  命中才 `publishBuddyEvent` **发布到校验后 buddyEventBus**，各设备域服务在**自身 init 内
  `subscribeBuddyEvent` 订阅消费**（TrafficLightService → 映射灯态；esp32LcdService → 转发屏幕）；
  ② `buddy/integrations/integrationsActivity.ts` 集成调试事件流——**全量**采集（含未命中白名单
  被丢弃的请求，打 accepted 标记）广播给伙伴窗口「设置-应用集成」页展示（见 hardware/06）；
  新增设备 = 新域服务订阅校验后总线，server 与总线零改动。
- **红绿灯兼容**：`trafficLight.ts` 的 `OpencodeEventName` 目录删除，`SoftwareLightConfig.bindings`
  键改 `BuddyEventName`；原 6 事件键名在词汇表中不变 → **存量配置 bindings 天然兼容，无需迁移**；
  默认绑定不变（message.part.updated→gs、tool.execute.before→yo、session.idle→go、
  permission.asked→ys、session.error→rs）。

## URL 契约

```
GET|POST /buddy/event?platform=<原文>&event=<原文>
→ server 零校验，原始事件发布到原始事件总线（publishRawBuddyEvent），204
  ├─ 监听器① buddyEventFilter：双白名单命中 → 发布校验后 buddyEventBus（各订阅域并发消费）；未命中丢弃
  └─ 监听器② integrationsActivity：全量采集（accepted 标记）→ 广播伙伴窗口调试展示
→ 其他 path：404
```

## 事件语义分层与锁存（防覆盖，2026-09-07）

opencode 在 `permission.asked`、`session.idle` 之后仍会推 `message.part.updated` / `message.updated`
（含插件 500ms 节流的尾部补发，实测滞后 +159~504ms），设备端若「最后命中事件直接赢」，
permission/done 状态会立刻被 thinking 类覆盖（等待授权显示成思考中、完成显示成思考中）。
为此事件在语义上分三层，事实源 `src/main/src/buddy/events/buddyEventLatch.ts`：

- **噪音类**（映射为 thinking 类）：`message.part.updated` / `message.updated` / `command.executed`
  ——锁存期内被抑制，且不改变锁存
- **释放类**（真实活动边界）：`permission.replied` / `tool.execute.before` / `tool.execute.after` /
  `permission.asked` / `session.created` / `session.idle` / `session.error`——解除现有锁存；
  其中 `permission.asked` / `permission.updated` / `tool.execute.before` / `session.idle`
  随后立即立新锁（锁存触发表）。注意 `tool.execute.after` 必须在释放集而非噪音集，
  否则 ask 锁永远解不开
- **元数据类**（session.updated/diff 等其余事件）：不触碰锁存、直接放行

锁存形态：`permission` / `ask` 无时限（等释放事件解锁）；`done` 仅在 1.5s 静默窗内抑制
（`DONE_QUIET_MS`，覆盖实测收尾事件与尾部补发），窗外新活动的流式事件正常放行。
消费方各自 `createBuddyEventLatch()` 持独立实例，feed(event) 返回 true 即跳过状态下发：

- **红绿灯**（绑定可配置）：`applyEvent` 对**全量事件先喂锁存器**（含未绑定事件——
  默认未绑定的 `permission.replied` 也要参与解锁，否则锁存链路断裂），被抑制的绑定事件跳过写串口
- **圆屏**（映射固定全集）：`onBuddyEvent` 命中 `LCD_STATUS_BY_EVENT` 后调用即可
  （全部触发/释放事件都在映射表内）；被抑制事件不改 `lastStatus`、不下发心跳，
  `lastEvent` 缓存与推送保持全量不受影响

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/common/types/buddyEvent.ts` | 词汇表事实源（type + Options + 全集派生 + 分组） |
| `resources/plugins/opencode/mistrelle-integration.js` | 投递方（白名单过滤 → /buddy/event，节流） |
| `src/main/src/server/index.ts` | dispatchEvent：路径判断 + 零校验转发原始事件（零业务依赖） |
| `src/main/src/buddy/events/buddyEventBus.ts` | 两条总线：原始事件总线（raw，server 发布）+ 校验后事件总线（typed，设备消费） |
| `src/main/src/buddy/events/buddyEventLatch.ts` | 事件锁存判定器（噪音/释放/触发表三层语义 + done 静默窗），设备域共用工厂、各自实例 |
| `src/main/src/buddy/events/buddyEventFilter.ts` | 监听器①：双白名单过滤，命中发布校验后总线 |
| `src/main/src/buddy/integrations/integrationsActivity.ts` | 监听器②：集成调试事件流全量采集（见 hardware/06） |
| `src/main/src/buddy/traffic-light/TrafficLightService.ts` | 订阅方①：事件→灯态（init 内 subscribe） |
| `src/main/src/buddy/esp32-lcd/esp32LcdService.ts` | 订阅方②：事件转发屏幕 + 推送渲染层（init 内 subscribe） |
| `src/renderer/src/windows/buddy/pages/hardware/traffic-light/components/software/OpencodePanel.vue` | 绑定 UI：按 BUDDY_EVENT_GROUPS 分组渲染（集成未安装时置灰，见 hardware/06） |

## 注意事项

- **新增事件**：只改 `buddyEvent.ts`（type + Options + 对应分组）与插件端 `EVENTS` Set 两处；
  红绿灯绑定/配置归一/圆屏转发随全集自动生效。
- **新增软件源**：`SoftwareNameOptions` 加软件 + 对应接入插件按同一词汇表投递（platform 参数区分）。
- `session.idle` 在 opencode 已弃用（推荐 `session.status`），因存量绑定仍保留在词汇表中，两者可绑定。
- 手动验证：`curl 'http://127.0.0.1:47743/buddy/event?platform=opencode&event=session.idle'` → 204；
  非法事件名（如 `event=foo`）→ 204 且不分发。
