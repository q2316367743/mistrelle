# 01 串口通信域与红绿灯页面

> 硬件控制页面的串口通信底座：main 侧 serialport **多端口**服务 + preload serial 只读桥（仅设备列表）+ 伙伴窗口内的硬件控制页面（红绿灯 / ESP32 LCD）。页面运行于独立伙伴窗口（见 [02-buddy-window.md](./02-buddy-window.md)），不在主窗口路由内。
> **架构约定（2026-09-07）**：连接/写入/断开等操作一律由各业务域服务（TrafficLightService / esp32LcdService）编排并经各自域 IPC 暴露，serial 域不面向渲染层——渲染层只发指令与展示运行态。

## 实现思路

硬件控制本质是串口通信页面。选型 `serialport`（v13，npm 原生模块），集成完全复用项目既有原生模块链路：

- **依赖**：`yarn add serialport` → dependencies；postinstall `electron-builder install-app-deps` 自动按 Electron ABI 重编 `@serialport/bindings-cpp`（与 better-sqlite3/sharp 同机制，无新增脚本）
- **构建**：electron.vite.config.ts 的 `externalizeDepsPlugin()` 已让 main/preload 依赖保持 external，无需额外配置
- **打包**：electron-builder 对 .node 文件默认解包（比照 better-sqlite3，未加 asarUnpack；如遇加载问题可比照 sharp 加 `'**/node_modules/serialport/**/*'`）
- **多端口模型**：`opened: Map<path, {port, baudRate}>`，多个硬件域可同时各连一个设备；意外断开经 `onPortClosed(cb)` 回调通知订阅方（各域服务 init 时注册，按 path 自行判断是否与自己相关），**不直接广播渲染层**

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| main | `src/main/src/modules/serial/SerialService.ts` | serialport 薄封装：多端口表 `Map<path>`；listPorts/openPort/writePort/closePort/getState + onPortClosed 回调注册表；模块不感知业务 |
| main | `src/main/src/modules/serial/serialIpc.ts` | `registerSerialIpc()` 只透传 `serial:list`（系统级只读查询） |
| preload | `src/preload/src/modules/serial/serialChannels.ts` | `SerialChannels`（仅 list）+ `SerialPortItem` 类型 |
| preload | `src/preload/src/modules/serial/serial.ts` | `serialApi` 桥（仅 list） |
| renderer | `src/renderer/src/types/serial.d.ts` | ambient 镜像契约（`SerialApi` 仅 list） |
| renderer | `src/renderer/src/windows/buddy/pages/hardware/traffic-light/` | 红绿灯页面：连接/指令走 `trafficLight:*` 域 IPC（见 [03-traffic-light-config.md](./03-traffic-light-config.md)） |
| renderer | `src/renderer/src/windows/buddy/pages/hardware/esp32-lcd/` | ESP32 LCD 页面：连接走 `esp32Lcd:*` 域 IPC（见 [04-esp32-lcd.md](./04-esp32-lcd.md)） |

## 数据结构 / API 契约

- **serial 域（渲染层可见）**：仅 `serial:list` → `SerialPortItem[]`（`SerialPort.list()` 精简为 `{ path, manufacturer? }`，展示用 `path（manufacturer）`）。设备枚举是系统级只读查询，两个硬件域下拉共用。
- **SerialService（main 内部，供域服务复用）**：`openPort(path, baudRate=9600)`（同 path 重开先关旧，多端口并存）/ `writePort(path, data)`（utf8，未连接抛错）/ `closePort(path)`（幂等）/ `getState()`（已开端口快照 `{ports:[{path,baudRate}]}`）/ `onPortClosed(cb)`（仅意外断开触发，主动 close 提前删表不触发）。

## 红绿灯指令协议（Arduino 端 main.cpp）

行协议，每条指令以 `\n` 结尾：`灯 + 模式` 两个字符，`off` 全灭。

| 指令 | 含义 | | 指令 | 含义 |
|------|------|--|------|------|
| `ro` | 红灯常亮 | | `gs` | 绿灯闪烁 |
| `rs` | 红灯闪烁 | | `gh` | 绿灯呼吸 |
| `rh` | 红灯呼吸 | | `yo` | 黄灯常亮 |
| `go` | 绿灯常亮 | | `ys` | 黄灯闪烁 |
| `yh` | 黄灯呼吸 | | `off` | 全灭 |

灯：r=红(~9) g=绿(~10) y=黄(~11)；模式：o=常亮 h=呼吸 s=闪烁。页面提供三模式 × 三灯共 9 个指令按钮 + 全灭（手动测试面板 `ManualLightPanel.vue` 的 `LIGHTS × MODES` 自动生成，经 `trafficLight:sendCommand` 下发）。

## 注意事项

- **页面在伙伴窗口独立入口**：不挂主窗口路由/菜单；主窗口 `App.vue` 的记忆系统、AppSide 等均不在伙伴窗口初始化（两 renderer 进程各跑一份记忆系统会双写）
- **渲染层无串口操作**：`useSerialLink`（渲染层连接状态镜像）已删除；连接/断开/指令都是域 IPC 指令，连接运行态由各域 `state` 推送（`trafficLight:state` / `esp32Lcd:state`），渲染层纯展示
- **选择不连接，需主动点「连接/断开」**：t-select 只记忆目标端口（预选 lastPort 也仅回显）。按钮语义：当前连接即所选（或已连接但下拉清空）→「断开」；未连/切换端口 →「连接」（main 侧 open 同 path 先关旧、多端口并存天然支持换设备）
- **Arduino open 复位**：打开串口会使 Arduino 复位（约 400ms），复位期间写入的指令可能丢失；红绿灯指令是状态量，用户重按即可，未做特判
- 菜单/子菜单均为手写 button 列表（项目约定，非 t-menu）；样式 token 用 `--fluent-*` / `--td-*`
