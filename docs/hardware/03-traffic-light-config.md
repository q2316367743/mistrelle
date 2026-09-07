# 03 红绿灯配置（软件状态驱动）

> 红绿灯本质是「软件状态信号灯」：不同软件（如 Opencode）的不同事件可绑定不同灯态，事件到达时主进程按映射点亮串口灯。本文记录配置结构、两条核心规则、文件链路与事件接入方（opencode 插件）需知的接缝。串口通信本身见 [01-serial-traffic-light.md](./01-serial-traffic-light.md)。

## 实现思路

- **配置由 main 持有**：落盘 `~/.mistrelle/buddy/traffic-light.json`（目录不存在时惰性创建），启动加载进内存、保存全量覆写（写法同 auth 域）。事件映射不依赖渲染层——伙伴窗口不开也能亮灯
- **启动自动连接**：`initTrafficLight()`（app ready 后随 registerIpc 调用）按 `lastPort` 自动连上次串口；端口不在设备列表或连接失败时静默跳过，可在伙伴窗口手动重连
- **lastPort 记忆**：`trafficLight:connect` 连接成功后由 main 自动持久化（TrafficLightService.connect 内），供下次启动自动连接；**主动断开 / 意外断开（拔线）都会清除记忆串口并落盘**——下次启动不再自动连接，要恢复需手动连接一次（渲染层不经手）
- **两条核心规则**：
  1. **状态绑定唯一**：同一软件内一种灯态只能被一个事件绑定。main 保存时校验（违规返回 `{ok:false, msg}`），渲染层下拉中已被其它事件占用的灯态直接 disabled
  2. **软件互斥**：同一时间只允许一个软件启用。main 保存时归一（启用任一软件自动停用其余），当前仅 opencode，逻辑按多软件写
- **事件映射**：`applyEvent(software, event)` → 查启用软件的 bindings → 未启用/未绑定/串口未连接一律忽略；连续同指令去重（流式事件防刷串口）；禁用软件时主动发 `off` 清灯

## 配置文件结构

`~/.mistrelle/buddy/traffic-light.json`：

```json
{
  "lastPort": "/dev/tty.usbmodem1101",
  "config": {
    "opencode": {
      "enabled": true,
      "bindings": {
        "message.part.updated": "gs",
        "tool.execute.before": "yo",
        "session.idle": "go",
        "permission.asked": "ys",
        "session.error": "rs"
      }
    }
  }
}
```

- 灯态取值：`灯 r/g/y × 模式 o=常亮 s=闪烁 h=呼吸` → `ro/rs/rh/go/gs/gh/yo/ys/yh`，另有 `off` 全灭；全集以 `@common/types/trafficLight` 的 `LightStateOptions` 为唯一事实源（名称映射 + 派生 `LIGHT_STATE_CODES`）
- 绑定缺失 = 该事件不响应；`tool.execute.after` 默认不绑（工具结束后由后续回复事件自然带回绿闪）
- 磁盘数据经 `normalizeConfig` 归一化后才进内存：未知软件/事件/灯态剔除，字段缺失兜底

## Buddy 事件目录（红绿灯可绑定的全集）

红绿灯可绑定的事件 = Buddy 事件词汇表（`@common/types/buddyEvent.ts`，24 个，opencode bus 事件蓝本同名白名单），按组绑定（会话/消息/文件/权限/工具/其他）。常用默认绑定：

| 事件 | 含义 | 默认绑定 |
|------|------|----------|
| `message.part.updated` | 消息流式输出（正在回复） | 绿闪 `gs` |
| `tool.execute.before` | 开始执行工具 | 黄常亮 `yo` |
| `tool.execute.after` | 工具执行结束 | 不绑定 |
| `session.idle` | 会话空闲（回复完成） | 绿常亮 `go` |
| `permission.asked` | 等待授权确认 | 黄闪 `ys` |
| `session.error` | 会话出错 | 红闪 `rs` |

全集与分组、新增事件的扩展点见 [05-buddy-event-protocol.md](./05-buddy-event-protocol.md)；绑定 UI（OpencodePanel）按 `BUDDY_EVENT_GROUPS` 分组渲染。

## 事件接入方须知（opencode 插件投递）

**契约**：投递就是一条本地事件服务 URL，main 侧只有一份解析、校验与发布：

```
GET|POST http://127.0.0.1:47743/buddy/event?platform=<软件名>&event=<Buddy 事件名>
```

- `platform`：软件名（当前 `opencode`）；`event`：Buddy 词汇表事件名（白名单）
- **投递通道（唯一）**：本地事件服务 HTTP（`src/main/src/server/index.ts`，express 监听 `127.0.0.1:47743` 只绑回环，详见 `docs/server/01-event-server.md`）。不经过系统唤起，**结构性不抢焦点、零进程开销**；应用未运行时投递失败静默丢弃（灯灭语义正确，不会冷启动拉起应用）。原 `mistrelle://` 深链与 unix socket 方案均已删除，勿再引用
- 接收链路（pub/sub 解耦）：express 匹配 `/buddy/event` → 双白名单校验（`isSoftwareName` + `isBuddyEvent`）→ `publishBuddyEvent(platform, event)` 发布到 buddyEventBus → 各域服务 init 内 `subscribeBuddyEvent` 订阅消费（红绿灯映射灯态、ESP32 LCD 转发屏幕），**server 零业务依赖**
- 行为约定：软件未启用、事件未知、未绑定、串口未连接时静默忽略；与上次指令相同则去重不重发。每条请求在 `[server] 收到事件` 日志可见，配置在 main 启动即加载，接入方无需关心
- 手动调试：`curl 'http://127.0.0.1:47743/buddy/event?platform=opencode&event=session.idle'`

