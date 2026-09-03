# 01 串口通信域与红绿灯页面

> 硬件控制页面的串口通信底座：main 侧 serialport 单例服务 + preload serial 域桥 + 伙伴窗口内的硬件控制页面（首期仅「红绿灯」）。页面运行于独立伙伴窗口（见 [02-buddy-window.md](./02-buddy-window.md)），不在主窗口路由内。

## 实现思路

硬件控制本质是串口通信页面。选型 `serialport`（v13，npm 原生模块），集成完全复用项目既有原生模块链路：

- **依赖**：`yarn add serialport` → dependencies；postinstall `electron-builder install-app-deps` 自动按 Electron ABI 重编 `@serialport/bindings-cpp`（与 better-sqlite3/sharp 同机制，无新增脚本）
- **构建**：electron.vite.config.ts 的 `externalizeDepsPlugin()` 已让 main/preload 依赖保持 external，无需额外配置
- **打包**：electron-builder 对 .node 文件默认解包（比照 better-sqlite3，未加 asarUnpack；如遇加载问题可比照 sharp 加 `'**/node_modules/serialport/**/*'`）

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| main | `src/main/src/modules/serial/SerialService.ts` | serialport 薄封装：模块级单例持有一个 `SerialPort`；list/open/write/close/getState；意外断开广播 |
| main | `src/main/src/modules/serial/serialIpc.ts` | `registerSerialIpc()` 透传（已注册进 `src/main/src/registerIpc.ts`） |
| preload | `src/preload/src/modules/serial/serialChannels.ts` | `SerialChannels` 常量 + 契约类型（`SerialPortItem`/`SerialState`） |
| preload | `src/preload/src/modules/serial/serial.ts` | `serialApi` 桥（含 `onData`/`onClosed` 订阅，auth 先例）+ 挂载进 `src/preload/index.ts` |
| renderer | `src/renderer/src/types/serial.d.ts` | ambient 镜像契约（`SerialApi` 等，修改需与 preload 侧同步） |
| renderer | `src/renderer/src/vite-env.d.ts` | `Window.preload.serial: SerialApi` |
| renderer | `src/renderer/src/nested/buddy/App.vue` | 伙伴窗口外壳：左侧功能菜单（`menus` 数组驱动，与主窗口 AppSide 同构）+ common-operator 折叠按钮 + router-view |
| renderer | `src/renderer/src/nested/buddy/pages/hardware/traffic-light/TrafficLight.vue` | 红绿灯面板（纯内容页）：串口选择 + 连接状态 + 指令按钮 |
| renderer | `src/renderer/src/nested/buddy/pages/hardware/useSerialLink.ts` | 连接状态模块级单例 composable |
| renderer | `src/renderer/src/nested/buddy/router/index.ts` | 伙伴窗口独立路由表：`/` → `/hardware/traffic-light` |

## 数据结构 / API 契约

IPC 通道（`SerialChannels`）：`serial:list` / `serial:open` / `serial:write` / `serial:close` / `serial:getState` / `serial:data`（推送）/ `serial:closed`（推送）。

- `list(): Promise<SerialPortItem[]>`：`SerialPort.list()` 精简为 `{ path, manufacturer? }`（v13 的 `PortInfo` 无 friendlyName 字段，展示用 `path（manufacturer）`）
- `open(path, baudRate?)`：默认 **9600**（与 Arduino 端 `Serial.begin(9600)` 一致）；已开则先关旧的；同一时间只开一个串口
- `write(data)`：utf8 写入，未连接 reject
- `closed` 推送：仅**意外断开**（拔线/驱动错误）；渲染层主动 close 时 main 已提前清引用，不广播
- `data` 推送：收到字节原样 utf8 转文本广播全窗口（未引 parser 包，分帧留给消费方）

## 红绿灯指令协议（Arduino 端 main.cpp）

行协议，每条指令以 `\n` 结尾：`灯 + 模式` 两个字符，`off` 全灭。

| 指令 | 含义 | | 指令 | 含义 |
|------|------|--|------|------|
| `ro` | 红灯常亮 | | `gs` | 绿灯闪烁 |
| `rs` | 红灯闪烁 | | `yo` | 黄灯常亮 |
| `go` | 绿灯常亮 | | `ys` | 黄灯闪烁 |
| `off` | 全灭 | | | |

灯：r=红(~9) g=绿(~10) y=黄(~11)；模式：o=常亮 h=呼吸 s=闪烁。**页面首期只提供 o/s 两模式 6 个按钮 + 全灭**，h（呼吸）协议已支持、页面暂不提供，后续拓展在 `TrafficLight.vue` 的 `MODES` 数组加一项即可。

## 注意事项

- **页面在伙伴窗口独立入口**：不挂主窗口路由/菜单；主窗口 `App.vue` 的记忆系统、AppSide 等均不在伙伴窗口初始化（两 renderer 进程各跑一份记忆系统会双写）
- **连接状态跨页面存活**：主进程端口是单例；`useSerialLink.ts` 模块级单例镜像状态（首次调用 `getState()` 回同步已有连接 + 重新订阅 `closed`），窗口隐藏再显示连接不丢
- **选择即连接**：t-select 选中 → 自动 open（即「尝试通信」，Arduino 端无应答协议，open 成功即视为已连接）；清空选择或点「断开」→ close
- **Arduino open 复位**：打开串口会使 Arduino 复位（约 400ms），复位期间写入的指令可能丢失；红绿灯指令是状态量，用户重按即可，未做特判
- `useSerialLink.handleSelect` 参数为 `unknown`（t-select change 回调是 `SelectValue` 联合类型），内部归一为 string
- 菜单/子菜单均为手写 button 列表（项目约定，非 t-menu）；样式 token 用 `--fluent-*` / `--td-*`
