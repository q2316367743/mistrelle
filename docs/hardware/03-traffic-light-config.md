# 03 红绿灯配置（软件状态驱动）

> 红绿灯本质是「软件状态信号灯」：不同软件（如 Opencode）的不同事件可绑定不同灯态，事件到达时主进程按映射点亮串口灯。本文记录配置结构、两条核心规则、文件链路与事件接入方（opencode 插件）需知的接缝。串口通信本身见 [01-serial-traffic-light.md](./01-serial-traffic-light.md)。

## 实现思路

- **配置由 main 持有**：落盘 `~/.mistrelle/buddy/traffic-light.json`（目录不存在时惰性创建），启动加载进内存、保存全量覆写（写法同 auth 域）。事件映射不依赖渲染层——伙伴窗口不开也能亮灯
- **启动自动连接**：`initTrafficLight()`（app ready 后随 registerIpc 调用）按 `lastPort` 自动连上次串口；端口不在设备列表或连接失败时静默跳过，可在伙伴窗口手动重连
- **lastPort 记忆**：伙伴窗口串口连接成功后调 `trafficLight:setLastPort` 持久化，供下次启动自动连接
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

- 灯态取值：`灯 r/g/y × 模式 o=常亮 s=闪烁` → `ro/rs/go/gs/yo/ys`（Arduino 协议另支持 `h=呼吸`，未开放）
- 绑定缺失 = 该事件不响应；`tool.execute.after` 默认不绑（工具结束后由后续回复事件自然带回绿闪）
- 磁盘数据经 `normalizeConfig` 归一化后才进内存：未知软件/事件/灯态剔除，字段缺失兜底

## Opencode 事件目录（6 个）

| 事件 | 含义 | 默认绑定 |
|------|------|----------|
| `message.part.updated` | 正在回复（流式输出） | 绿闪 `gs` |
| `tool.execute.before` | 开始执行工具 | 黄常亮 `yo` |
| `tool.execute.after` | 工具执行结束 | 不绑定 |
| `session.idle` | 回复完成 / 等待输入 | 绿常亮 `go` |
| `permission.asked` | 等待授权确认 | 黄闪 `ys` |
| `session.error` | 会话出错 | 红闪 `rs` |

官方事件全集远多于此（file/lsp/session/todo/tui/shell…），只保留对「一眼看状态」有意义的 6 个；新增事件改 `trafficLightChannels.ts` 的 `OpencodeEventName` + `OPENCODE_EVENT_NAMES` 与渲染层 `softwareRegistry.ts` 中该软件的事件目录即可。

## 事件接入方须知（opencode 自定义协议插件）

opencode 侧插件把事件传给主进程的方式由插件方实现（不在本模块范围）；主进程侧的接缝是：

```ts
import { applyEvent } from '$/buddy/traffic-light/TrafficLightService'

// 收到事件后调用（software/event 均为运行时字符串，内部做合法性校验）
await applyEvent('opencode', 'session.idle')
```

行为约定：软件未启用、事件未绑定、串口未连接时静默忽略；与上次指令相同则去重不重发。配置文件在 main 启动即加载，无需接入方关心。

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| main | `src/main/src/buddy/traffic-light/trafficLightConfig.ts` | 配置读写（`~/.mistrelle/buddy/traffic-light.json`）、归一化、灯态唯一校验、软件互斥归一、默认绑定 |
| main | `src/main/src/buddy/traffic-light/TrafficLightService.ts` | 单例：initTrafficLight（加载+自动连）、applyEvent（事件→灯态→串口）、saveSoftwareConfig、setLastPort |
| main | `src/main/src/buddy/traffic-light/trafficLightIpc.ts` | IPC：getConfig / saveSoftwareConfig / setLastPort（applyEvent 不走 IPC） |
| main | `src/main/src/registerIpc.ts` | 注册 trafficLightIpc 并触发 initTrafficLight |
| preload | `src/preload/src/modules/traffic-light/trafficLightChannels.ts` | 通道常量 + 全部类型/全集常量（main/preload 契约唯一事实源） |
| preload | `src/preload/src/modules/traffic-light/trafficLight.ts` | trafficLightApi 桥 |
| preload | `src/preload/buddy.ts` | **伙伴窗口独立 preload 入口**：仅注入 inject/serial/trafficLight |
| renderer | `src/renderer/src/types/trafficLight.d.ts` | ambient 契约（与 preload 侧三份同步） |
| renderer | `src/renderer/src/windows/buddy/pages/hardware/traffic-light/` | 页面：TrafficLight.vue 门面 + softwareRegistry.ts（页签登记 + 灯态选项）+ useTrafficLight.ts（配置状态单例）+ components/（SerialPanel / SoftwareTabs / ManualLightPanel）+ components/software/（各软件专属面板，如 OpencodePanel.vue） |

## 注意事项

- **软件页签 + 专属面板**：页面「软件接入」区按 `SOFTWARE_REGISTRY`（softwareRegistry.ts）渲染 t-tabs，每个软件一个页签；页签内容由 `SoftwareTabs.vue` 的 `PANELS: Record<SoftwareName, Component>` 映射到**该软件的专属面板组件**（`components/software/`，如 OpencodePanel.vue）——不同软件的功能按钮/事件 UI 可能完全不同，一律独立组件不做通用面板（Record 全量键保证加软件必须同时登记面板）
- **调试模式**：串口连接面板的「调试模式」按钮切换 `useSerialLink` 的 `debugMode`，开启后门面才渲染「手动测试」面板（6 指令 + 全灭，供接线/Arduino 调试）
- **新增软件步骤**：channels 类型全集（`SoftwareName` + 事件联合 + `*_NAMES` 常量）→ `SOFTWARE_REGISTRY` 登记页签 → `SoftwareTabs.vue` 的 `PANELS` 登记专属面板组件 → main `trafficLightConfig.ts` 默认配置；互斥/唯一校验自动生效
- **独立 preload**：伙伴窗口不再与主窗口共用 `out/preload/index.js`——`electron.vite.config.ts` preload 段双入口（index + buddy），`buddyWindow.ts` 将 `webPreferences.preload` 覆写为 `buddy.js`；buddy 入口仅注入 `inject`/`serial`/`trafficLight` 三域（`inject` 供 App 外壳 `UseTitlePadding` 判平台），`window.preload.trafficLight` 仅伙伴窗口运行时存在（类型全局可见，主窗口勿用）
- **software 互斥实现陷阱**：`SoftwareName` 目前是单成员联合，循环里 `name !== software` 的字面量互斥比较会把键收窄成 `never`（赋值目标报 never）——互斥归一已收口在 `applySoftwareExclusion`（用 `string` 比较），后续加软件不要把比较改回同类型字面量
- **即改即存**：渲染层每次修改即调 saveSoftwareConfig，无论成败都回读 main 为准（失败自动回滚 UI 并 toast 原因）
- **手动测试面板**：由调试模式控制显隐（见上），与配置驱动互不干扰
- **串口协议**：9600 波特率、`\n` 分帧、open 触发 Arduino 复位约 400ms，详见 [01-serial-traffic-light.md](./01-serial-traffic-light.md)