## 内置插件模板与安装（opencode 已接入）

官方约定：插件是 js 文件放入 `~/.config/opencode/plugins/`（全局，启动自动加载，无需改 opencode.json——该字段只用于 npm 包）。本应用内置模板 `resources/plugins/opencode/mistrelle-integration.js`，在伙伴窗口「设置-应用集成」页一键安装（详见 `docs/hardware/06-app-integrations.md`，原 trafficLight 域的 checkPlatform/installPlatform 已迁独立 integrations 域；曾用名 `mistrelle-traffic-light.js`，安装时自动清理旧名残留防双份投递）：

- **模板内容**：导出 opencode 插件函数，event hook 按 Buddy 事件词汇表白名单过滤（24 个，与 `@common/types/buddyEvent` 全集一致）；每事件独立 trailing 节流 500ms（`message.part.updated` 流式高频防请求风暴，尾部补发保证最终灯态不丢）；投递为纯 `fetch('http://127.0.0.1:47743/buddy/event?…')`（AbortSignal.timeout 1s，失败静默丢弃），零 node 内置模块导入（Bun 原生 fetch），不依赖插件 ctx；服务地址常量与 main 侧 `src/common/server/eventServer.ts` 各存一份（独立文件无法 import），注释互指
- **安装**：`integrations:install(software)` → `buddy/integrations/platformConfig.ts` 按软件分发 adapter → `mkdirSync(recursive)` + `copyFileSync` 覆盖写入目标文件 + 清理旧名残留，异常转 `{ok:false, msg}` 不抛错；安装后需重启 opencode 生效（UI 已提示）
- **检查**：`integrations:check(software)` → 三态 `PlatformConfigStatus`：`missing`（目标文件不存在）/ `outdated`（存在但内容与内置模板不一致，可更新）/ `ready`（内容一致）。内容逐字比对让模板升级可感知
- **门控联动**：集成未安装（missing）时红绿灯页软件面板的启用开关与事件绑定下拉整体置灰，面板顶部提示并链接「去安装集成」；待更新（outdated）仅黄条提醒不置灰（旧版插件功能仍正常）
- **模板文件可达性**：`resources/**` 整体在 `asarUnpack` 中，main 以 `join(__dirname, '../../resources/plugins/...')` 定位（与 drizzle/templates 同款范式），dev/打包均可达，未改 electron-builder.yml
- **扩展点**：`buddy/integrations/platformConfig.ts` 内 `ADAPTERS: Record<SoftwareName, PlatformAdapter>` 注册表，新软件加一项 adapter（check/install）即可，IPC 与 UI 通用

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| main | `src/main/src/buddy/traffic-light/trafficLightConfig.ts` | 配置读写（`~/.mistrelle/buddy/traffic-light.json`）、归一化、灯态唯一校验、软件互斥归一、默认绑定 |
| main | `src/main/src/buddy/traffic-light/TrafficLightService.ts` | 单例：initTrafficLight（加载+按 lastPort 自动连+订阅事件总线/意外断开）、连接编排 connect/disconnect（连接记忆 lastPort、断开/意外断开清除记忆并落盘）、sendCommand、applyEvent（事件→灯态→串口，总线订阅入口）、运行态 getState/broadcastState、saveSoftwareConfig、setLastPort |
| main | `src/main/src/buddy/traffic-light/trafficLightIpc.ts` | IPC：getConfig / saveSoftwareConfig / setLastPort / connect / disconnect / sendCommand / getState（事件消费不走 IPC；接入配置检查/安装已迁 integrations 域） |
| main | `src/main/src/buddy/integrations/platformConfig.ts` | 接入配置分发（应用集成域）：adapter 注册表 + opencode 实现（插件模板 → `~/.config/opencode/plugins/` 的三态检查与覆盖安装 + 旧名残留清理），详见 docs/hardware/06 |
| resources | `resources/plugins/opencode/mistrelle-integration.js` | 内置 opencode 插件模板（事件过滤 + 每事件 trailing 节流 500ms + 纯 fetch 投递本地事件服务） |
| main | `src/main/src/server/index.ts` | 本地事件服务：HTTP 事件路由 `/buddy/event` → 校验 + publishBuddyEvent（兼渲染层 `/file` 资源面，见 docs/server/01 与 hardware/05） |
| main | `src/main/src/buddy/events/buddyEventBus.ts` | Buddy 事件总线（subscribe/publish）：server 只发布，各设备域 init 内订阅，新增设备零改动 server |
| main | `src/main/src/registerIpc.ts` | 注册 trafficLightIpc 并触发 initTrafficLight |
| common | `src/common/types/trafficLight.ts` | 域类型 + 名称映射（每个 type 下方 `XxxOptions`）+ 全集常量（`*_NAMES`/`LIGHT_STATE_CODES` 从 Options 派生）+ `TrafficLightApi` 契约，跨端唯一事实源 |
| common | `src/common/buddy/traffic-light/trafficLightChannels.ts` | IPC 通道常量（`TrafficLightChannels`） |
| preload | `src/preload/src/modules/traffic-light/trafficLight.ts` | trafficLightApi 桥 |
| preload | `src/preload/buddy.ts` | **伙伴窗口独立 preload 入口**：仅注入 inject/serial/trafficLight/integrations/esp32Lcd/quota |
| renderer | `src/renderer/src/vite-env.d.ts` | `Window.preload.trafficLight: TrafficLightApi` 等桥声明（显式 import 自 @common） |
| renderer | `src/renderer/src/windows/buddy/pages/hardware/traffic-light/` | 页面：TrafficLight.vue 门面 + softwareRegistry.ts（页签登记）+ useTrafficLight.ts（配置状态单例）+ components/（SerialPanel / SoftwareTabs / ManualLightPanel / SoftwarePlaceholder）+ components/software/（各软件专属面板，如 OpencodePanel.vue；集成未安装时置灰并链接应用集成页） |

