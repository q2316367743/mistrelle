# 小米蓝牙语音遥控器页面 —— 本项目接入方案

> 2026-09-10 方案评审完成，**暂缓实施**。用户拍板的第一期范围见第 2 节。
> 前置阅读：[01-reference-projects.md](./01-reference-projects.md)、[02-atvv-protocol.md](./02-atvv-protocol.md)、[03-native-key-suppression.md](./03-native-key-suppression.md)。

## 1. 与本项目现状的关系

### 1.1 现有「小键盘」是什么

小键盘是**串口输入设备域**（ESP32 类设备经 9600 串口上报 `<键位>,<on|off>`，无行尾分隔符，由 `keypadProtocol` 文法流式解析）。链路：

```
设备 ──串口──► SerialService.subscribePortData ──► keypadProtocol 解析
     ──► keypadService.handleEvent（短按/长按判定）
     ──► ACTION_EXECUTORS 顺序执行动作序列（koffi 系统级模拟按键 / 打开应用 / 脚本 / 权限审批 / 延时 / 网页）
渲染层只发指令 + 展示运行态（keypad:state 推送）
```

**关键差异**：遥控器是 **BLE 设备**（不是串口），本项目**目前没有任何蓝牙或音频原生依赖**（`package.json` 只有 `serialport` / `koffi` / `sharp` 等；无 noble、无 node-hid、无音频库）。传输层必须新写。

### 1.2 可复用的部分（约 70%）

| 组件 | 现状 | 复用方式 |
|---|---|---|
| 动作序列机制（三端注册表 + 穷尽校验） | `@common/keypad/actions/`、`main/buddy/keypad/actions/`、`pages/hardware/keypad/components/actionEditors/` | **下沉为公共子系统**（第 3 节） |
| 短按/长按互斥判定 | `keypadService.handleEvent`（`holdTimers` + `KEYPAD_HOLD_MS = 600`） | 逻辑照搬到遥控器域服务 |
| 系统级模拟按键原语 | `keySimulator.ts`：koffi CGEventPost/keybd_event + `heldCombos` 引用计数 + `releaseAll` | **直接复用**，且它本就是为"按住不放"设计的 |
| 页面模式（键帽 + 右侧常驻面板 + 占位） | `Keypad.vue` / `useKeypad.ts` / `KeypadKeys.vue` / `KeypadPlaceholder.vue` | 结构照抄，改数据源 |
| 域接入套路 | `registerIpc.ts` 三处登记 + `@common/buddy/<域>/<域>Channels.ts` + `preload/buddy.ts` 挂一行 + `vite-env.d.ts` 声明 | 照抄 |
| 权限告警条 | `Keypad.vue` 的 `t-alert`（辅助功能） | 扩展为"输入监控 + 辅助功能" |

### 1.3 必须新写的部分

1. **BLE 传输层 + ATVV**（macOS：Swift sidecar）。
2. **原生按键抑制**（CGEventTap，见 03 文档）。
3. **音频解码 + 写虚拟声卡**（ADPCM → 48kHz → BlackHole）。
4. **虚拟声卡驱动检测与引导**。

## 2. 第一期范围（用户已拍板）

| 决策项 | 结论 |
|---|---|
| 平台 | **macOS 优先**（开发机即 macOS 25.5，与项目 C 的 macOS 26 匹配；Windows 二期） |
| 原生能力落地方式 | **独立辅助进程 sidecar**（Swift CLI，Electron spawn + JSON Lines）。理由：最贴近参考项目、可独立调试、崩溃不拖垮主进程、TCC 权限归属清晰 |
| 虚拟声卡 | **检测 + 引导用户安装现成驱动（BlackHole）**。不自研驱动、不碰 `/Library` 之外系统目录、不需要 sudo |
| 语音形态 | **只做系统麦克风**（遥控器麦 → 虚拟声卡 → 任意应用可用）。**不做应用内 ASR** |
| 配对 | **不做自己的配对流程**。要求用户在「系统设置 → 蓝牙」先配对，sidecar 用 `retrieveConnectedPeripherals` 附着（删掉整套 bonding/密钥协商） |
| 兜底 | sidecar 支持 `--mock`（假设备/假按键/正弦波电平），无硬件也能验收 UI |

### 2.1 被否决 / 暂缓的选项（记录理由，避免重复讨论）

