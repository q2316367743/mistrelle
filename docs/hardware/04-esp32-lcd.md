# 04 ESP32-S3-LCD-1.28 圆屏页面

> 伙伴窗口硬件页面（菜单「ESP32-S3-LCD-1.28」）：1.28 寸圆屏设备经串口接收两类 JSON 消息——
> **额度快照**（订阅公共额度域）与 **Buddy 事件状态**（/buddy/event 事件流转发）。
> 与红绿灯页面完全独立：独立串口连接（多端口并存）、独立配置文件（`~/.mistrelle/buddy/esp32-lcd.json`）。
> **额度插件是独立公共域**（不依附本设备，未来更多硬件消费），见 [docs/plugin/02-quota-plugins.md](../plugin/02-quota-plugins.md)。

## 实现思路

- **串口独立**：`SerialService` 多端口表（`Map<path, {port, baudRate}>`）让红绿灯与圆屏可同时各连一个设备；圆屏连接编排全部在 main（`esp32LcdService.connect/disconnect`，经 `esp32Lcd:connect/disconnect` IPC 暴露，连接成功即记忆 lastPort/baudRate、**主动断开与意外断开都清除 lastPort 并落盘**——下次启动不再自动连接，需手动连接一次重新记忆），连接运行态由 `esp32Lcd:state` 推送，渲染层纯展示。
- **配置独立**：`~/.mistrelle/buddy/esp32-lcd.json` 仅屏幕自身配置（lastPort/baudRate/eventForward/screenQuota），main 持有、整份保存、归一化兜底。
- **额度快照消费**：`initEsp32Lcd` 内 `subscribeQuotaSnapshot`（quotaBus，公共域发布）→ 已连接即下行 `{"type":"quota","items":[…]}`；本域不感知插件与调度，依赖单向。
- **事件转发**：本地事件服务 `/buddy/event` 经 buddyEventBus 发布（server 只发布），本域服务 init 内 `subscribeBuddyEvent` 订阅消费；缓存 `lastEvent` 推送渲染层，`eventForward` 开启且已连接时下行 `{"type":"event","platform":"…","event":"…"}`。协议为行协议 JSON（`\n` 分帧，UTF-8，**暂定可改**）。
- **启动即初始化**：`initEsp32Lcd()` 随 registerIpc 在 app ready 执行（无 init 类 IPC，不依赖渲染层）：加载配置 → 订阅事件总线/额度快照总线/意外断开（`onPortClosed`，自己的端口断了清 lastPort + 广播运行态）→ lastPort 非空才自动重连。
- **未连接不暴露配置（参考红绿灯）**：`Esp32Lcd.vue` 以 `connectedPath` 门控——未连接时额度快照与事件状态两块配置面板整体替换为 `LcdPlaceholder.vue` 占位提示（连接串口后即可配置屏显），连接成功后才渲染 `QuotaPanel`/`EventStatusPanel`。

## 配置结构（事实源 `@common/types/esp32Lcd.ts`）

```jsonc
{
  "lastPort": "",            // 上次串口（连接成功自动记忆、断开/意外断开即清除，启动时非空才自动重连）
  "baudRate": 115200,        // 波特率（LCD_BAUD_RATES 白名单内）
  "eventForward": true,      // 是否把 buddy 事件经串口转发给屏幕
  "screenQuota": "deepseek"  // 屏显额度插件键（builtin id / external 文件名；空 = 默认回落第一条）
}
```

- **`screenQuota` = 屏显额度选择**：额度快照聚合全部启用插件（额度是独立公共域，见 docs/plugin/02），屏上同时只显示一个额度——
  按键精确匹配对应插件的条目（该插件无带屏显字段条目时回落第一条带屏显字段者）。这是**屏幕自身的显示配置**
  （页面「屏显额度」面板下拉即改即存，写入本键；额度刷新节奏/插件管理在额度配置页），保存后 main 按最近快照重挑并补发一条心跳，即时生效
- 旧 quota 配置的 `screen` 键与快照 `main` 条目已废弃（职责归位到本键）；存量 `quota.json` 的 `screen` 由归一化丢弃，在圆屏页重选一次即可

## 串口下行协议：心跳行协议 v2（已定稿）

固件规范见 ESP32 固件仓库 `docs/protocol.md`（v14+ 固件，向后兼容 v1）。桌面端按协议推送心跳行：

```
HB,<status>,<seq>,<type>,<pct>,<value>,<unit>,<text>,<ts>   （, 分段、\n 结尾、整行 ≤127B）
```

- **事件 → status 映射**（`lcdProtocol.ts` 的 `LCD_STATUS_BY_EVENT`，未收录事件不上屏）：
  `session.created`→idle、`session.idle`→done（板端 3s 自动回 idle）、`session.error`→idle+文案「会话出错」、
  `message.part.updated`/`message.updated`→thinking、`tool.execute.before`→ask、`tool.execute.after`→thinking、
  `permission.asked`/`permission.updated`→permission、`permission.replied`→thinking、`command.executed`→thinking