## 注意事项

- **软件页签 + 专属面板**：页面「软件接入」区按 `SOFTWARE_REGISTRY`（softwareRegistry.ts）渲染 t-tabs，每个软件一个页签；页签内容由 `SoftwareTabs.vue` 的 `PANELS: Record<SoftwareName, Component>` 映射到**该软件的专属面板组件**（`components/software/`，如 OpencodePanel.vue）——不同软件的功能按钮/事件 UI 可能完全不同，一律独立组件不做通用面板（Record 全量键保证加软件必须同时登记面板）
- **软件接入占位卡（未连接串口）**：门面 `TrafficLight.vue` 以 `connectedPath` 切换「软件接入」区——串口未连接渲染 `components/SoftwarePlaceholder.vue`（同款卡片外框 + 居中空态：渐变圆底 Usb 图标 + 「连接串口后即可配置软件接入」主副文案 + 按 `SOFTWARE_REGISTRY` 渲染的「可接入的软件」chips，图标由组件内 `SOFTWARE_ICONS: Record<SoftwareName, Component>` 登记），连接后切回真实 `SoftwareTabs`。占位卡旨在未连接时不暴露可交互配置面、并预示连接后能力；加软件时需同步在 `SOFTWARE_ICONS` 补图标
- **调试模式**：串口连接面板的「调试模式」按钮切换 `useTrafficLight` 的 `debugMode`（伙伴窗口本地状态），开启后门面才渲染「手动测试」面板（9 指令 + 全灭，经 `trafficLight:sendCommand` 下发，供接线/Arduino 调试）
- **集成门控**：软件面板（OpencodePanel）不负责插件安装（职责在「设置-应用集成」页），只消费 `useIntegrations` 的状态做门控——missing 置灰启用开关与绑定下拉 + 顶部 warning alert 链接跳转集成页；outdated 仅提醒不置灰
- **新增软件步骤**：`@common/types/trafficLight` 类型全集（`SoftwareName` + `SoftwareNameOptions` + 事件联合）→ `SOFTWARE_REGISTRY` 登记页签 → `SoftwareTabs.vue` 的 `PANELS` 登记专属面板组件 → main `trafficLightConfig.ts` 默认配置 → integrations 域 `platformConfig.ts` 补 adapter + `resources/plugins/<软件>/` 放内置插件模板 + 应用集成页 `INTEGRATION_REGISTRY` 登记（见 docs/hardware/06）；互斥/唯一校验自动生效
- **独立 preload**：伙伴窗口不再与主窗口共用 `out/preload/index.js`——`electron.vite.config.ts` preload 段双入口（index + buddy），`buddyWindow.ts` 将 `webPreferences.preload` 覆写为 `buddy.js`；buddy 入口仅注入 `inject`/`serial`/`trafficLight`/`esp32Lcd`（`inject` 供 App 外壳 `UseTitlePadding` 判平台），`window.preload.trafficLight` 仅伙伴窗口运行时存在（类型显式 import 自 `@common/types/trafficLight`，主窗口勿调用）
- **software 互斥实现陷阱**：`SoftwareName` 目前是单成员联合，循环里 `name !== software` 的字面量互斥比较会把键收窄成 `never`（赋值目标报 never）——互斥归一已收口在 `applySoftwareExclusion`（用 `string` 比较），后续加软件不要把比较改回同类型字面量
- **即改即存**：渲染层每次修改即调 saveSoftwareConfig，无论成败都回读 main 为准（失败自动回滚 UI 并 toast 原因）
- **手动测试面板**：由调试模式控制显隐（见上），与配置驱动互不干扰
- **串口协议**：9600 波特率、`\n` 分帧、open 触发 Arduino 复位约 400ms，详见 [01-serial-traffic-light.md](./01-serial-traffic-light.md)