- **koffi 进程内加载自研原生库**：BLE 是异步状态机 + 事件回调，用 FFI 回调实现很别扭；且仍是两套原生代码 + 构建步骤。
- **纯 TS 探路（noble + node-hid）**：noble 在 Windows 基本不可用（需 WinUSB 驱动 + 管理员）；macOS 上要为 Electron 39 重编原生模块。只适合做可行性验证，不适合终态。
- **自研并随包自动安装驱动**：app 目前 `notarize: false`，ad-hoc 签名的 HAL 插件在分发场景下的安装/加载稳定性有风险。
- **首期不做 DriverKit**：真设备级按键抑制需要 Apple 批准 entitlement + 用户装驱动，成本高一个量级。

## 3. Step 0：共享动作体系下沉 + 新增 `hold` 动作

### 3.1 为什么必须下沉

动作序列机制现在长在 keypad 域里。两个页面共用就必须按 AGENTS.md《组件存放规则》下沉到公共位置，否则只能跨页面 import 或复制约 600 行代码。

| 现在 | 迁到 |
|---|---|
| `src/common/keypad/actions/*` | `src/common/actions/*` |
| `@common/types/keypad.ts` 里的动作联合 / 修饰键 / 主键白名单 / `KeypadBinding` / `KEYPAD_HOLD_MS` | 新 `src/common/types/action.ts`（`KeypadAction`→`Action`、`KeypadBinding`→`ActionBinding`、`KEYPAD_HOLD_MS`→`ACTION_HOLD_MS`）；`keypad.ts` 原样 re-export |
| `src/main/src/buddy/keypad/actions/*` | `src/main/src/buddy/actions/*`（`KEYPAD_ACTION_EXECUTORS`→`ACTION_EXECUTORS`） |
| `pages/hardware/keypad/components/{KeypadSequenceEditor.vue, actionEditors/, actionText.ts, iconHref.ts}` | `src/renderer/src/components/action-sequence/`（`ACTION_EDITORS` / `ACTION_ICONS`） |

`keypad.ts` 保留 re-export，使 keypad 侧改动收敛到"改 import 路径"，零行为变更。完成后 `npm run typecheck` 验证。

### 3.2 新增 `hold` 动作（按住语义）—— 回答"长按持续触发"

**背景**：现有执行器接口**只有 `onPress`**（`src/main/src/buddy/keypad/actions/index.ts:16-18`），combo 执行器是"按下 → 固定 60ms → 自动抬起"的 tap 语义。文档记载 "push-to-talk 已移除"——序列化改造时把"按住保持"能力主动删掉了。底层原语 `pressCombo` / `releaseCombo` / `releaseAll` + `heldCombos` 引用计数仍在，只是没人用。

**执行器接口变更（唯一动骨架的地方）**：

```ts
export interface ActionExecutor<T extends Action = Action> {
  onPress(action: T): void | Promise<void>
  /** 可选：物理键抬起时结束（keep 模式抬起按键 / repeat 模式停止定时器） */
  onRelease?(action: T): void | Promise<void>
}
```

**新动作类型**（一个类型 + 模式下拉，不是两个类型）：

```ts
export type ActionHoldMode = 'keep' | 'repeat'   // keep=按住保持；repeat=按住重复敲击
export interface ActionHoldAction {
  type: 'hold'
  mode: ActionHoldMode
  modifiers: KeypadModifier[]
  key: KeypadKeyName
  delayMs: number       // repeat：首次重复前等待（默认 280，参考 remote-bridge-hub）
  intervalMs: number    // repeat：重复间隔（默认 40，下限 40）
}
```

- **`keep`**：序列执行到它时 `pressCombo` 且**不自动抬起**，物理键 `off` 时 `releaseCombo`。→ 语音输入 / push-to-talk。
- **`repeat`**：`onPress` 起 `delayMs` 后按 `intervalMs` 循环 `pressCombo` + 短按抬起，`onRelease` 清定时器。→ 长按持续触发。

**注册表登记（按既有"各端一文件 + 登记一行"）**：
1. `src/common/types/action.ts`：加接口 + `ActionHoldMode` / `ACTION_HOLD_MODES`（中文名映射，从元组派生）+ 并入 `Action` 联合 + `ActionType` 加 `'hold'`
2. `src/common/actions/hold.ts` + `actions/index.ts` 登记
3. `src/main/src/buddy/actions/holdExecutor.ts` + `index.ts` 登记（`onPress` + `onRelease`）
4. `src/renderer/src/components/action-sequence/actionEditors/HoldEditor.vue`（模式下拉 + 组合键录制 + repeat 参数）+ EDITORS/ICONS 登记