- **锁存防覆盖**（`buddyEventLatch.ts`，语义分层见 [05](./05-buddy-event-protocol.md)）：permission/ask 落屏后锁存到
  释放事件（`permission.replied` / `tool.execute.after` / `session.idle` 等），done 落屏后 1.5s 内抑制 thinking 类事件——
  opencode 在 asked/idle 之后仍会推流式收尾事件（含插件 500ms 节流尾部补发，实测 +159~504ms），
  未加锁存时会把「等待授权/已完成」立刻覆盖回 thinking；被抑制事件不改 `lastStatus`、不下发心跳，
  `lastEvent` 缓存与推送保持全量不受影响；connect 后锁存重建、lastStatus 对齐 idle
- **额度 → type/pct/value/unit**：按 `screenQuota` 键取对应插件的屏显条目（`lcdProtocol.ts` `pickScreenQuota(snapshot, key)`；
  按键精确匹配失败回落第一条带屏显字段的条目。`QuotaItem.screenTemplate/screenPct/screenValue/screenUnit`，
  如内置 deepseek 设了最大额度 200、余额 110 → `deepseek,55,110.00,元`）；`screenPct` 缺省发 100——
  DeepSeek 未设置「最大额度」时以当前余额为分母（圆环满格），设置后按 余额/最大额度 随消耗下降（见 [docs/plugin/02](../plugin/02-quota-plugins.md)）
- **发送节奏**（协议建议）：事件命中映射立即发 status 行（携带最近屏显额度）；额度快照到达追加同状态额度行；空闲期每 5s 发 `beat` 保活（状态计时只被非 beat 消息刷新）；连接建立后发一条 `idle` 初始心跳
- 发送端约束：`value` 仅 `[0-9.]` ≤15 字符、`unit` ≤7 字节、`text` ≤23 字节（超长字节级截断）、seq 单调递增、整行超 127B 依次丢 text/unit 兜底
- `eventForward` 开关（圆屏页「向屏幕推送心跳」）控制全部下行（status 行 / 额度行 / beat）
- **集成门控**：EventStatusPanel 消费 `useIntegrations` 的 opencode 接入状态——missing 时心跳开关置灰 + warning alert 链接「设置-应用集成」；outdated 仅提醒不置灰；串口与额度面板不依赖集成、不受门控

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| common | `src/common/types/esp32Lcd.ts` | 屏幕域类型契约（Esp32LcdConfig/BuddyEventState/LcdRuntimeState/Esp32LcdApi）+ LCD_BAUD_RATES |
| common | `src/common/buddy/esp32-lcd/esp32LcdChannels.ts` | 通道常量（5 invoke + 2 推送） |
| main | `src/main/src/buddy/esp32-lcd/esp32LcdConfig.ts` | 配置读写与归一化（`~/.mistrelle/buddy/esp32-lcd.json`） |
| main | `src/main/src/buddy/esp32-lcd/lcdProtocol.ts` | 心跳行协议 v2 适配：事件→status 映射、屏显额度挑选、行组装（字节截断/整行长度兜底） |
| main | `src/main/src/buddy/events/buddyEventLatch.ts` | 事件锁存判定器（设备域共用工厂，本域与红绿灯各自实例化），防 permission/done/ask 被流式噪音覆盖 |
| main | `src/main/src/buddy/esp32-lcd/esp32LcdService.ts` | 单例：init（订阅事件/快照总线与意外断开 + 自动重连）、connect/disconnect 连接编排、onBuddyEvent 转发、writeLcdJson、运行态广播 |
| main | `src/main/src/buddy/esp32-lcd/esp32LcdIpc.ts` | handler 全集（配置/连接/运行态） |
| preload | `src/preload/src/modules/esp32-lcd/esp32Lcd.ts` | 薄封装；`src/preload/buddy.ts` 注入 `esp32Lcd` 域 |
| renderer | `windows/buddy/pages/hardware/esp32-lcd/` | `Esp32Lcd.vue` 骨架 + `useEsp32Lcd.ts` 域状态单例 + components/（LcdSerialPanel 含波特率下拉、QuotaPanel 屏显额度面板、EventStatusPanel 事件状态、LcdPlaceholder 未连接占位） |
| renderer | `windows/buddy/pages/settings/quota/` | 额度插件独立管理页（公共域，见 [docs/plugin/02](../../plugin/02-quota-plugins.md)） |

## 注意事项

- **逻辑在 main，渲染层纯展示**：连接/断开是域 IPC 指令（成功即由 main 记忆 lastPort/baudRate）；
  事件/运行态都是 main 推送（`esp32Lcd:event` / `esp32Lcd:state`），渲染层 composable 只做
  「先拉一次 getState 再订阅推送」的展示同步。
- **波特率下拉是连接参数**：连接成功后由 main 记忆进配置；已连接时改下拉不影响当前连接，重连生效。
- **额度管理在「额度配置」页**（伙伴窗口 设置-额度配置）：插件启停/settings、自动刷新间隔、立即刷新全在该页（公共域，见 [docs/plugin/02](../plugin/02-quota-plugins.md)）；本页 QuotaPanel 只做设备自己的事——「屏显额度」下拉（写本设备 esp32-lcd.json `screenQuota`）+ 上屏额度预览，不涉及额度刷新。
- DeepSeek 余额接口：`GET https://api.deepseek.com/user/balance`（Bearer 认证），
  响应取 `balance_infos[0].total_balance/currency`（插件实现在 quota 域 builtinPlugins）。