**服务层改动（共享序列执行器）**：`off` 事件现在只做短按分流，需扩展为「结束活动会话」：
- 每个键位维护 `activeSession`（记录本次按下执行过哪些动作）。
- `off` 时：清长按计时器 → 若处于长按分支按现有逻辑 → 无论如何，倒序对 `activeSession` 里声明了 `onRelease` 的动作调 `onRelease`。
- `resetPressed`（断开/拔线/保存）除 `releaseAll()` 外还要清 repeat 定时器。
- **零回归**：`actions` 里没有 `hold` 动作时，`off` 行为与现在完全一致。

**关键效果**：`hold` 放在 `actions`（短按序列）里 → **按下立刻开始保持/重复，松手结束**（语音要的就是这个）；放在 `holdActions`（长按序列）里 → 600ms 后开始。两种放法自然复用现有短按/长按双区块，**渲染层无需新增区块**（`KeypadBindingPanel.vue` 保持 214 行不动）。

## 4. 总体架构

```
┌─ Electron main（TS）────────────────────────────────────┐
│ buddy/xiaomi-remote/                                    │
│   xiaomiRemoteService  单例：配置 / sidecar 生命周期 /    │
│                        按键分发 / 动作序列 / 状态广播      │
│   xiaomiRemoteBridge    spawn + JSON Lines + 崩溃重启     │
│   xiaomiRemoteConfig    ~/.mistrelle/buddy/xiaomi-remote.json │
│   xiaomiRemoteIpc       通道注册                          │
│   remoteKeys            HID usage → 键位 id（事实源，跨平台）│
│   voiceDriver           BlackHole 检测 + 引导             │
└──────────────┬──────────────────────────────────────────┘
               │ stdio JSON Lines
┌──────────────▼─ Swift sidecar（resources/native/xiaomi-remote-mac/）─┐
│ BluetoothRemote  CoreBluetooth 附着已配对设备 + 自动重连   │
│ ATVV             caps 协商 / MIC_OPEN / EXTEND / CLOSE    │
│ Adpcm            IMA ADPCM 解码 + 去咔哒 + 低通 + 归一化   │
│ HIDKeys          IOHIDManager 只读按键（输入监控）         │
│ KeySuppressor    CGEventTap 丢弃原生事件（见 03 文档）     │
│ AudioSink        CoreAudio 写到目标输出设备 + 电平/试听    │
│ main             JSON Lines 分发 + --mock                 │
└──────────────────────────────────────────────────────────┘
```

**为什么 sidecar 顺带负责写声卡**：macOS 上"把 PCM 打进指定输出设备"只有 CoreAudio 一条路（Node 侧没有可用库），而 sidecar 本来就有原生代码，放进去零额外成本，也不需要在渲染层玩 `setSinkId`。

### 4.1 sidecar 协议（JSON Lines，双向）

- main → sidecar：`attach` / `detach` / `listDevices` / `listAudioTargets` / `setVoice{targetUid,monitor,gainDb}` / `setSuppress{keys,enabled}` / `shutdown`
- sidecar → main：`ready` / `devices` / `audioTargets` / `conn{state,deviceId,name,battery}` / `key{usage,phase}` / `voice{state,reason}` / `level{rms,peak}` / `perms{inputMonitoring,accessibility}` / `error`
- **键位 id 的事实源在 TS 侧**（sidecar 只发 raw HID usage），Windows 二期复用同一张表（HID usage 跨平台一致）。

## 5. 逐项实现

### 5.1 跨端契约

- `src/common/buddy/xiaomi-remote/xiaomiRemoteChannels.ts`：`getState` / `getConfig` / `scan` / `attach` / `detach` / `saveBindings` / `saveVoice` / `setSuppress` / `detectAudio` / `state`(推送)
- `src/common/types/xiaomiRemote.ts`（守既有约定：联合 type 独立命名 + `XxxOptions` 紧跟 + 全集从元组派生）：
  - `REMOTE_KEY_CODES` 元组（`up/down/left/right/ok/back/home/menu/power/tv/voice/volumeUp/volumeDown/mute`）→ `RemoteKeyId` / `RemoteKeyOptions`（中文名）/ `isRemoteKeyId`
  - `RemoteDevice` / `RemoteAudioTarget` / `RemoteVoiceConfig` / `XiaomiRemoteConfig` / `XiaomiRemoteState` / `XiaomiRemoteApi`
- 配置结构：

  ```json
  {
    "lastDeviceId": "",
    "bindings": { "ok": { "name": "", "actions": [], "holdActions": [] } },
    "voice": { "enabled": true, "targetUid": "", "monitor": false, "gainDb": 10 },
    "suppressNativeKeys": true
  }
  ```

  归一化照抄 `keypadConfig.ts`（动作逐条走 `normalize`，非法丢弃不落盘）。

### 5.2 main 域（`src/main/src/buddy/xiaomi-remote/`）

- `xiaomiRemoteBridge.ts`：`nativeBinPath()`（dev 相对 `__dirname` 回源；打包后把 `app.asar` 换成 `app.asar.unpacked`）+ spawn + 逐行解析 + 指数退避重启 + `app.once('will-quit')` 收尾
- `xiaomiRemoteService.ts`：单例，配置持有 / 附着编排（记忆 `lastDeviceId`）/ 按键 → 复用 `ACTION_EXECUTORS` 执行序列（含短按/长按互斥与 hold 会话）/ `broadcastState()`
- `remoteKeys.ts`：`HID_USAGE_TO_REMOTE_KEY: Record<number, RemoteKeyId>`（usage 值见 01 文档第 3.5 节）
- `voiceDriver.ts`：检测 `/Library/Audio/Plug-Ins/HAL/BlackHole2ch.driver` + 合并 sidecar 上报的输出设备；引导文案用现成 shell 桥 `openExternal` 打开下载页（**不新增通道**）
- `registerIpc.ts`：import + `registerXiaomiRemoteIpc()` + `void initXiaomiRemote()`（三处，与 keypad 同款）

### 5.3 preload / 渲染层契约

- 新增 `src/preload/src/modules/xiaomi-remote/xiaomiRemote.ts`（导出 `xiaomiRemoteApi`），`src/preload/buddy.ts` 挂一行（**主窗口 preload 不加**）
- `src/renderer/src/vite-env.d.ts` 加 `XiaomiRemoteApi` import + `xiaomiRemote` 字段（备注"仅伙伴窗口独立 preload 注入"）

### 5.4 页面（`src/renderer/src/windows/buddy/pages/hardware/xiaomi-remote/`）

```
XiaomiRemote.vue          页面壳：权限告警 + 设备面板 + 键位区/占位
useXiaomiRemote.ts        模块级单例（照抄 useKeypad 的 init/onState 模式）
components/
  DevicePanel.vue         扫描 / 附着 / 断开 / 电量 / 连接状态
  RemoteKeys.vue          遥控器键位区 + 右侧常驻面板容器
  RemoteKeyCap.vue        键帽（沿用 keypad 拟物视觉；语音键录音时脉冲态）
  RemoteBindingPanel.vue  名称 + 短按/长按，复用 ActionSequenceEditor
  RemotePlaceholder.vue   未连接占位
  VoicePanel.vue          驱动状态 + 引导安装 + 目标设备 + 电平表 + 试听开关
  remoteLayout.ts         遥控器外形布局（仿 keypadLayouts）
```

- 右侧面板：未选中键位显示 `VoicePanel`，选中键位切 `RemoteBindingPanel`。
- 路由 `/hardware/xiaomi-remote`（`windows/buddy/router/index.ts`）+ 菜单「小米遥控器」（`windows/buddy/App.vue` 的 menus，tdesign 图标）。
- 全部走 tdesign + token，弹窗用 `DialogPlugin` 命令式。

### 5.5 Swift sidecar（`resources/native/xiaomi-remote-mac/`）

SwiftPM 可执行包，模块对应第 4 节表格，一文件一职责。构建：

```json
"build:native:mac": "swift build -c release --package-path resources/native/xiaomi-remote-mac && cp … resources/native/bin/xiaomi-remote-bridge"
```

`electron-builder.yml` 的 `files` 排除 `resources/native/**/Sources` 与 `.build`（二进制靠现有 `asarUnpack: resources/**` 覆盖）。

### 5.6 打包与权限

- `electron-builder.yml` → `mac.extendInfo` 增加：
  - `NSBluetoothAlwaysUsageDescription`（**必需**，否则 CoreBluetooth 直接失败）
  - `NSInputMonitoringUsageDescription`（IOKit HID 读按键）
- ⚠️ **TCC 归属风险**：sidecar 是独立二进制，macOS 可能把「输入监控/辅助功能」授权归到它自己而非 Electron.app。现状是 keypad 的 `CGEventPost` 在 Electron 主进程里已能拿到辅助功能授权；sidecar 需**实机确认**归到哪个身份。对策：sidecar 放进 `.app/Contents/Resources` 内随包分发，若系统单独列出就在页面引导用户勾选。

## 6. 分阶段交付（每阶段独立可验收）

| 阶段 | 内容 | 验收点 |
|---|---|---|
| 0 | 共享动作体系下沉 + 新增 `hold` 动作（keep/repeat） | `npm run typecheck` 通过；小键盘行为零变化；小键盘上能试"长按重复" |
| 1 | 契约 + main 域骨架 + sidecar 桥（配 `--mock`） | 页面连 mock，按键高亮/状态推送/动作序列/绑定落盘全通 |
| 2 | Swift：BLE 附着 + HID 按键 + **CGEventTap 抑制** | 真机按键高亮；原生 Enter/方向键不再外泄；未绑定键仍走原生 |
| 3 | Swift：ATVV + ADPCM + CoreAudio 输出 | 装好 BlackHole 后，任意应用能把「BlackHole 2ch」当麦克风录到声音 |
| 4 | 语音面板（驱动检测/引导/目标设备/电平/试听）+ 文档 | 未装 BlackHole 时给引导，按键功能不受影响 |
| 5 | `docs/hardware/11-xiaomi-remote.md` + `docs/README.md` 索引一行；同步更新 `docs/hardware/07-keypad.md`（hold 动作、push-to-talk 语义恢复、四步指南变五步） | 索引与实际一致 |

> 按 AGENTS.md RL-07：验证与测试由用户执行，实现方只跑 `npm run typecheck`。

## 7. 风险与对策

| # | 风险 | 对策 |
|---|---|---|
| 1 | **TCC 权限归属**（5.6）：sidecar 的输入监控/辅助功能授权可能不归 Electron.app | sidecar 随包放进 app bundle；实机确认后按结果引导 |
| 2 | **按键误伤**：抑制是 keycode + 时间窗，遥控器按 OK 后 ~250ms 内真实键盘同 keycode 会被吞 | 写进文档；彻底解决需 DriverKit（不做） |
| 3 | **按键双触发**：若抑制未生效（权限没给），OK 会同时打出 Enter | 页面显示权限就绪状态，未就绪时明确告知 |
| 4 | **60 秒语音上限** | `MIC_EXTEND` 每 6s 续期；失败则静默重建会话 |
| 5 | **caps 版本差异**：v1.0/120B 与 v0.4/134B（头部字节序有差） | 两条分支都实现，靠 `GET_CAPS` 响应判定；`AUDIO_SYNC(0x0A)` 重置解码器 |
| 6 | **RC003 编码器状态继承**：每次物理会话重置 predictor/index 但设备不发 AUDIO_SYNC | 每次会话 `decoder.reset(0,0)`（项目 B 实证） |
| 7 | **Swift 工具链前置**：需 Xcode Command Line Tools | 若本机没有，阶段 1 先只交付 main + UI（mock 通路） |
| 8 | **ad-hoc 签名致 TCC 失效**（推测） | 保持构建产物身份稳定；文档提示 |
| 9 | **Windows 二期** | 通道/配置/协议/动作体系全平台无关，二期只补 C#/WinRT sidecar + VB-CABLE 引导，主进程与页面零改动；抑制可参考项目 B 的时间窗关联 |
| 10 | **不随包分发第三方驱动** | BlackHole 一律"检测 + 引导"，不碰 `/Library` 之外系统目录，不需要 sudo |

## 8. 未决问题

1. `GET_CAPS` 请求末两字节取值（三家不同），需实机探测。
2. sidecar 的 TCC 身份归属，需实机验证。
3. `hold` 动作是否需要 `keep` 模式的"松开后延迟释放"（对齐项目 C 的音频排空语义）—— 语音场景可能需要，待实现时定。
4. 语音键是否默认绑定到 `hold(keep)` + 某个听写热键组合（如右 Ctrl），还是仅开流不注入任何按键 —— 取决于用户实际用的输入法。
