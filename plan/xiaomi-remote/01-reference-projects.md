# 小米蓝牙语音遥控器 —— 三个开源参考项目精读

> 2026-09-10 调研。三个仓库均直接读源码（含 GitHub REST API 列目录 + raw 源码逐行精读），非二手转述。
> 结论：三家**全部是 PC 端直连 BLE**（不经串口 dongle），语音**全部是同一套 ATVV 协议**，但**原生按键抑制手段三平台各异**。

## 0. 速览对比

| 维度 | A) MiVibe-Remote | B) remote-bridge-hub | C) pub-ai-inputs / 小米遥控器 |
|---|---|---|---|
| 仓库 | `Fanatical-Naturalist/MiVibe-Remote` | `xxb26553663-star/remote-bridge-hub` | `LYiHub/pub-ai-inputs` → `小米遥控器/` |
| 平台 | Windows 11 x64 24H2+ | Windows 10 1809+ x64 | **macOS 26+** |
| 技术栈 | C# / .NET 9（WPF 托盘）+ Python(Frida) + Inno Setup | Python 3.12 + PyInstaller + Frida Gadget + Inno Setup | **Swift 6.2 / SwiftPM** + AppKit/CoreAudio/CoreBluetooth/IOKit |
| 许可 | MIT | GPL-3.0 | 未标注（依赖 MIT） |
| 连接 | BLE / WinRT GATT | BLE / WinRT GATT | **BLE / CoreBluetooth** |
| 语音协议 | ATVV（AB5E 服务）+ IMA ADPCM | ATVV + IMA ADPCM | ATVV + IMA ADPCM |
| 虚拟麦克风 | 第三方 VB-CABLE（用户自装） | 第三方 VB-CABLE（安装包内置并自动装） | **自研 CoreAudio HAL 插件** `MiMic Probe 2ch` |
| 原生按键抑制 | ❌ 全局 Scancode Map 改写 + 全局钩子 | ⚠️ 钩子 + 设备信号时间窗关联 | ⚠️ **CGEventTap 丢弃 + HID 窗口** |
| 长按重复触发 | ❌ 无（全部 one-shot 去抖） | ✅ 有（back/音量） | ❌ 无（但语音键保持按住） |
| 管理员权限 | 安装器需 admin；增强按键每次启动需 admin | 装 VB-CABLE 一次确认；Frida 注入需提权 | 装 HAL 驱动需 sudo |

**共同事实**：小米蓝牙语音遥控器 2 Pro 的 `VID = 0x2717`、`PID = 0x32B8`（项目 A 记录 `REV 00A4`）。遥控器在系统里**同时**是一个标准 BLE HID 键盘（HID over GATT，usage page 0x07）和一个 ATVV 语音设备。

---

## 1. 项目 A：MiVibe-Remote（Windows）

### 1.1 连接与逆向出的 GATT 结构（`docs/GATT_MAP.md`）

- 通过 WinRT `Windows.Devices.Bluetooth`（GATT 客户端）连接，非经典蓝牙 SPP。
- 发现 9 个服务：
  - **ATVV**：`AB5E0001-5A21-4F05-BC7D-AF01F617B664`，特征 `AB5E0002`(TX/Write)、`AB5E0003`(Audio/Notify)、`AB5E0004`(Control/Notify)
  - 小米厂商自定义：`8A7A0001-…`，特征 `0102`/`0103`/`0112`（均 Notify，用途推测承载返回/音量键；**完整 128-bit UUID 在文档中被 `...` 截断，未获取到**）
  - 未知厂商：`000001BF-…`（特征 `00000001`，Write Without Response）
  - DFU `0xFE59`；标准 `1800/1801/180A/180F`
  - **标准 HID `0x1812` 被 Windows 系统驱动占用，characteristic 枚举返回 `AccessDenied`**

### 1.2 按键处理

- 遥控器以 BLE HID Keyboard 呈现：麦克风键被 Windows 翻译为 `VK_F5 0x74`（scan `0x3F`）；电源键 scan code `E0 5E`；TV 键为反引号 `VK_OEM_3 0xC0`。
- **返回、音量加/减不进入 Windows 普通输入栈**（`docs/HARDWARE_MAP.md` 两轮采样确认 Raw Input、全局翻译、`WM_APPCOMMAND` 均无事件）。
- 增强按键方案 = **Frida 只读旁路**（`src/MiVibe.Remote.KeyBridge/hid_tap.js`）：hook `ntdll.dll` 的 `NtDeviceIoControlFile`，IOCTL `0x80018483`，**缓冲区长度 9 字节**（注意：不是 121 —— 121 是 HID descriptor 里 max input report 大小，也是普通 `ReadFile` 被 `Access Denied` 拒绝的那个 collection）。
  - 文件头明确定位：`// Observe only the verified RC003 synchronous, nine-byte HidOverGatt format. No report modification, input injection, sockets, files, or permanent scripts.`
  - 解析：`bytes[0..2]` 为前缀 `01 00 00`，之后每 2 字节一个小端 16-bit usage。
  - 目标 usage 仅三个：`0xF1`=back、`0x80`=volume_up、`0x81`=volume_down；其余计入 `other`。
  - **严格只读**：只 `readByteArray(9)`，从不写回、不改 `retval`。因此**不能吞掉或改写 HID 报告**。
- 系统级映射（注册表 `HKLM\SYSTEM\CurrentControlSet\Control\Keyboard Layout\Scancode Map`，`installer/MiVibe.Remote.iss` 与 `tools/keyboard-remap/*.ps1`）：
  - 电源键 `E0 5E` → Numpad Divide `E0 35`
  - F5 `00 3F` → F13 `00 64`（把麦克风键变成"安静占位键"）
  - **全局生效**：脚本自己警告 "the physical F5 key on every keyboard will also become F13"，无法按设备区分。
  - 为什么需要：Typeless 应用拒绝 `SendInput` 注入（`docs/DECISIONS.md` D-020），只接受系统认为是实体按键的事件；且 F5 长按会以约 32ms 间隔自动重复，触发记事本插入日期时间等副作用（D-019）。

### 1.3 原生按键抑制（关键结论）

**项目 A 没有做到"系统收不到原生按键"，且仓库自己承认。** README 原话：

> Enhanced keys do not install global suppression for native Back/Volume keyboard events.

`docs/DECISIONS.md` D-025 根因写得更直白：

> Windows 低级键盘钩子返回非零后，事件不会继续进入用于设备归属的 Raw Input 路由；而不先抑制时，原始反引号已发送到前台应用，事后无法安全撤回……**真正无损的设备级变换需要 HID 过滤驱动或等价的设备级输入组件。**

实际手段是三件套，全部**不区分设备**：

| 手段 | 文件 | 条件 |
|---|---|---|
| Scancode Map | `installer/MiVibe.Remote.iss`、`tools/keyboard-remap/*.ps1` | 全局改写 F5→F13、Power→NumpadDivide |
| 低级键盘钩子（F5） | `F5SuppressionHook.cs` | `VK_F5` 且非注入 → `return new IntPtr(1)`；**仅旧 `--typeless-live` 模式** |
| 低级键盘钩子（Menu/Home） | `RemoteKeyActions.cs` | `VK_APPS 0x5D` / `VK_HOME 0x24` 且非注入 → 吞掉并入队动作；常驻路径 |

- 决策链（43 条 DECISIONS 浓缩）：**不写驱动（D-002/005）→ 想要驱动（D-014 批准过最小 KMDF 虚拟 HID 键盘 + 微软签名，限定隔离 VM）→ 用注册表映射绕过（D-017~D-021）→ 用 Frida 旁路替代 filter 驱动（D-041/042）**。签名驱动被保留为"未来高级路线"。

### 1.4 语音实现（`src/MiVibe.Remote.GattProbe/AtvvVoiceCapture.cs`）

- **重要纠正**：`MIC_OPEN` / `MIC_CLOSE` **不是**"按下发开、抬头发关"。实际是：
  - `GET_CAPS` 与 `MIC_OPEN` 在**会话启动时各发一次**（与物理按键无关）
  - `MIC_CLOSE` 在**捕获结束/异常/退出清理时**才发
- **按下/抬起事件来源 = BLE ATVV CONTROL 通知（`AB5E0004`）**，不是 Windows VK 消息、也不是 Frida HID 报告：

  ```csharp
  case 0x00 when bytes.Length >= 2 && bytes[1] == 0x02:  // AUDIO_STOP reason 0x02
      EndPhysicalSegment(bytes[1]); SetTypelessActive(false); break;
  case 0x04 when bytes.Length >= 4:                       // AUDIO_START
      streamId = bytes[3];
      if (bytes[1] == 0x03) { BeginPhysicalSegment(); SetTypelessActive(true); }  // 0x03 = Hold-to-Talk
      ...
  ```

  `docs/PROCESS_LOG.md` 明确：改用 ATVV 语音状态做关联，是因为"遥控器物理开麦会产生独有的 reason `0x03` Hold-to-Talk 通知……**不依赖无法识别设备来源的 F5 翻译事件**"。
- Frida 旁路**不含**麦克风/F5（只识别 back/volume_up/volume_down 三个 target）。
- **MIC_EXTEND 每 8 秒**（`WaitForCaptureAsync`，`[0x0E, streamId]`）；写失败即抛异常 → 托盘按 2/5/10/30 秒退避重连（D-028）。
- 音频落地：`CableAudioRenderer.cs` 用 NAudio 找 `CABLE Input` 渲染端点，`BufferedWaveProvider` + `WasapiOut` 写入 VB-CABLE。
- **VB-CABLE 不随包分发**，要求用户自行到 vb-audio.com 安装。

### 1.5 长按 / 重复触发

**没有**"按住 A 持续触发 B"的实现。全部 one-shot：`hid_tap.js` 按 signature 去重（`test_hid_tap.cjs` 断言 `'held repeats are suppressed'`）；`RemoteKeyActions.cs` 用 `keyDown` 标志去抖自动重复；`QUICK_START.md`："Both fire once per press, including a long hold."

### 1.6 关键文件

```
src/MiVibe.Remote.GattProbe/   AtvvVoiceCapture.cs(协议+采音) ImaAdpcmDecoder.cs CableAudioRenderer.cs
                               RemoteKeyActions.cs F5SuppressionHook.cs MenuVoiceShortcutHook.cs
                               TypelessShortcut.cs PhysicalMicrophoneKeyState.cs Program.cs
src/MiVibe.Remote.KeyBridge/   hid_tap.js(只读旁路) bridge.py calibration.py main.py windows_host.py
src/MiVibe.Remote.Tray/        EnhancedKeyBridge.cs TrayApplicationContext.cs
installer/MiVibe.Remote.iss    Scancode Map 写入
tools/keyboard-remap/          Enable-SplitVoiceRemap.ps1 等
docs/                          GATT_MAP.md HARDWARE_MAP.md DECISIONS.md(43条) QUICK_START.md
                               PROCESS_LOG.md SPLIT_VOICE_REMAP.md HID_DIAGNOSTIC_2026-09-05.md
```

### 1.7 README 自述限制

- 映射是系统全局的，每个物理 F5 都变 F13；凡发出 scan code `E0 5E` 的键都变 Numpad Divide。
- 未暂停时会拦截物理 Menu/Application 与 Home 键。
- 实测遥控器连续按住麦克风约 60 秒会中断。
- 增强按键需管理员权限；驱动宿主重连后需重新校准（Back → Volume+ → Volume−）。
- 不安装 HID filter 驱动、不改 TV 键。
- 安装包**未签名**，SmartScreen 会警告。

---

## 2. 项目 B：remote-bridge-hub（Windows）

### 2.1 连接与协议常量

- BLE / WinRT（`BluetoothLEDevice` + `GattDeviceService.get_device_selector_from_uuid`），asyncio 事件循环。
- ATVV UUID 同 A：`ab5e0001/0002/0003/0004-5a21-4f05-bc7d-af01f617b664`。
- HID over GATT service `00001812-0000-1000-8000-00805f9b34fb`，用 Report `00002a4d` 等读取（回退路径）。
- 命令常量（`atvv_record.py`）：**`GET_CAPS_V10 = 0A 01 00 00 03 03`**（注意末尾与 A 的 `...00` 不同）→ 记为固件差异，实现时应容错。

### 2.2 原生按键抑制（关键结论）

**是「旁路读取 + 设备关联性的用户态低级键盘钩子部分抑制」，不是系统收不到。**

- Frida Gadget 17.15.3（x64）注入 `WUDFHost.exe`：`hid_tap_injector.py` 用 `CreateRemoteThread` + `LoadLibraryW`（**需管理员** `SeDebugPrivilege`），目标进程通过注册表 `BTHLEDevice` 下 `HostPid` 定位；校验 Gadget SHA-256。
- JS 脚本（`hid_tap_runtime.py` 内嵌 `GADGET_SCRIPT`）hook `ntdll!NtDeviceIoControlFile`，`READ_CHARACTERISTIC_IOCTL = 0x80018483`，`EXPECTED_OUTPUT_LENGTH = 9`，**纯只读**，emit 到本机 TCP（端口 `30684`）。
- 解码（`hid_report_tap.py`）：

  ```python
  def decode_rc003_ioctl_output(data: bytes) -> bytes | None:
      if len(data) != 9 or data[:3] != b"\x01\x00\x00":
          return None
      return data[3:9]
  ```

  `FORWARDED_USAGES` 共 13 个：`0x00F1,0x0028,0x0035,0x004A,0x004F,0x0050,0x0051,0x0052,0x0065,0x0066,0x007F,0x0080,0x0081`。
  注释原文：`# 0xF1 is the Linux/Android KEY_BACK extension that Windows kbdhid drops.`
- **真正吞键的是 `WH_KEYBOARD_LL` 钩子（`atvv_live_bridge.py` 的 `XiaomiSpecialKeyHook`）返回 1**，但**必须与同设备 direct HID 信号在时间窗内关联**才吞：

  ```python
  if self._first_button_action(key_name) is None:
      return self._call_next(code, wparam, lparam)
  timeout = 0.06 if key_name in self.WAIT_FOR_DIRECT_SIGNAL else 0.015
  matched = self._wait_for_direct_signal(key_name, timeout)
  if not matched:
      return self._call_next(code, wparam, lparam)
  ```

  - 时间窗：普通键 **15ms**、`{tv,home,menu,power}` **60ms**、F5 **80ms**。
  - 语音 F5 抑制（`_should_suppress_voice_f5`）额外要求与 ATVV 控制包 `0x08`（START_SEARCH）/`0x04`（AUDIO_START）关联（`mark_voice_signal()`），并记住 key-down 以便连同 key-up 与重复一起吞；**普通 F5 无关联则原样通过**。
- `raw_input_bridge.py` 明确是 additive（`"It is additive: it does not suppress the remote's original key or mouse event."`）。
- `physical_hotkey_monitor.py` 明确不抑制（V60 用，小米不 import）。
- 全仓 `Scancode` / `RegisterHotKey` / `UnregisterHotKey` **零命中**（与 A 不同，B 不用注册表映射）。

### 2.3 长按重复触发（三家唯一有实现的）

`atvv_live_bridge.py` 里对 **back** 与 **volume_up/down** 实现了按住重复：

```python
self.back_repeat_delay = max(0.20, float(back_repeat_delay))      # 默认 0.28
self.back_repeat_interval = max(0.04, float(back_repeat_interval)) # 默认 0.04
self.volume_repeat_delay = max(0.20, float(volume_repeat_delay))   # 默认 0.40
self.volume_repeat_interval = max(0.04, float(volume_repeat_interval)) # 默认 0.12
```

worker 线程循环，判定条件是"该 usage 仍在 `direct_active_usages` 里"，抬起时调 `_cancel_back_repeat()` / `_cancel_volume_repeat()`。

> 参数可参考：重复前等待 280ms、间隔 40ms（back）；等待 400ms、间隔 120ms（音量）。

### 2.4 语音实现

- 主机 `GET_CAPS_V10` → 设备控制 opcode `0x08`(START_SEARCH) → 主机 `MIC_OPEN = 0C 00` → 设备 `0x04`(AUDIO_START) 开流 → 设备 `0x00`(AUDIO_STOP) 停流 → 主机 `MIC_CLOSE = 0D <sessionId>`（`finally` 兜底）。
- **无 `MIC_EXTEND` / `0x0E`**（全仓 grep 零命中）；设置页文案称"单次录音最长约 60 秒"，靠重新按键开新会话，不做主机续期。
- **解码器必须每次会话 reset**（重要实现细节）：

  ```python
  # RC003 restarts its encoder at predictor/index 0 for each
  # physical HTT session but sends no AUDIO_SYNC packet.
  # Without this empirical reset, the second button press
  # inherits the first session's state and saturates at DC.
  decoder.reset(0, 0)
  ```

- 竞态处理：停流后 0.12s 排空再 `end_session()`；`last_mic_off_at` 后 0.3s 内丢弃迟到音频包防误重开。
- 音频后处理 `postprocess()`：邻域插值去咔哒 + 增益（默认 `gain_db=10.0`），16kHz 上采样到 48kHz。
- 落地：`UdpPcmOutput` → UDP → `audio/audio_router.py` 用 `sounddevice` 写 `CABLE Input (VB-Audio Virtual Cable)`（48000Hz/int16）。
- VB-CABLE 自动安装：`delivery/standalone/setup/configure-xiaomi-audio.ps1`（校验 zip SHA-256 与 `.cat` 签名者 "BUREL VINCENT"、SetupAPI 装 root 设备 `VBAudioVACWDM`、`IPolicyConfig` 设默认录音端点）。

### 2.5 配置与按键映射（`xiaomi_config.py`）

- 配置：`%APPDATA%\RemoteBridgeHub\xiaomi.json` 与 `xiaomi_keys.json`。
- `DEFAULT_VOICE_HOTKEY = ("rightalt",)`。
- 13 键：`power, mic, up, left, ok, right, down, back, volume_up, home, volume_down, menu, tv`。
- 默认绑定（节选）：`ok→enter`、`back→backspace(hold_ms 20)`、`home→leftwin+d`、`menu→shift+f10`、`tv→alt+esc`、`power→esc`、`mic→rightalt`。
- 注入 API：语音快捷键用 `keybd_event`（`KEYEVENTF_EXTENDEDKEY`），映射动作与文本用 `SendInput`。
- 别名表把 `back` 同时接受 `VK_A6`（浏览器后退）与 `VK_08`（Backspace）两种固件行为；`mic` 别名为空。

### 2.6 关键文件

```
source/bridges/xiaomi/atvv_live_bridge.py   ★ ATVV 实机桥（协议+按键+抑制+重复+语音）
source/bridges/xiaomi/atvv_record.py        协议常量
source/bridges/xiaomi/hid_tap_runtime.py    Frida Gadget JS（只读旁路）
source/bridges/xiaomi/hid_tap_injector.py   提权注入器
source/bridges/xiaomi/hid_report_tap.py     9 字节解码 + FORWARDED_USAGES
source/bridges/xiaomi/xiaomi_config.py      配置/VK 表/默认绑定
source/bridges/raw_input_bridge.py          Raw Input（additive，不抑制）
source/bridges/audio/audio_router.py        VB-CABLE 路由
source/standalone/xiaomi_main.py            产品入口
delivery/standalone/setup/configure-xiaomi-audio.ps1  VB-CABLE 自动安装
```

---

## 3. 项目 C：pub-ai-inputs / 小米遥控器（macOS，重点参考）

> **这是第一期最直接的参考对象**：同一平台（macOS）、同一设备、且原生按键抑制与虚拟麦克风都有完整可逐行对照的实现。

### 3.1 工程与连接

- Swift 6.2，`Package.swift` 平台 `.macOS(.v26)`，SwiftPM 可执行目标 `XiaomiRemote2Pro`，链接 AppKit/CoreAudio/CoreBluetooth/IOKit。需 Xcode 26 CLI。
- 支持 `RC001` / `RC003`，最多同时连两只（`Models.swift`：`vendorID 0x2717`、`productID 0x32B8`）。
- **CoreBluetooth**（`BluetoothRemote.swift`）：`CBCentralManager` + `retrieveConnectedPeripherals(withServices:)` 附着**已在系统设置里配对**的设备（不做自己的配对流程，绕开 bonding/密钥协商）。
- 读 `180A` Device Information（`2A24/2A26/2A27/2A29`）做设备校验。

### 3.2 原生按键抑制（`Sources/XiaomiRemote2Pro/HIDMapping.swift`，约 780 行）

**这是"把原生 HID 代理下来"在 macOS 上的标准答案。**

- 挂载：`IOHIDManagerCreate(kCFAllocatorDefault, kIOHIDOptionsTypeNone)` —— **用 `None`，不用 `kIOHIDOptionsTypeSeizeDevice`**（seize 需 root，项目刻意避开）。
- 匹配条件：`kIOHIDVendorIDKey=0x2717`、`kIOHIDProductIDKey=0x32B8`、`kIOHIDPrimaryUsagePageKey=0x01`、`kIOHIDPrimaryUsageKey=0x06`。
- 拦截：`CGEvent.tapCreate(tap: .cghidEventTap, place: .headInsertEventTap, options: .defaultTap, eventsOfInterest: keyDown|keyUp|systemDefined(14), ...)`；回调唯一职责：

  ```swift
  return owner.shouldSuppress(type: type, event: event)
      ? nil                                  // 丢弃 → 系统应用收不到
      : Unmanaged.passUnretained(event)
  ```

- 判定顺序（`shouldSuppress`）：
  1. tap 被系统禁用（`.tapDisabledByTimeout` / `.tapDisabledByUserInput`）→ 重新 enable 并放行；
  2. `event.getIntegerValueField(.eventSourceUserData) == synthesizedMarker` → 放行（**这是放行自己合成的按键的关键**）；
  3. 取 keycode（`keyboardEventKeycode`）或系统定义事件 `data1 >> 16` 的 keyType；
  4. 查"抑制窗口"表：`SuppressionWindow { isHeld, releaseDeadline }`，命中即吞。
- **窗口由真实 HID 报告武装**：`IOHIDDeviceRegisterInputReportCallback` → 解析出按下/抬起 usage → 写窗口。抬起后不立刻撤窗，保留 `releaseGrace = 0.25s`（电源键 `powerReleaseGrace = 2.0s`）防迟到事件。时间基准 `ProcessInfo.processInfo.systemUptime`。
- **keycode 白名单**（`RemoteButton.sourceKeyCode`）：`ok 0x24`、`tv 0x32`、`voice 0x60`、`home 0x73`、`right 0x7C`、`left 0x7B`、`down 0x7D`、`up 0x7E`、`menu 0x6E`、`power 0x7F`；**`back` / `volumeUp` / `volumeDown` 返回 nil**（macOS 侧本就不产生标准键盘事件，无需抑制，源码事实）。
- **systemDefined keyType**：`volumeUp 0`、`volumeDown 1`、`power 6`。
- `synthesizedMarker = 0x584D3250524F4B45`（"XM2PROKE"）。
- 合成按键：`CGEventSource(stateID: .hidSystemState)` + `CGEvent(keyboardEventSource:virtualKey:keyDown:)`，写 `eventSourceUserData = synthesizedMarker`，`event.post(tap: .cghidEventTap)`；右 Control 走 `.flagsChanged`，flags `0x0004_2000`。
- **抑制粒度跟映射走**：`HIDMappingPlan.shouldSuppressOriginal(for:) = action != .passThrough`；未配置映射的键（passThrough）原样放行。
- 权限判定（`permissionsGranted`）：

  ```swift
  IOHIDCheckAccess(kIOHIDRequestTypeListenEvent) == kIOHIDAccessTypeGranted   // 输入监控
      && CGPreflightListenEventAccess()                                       // 输入监控
      && CGPreflightPostEventAccess()                                         // 辅助功能（合成按键）
  ```

  抛错枚举：`.inputMonitoringRequired`（输入监控）/ `.accessibilityRequired`（辅助功能）/ `.eventTapUnavailable`（tap 创建失败）。
- 长按无 auto-repeat（源码无重复定时器）；靠"保持 down + 延迟释放 + failsafe（语音 300s / 普通 2s）"。
- 另有旧版映射清理（`IOHIDEventSystemClient` + `kIOHIDUserKeyUsageMapKey`），针对历史装过 `AppleRemoteCodex` 一类驱动的机器，退出时恢复。

> **诚实的代价**：判据是「keycode + 时间窗」，**不是设备身份**。遥控器按 OK 后约 250ms 内，真实键盘敲的 Enter 会被一并吞掉。要彻底消除只能上 DriverKit HIDDriverKit（需 Apple 批准的 entitlement、用户装驱动、可能涉及 SIP）。

### 3.3 语音会话触发（`BluetoothRemote.voiceButtonChanged`）

- **就是监听遥控器语音键的按下/抬起**（voice usage `0x3E` → `HIDMappingController.onButtonChange` → `AppModel` → `BluetoothRemote`）：

  ```swift
  if isPressed {
      microphoneOpenRequested = true
      peripheral.writeValue(ATVV.microphoneOpenPlayback, for: commandCharacteristic, ...)  // [0x0C, 0x00]
  } else {
      let streamID = audioSession.streamID ?? (microphoneOpenRequested ? 0 : nil)
      if let streamID { peripheral.writeValue(ATVV.microphoneClose(streamID: streamID), ...) } // [0x0D, id]
  }
  ```

- **MIC_EXTEND 每 6 秒**（比 A 的 8s 更保守），`scheduleMicrophoneExtend` 自排重：

  ```swift
  DispatchQueue.main.asyncAfter(deadline: .now() + 6, execute: workItem)   // 发 [0x0E, streamID]
  ```

- 断流容忍（`ATVVContinuousCapturePolicy`）：stopReason `0x02`/`0x08` 且用户仍按着键 → 150ms 后重发 `0x0C,0x00` 恢复；连续零帧重试上限 1 次。
- 语音键抬起时**延迟释放**右 Control（`shouldDeferRelease`），等音频排空（`VoiceDrainTracker`：20ms 尾 + 170ms 上限）后才 `setVoiceSessionActive(false)`。
- 源码里**没有 60 秒常量**；靠 6s 无条件续期规避设备侧窗口。

### 3.4 虚拟麦克风（自研 CoreAudio HAL 插件）

- 驱动：`Drivers/XiaomiRemote2ProProbeHAL/XiaomiRemote2ProProbeHAL.c`，实现 `AudioServerPlugInDriverInterface`。
- 构建参数（`scripts/build-probe-hal.sh`）：`-DXPRM_DEVICE_NAME="MiMic Probe 2ch"`、`-DXPRM_CHANNEL_COUNT=2`、`-DXPRM_TRANSPORT_TYPE=kAudioDeviceTransportTypeUSB`、`-DXPRM_BRIDGE_PORT=49735`；clang `-bundle -std=c11`，arm64+x86_64 合并，min macOS 13.0，**默认 ad-hoc 签名（identity `-`）**。
- IPC：应用侧 `AudioOutput.swift` 重采样到 48kHz、每包 960 样本，经 **TCP（端口 49735）** 发给 HAL 驱动。
- 安装（`scripts/install-probe-hal.sh`）：`sudo ditto` 到 `/Library/Audio/Plug-Ins/HAL/XiaomiRemote2ProProbeHAL.driver`，`chown -R root:wheel`，`chmod -R go-w`，验签；提示可能需重启。**不需要关闭 SIP**（HAL 插件是用户态）。
- **该项目不用 BlackHole**（BlackHole 出现在同仓的 Apple Watch 子项目）。

### 3.5 按键 usage 表（`Models.swift`）与默认映射

| 遥控器键 | HID usage (page 0x07) | 默认映射 |
|---|---|---|
| power | 0x66 | .disabled（抑制但不合成） |
| voice | 0x3E | .rightControl（保持按住，供听写） |
| up | 0x52 | passThrough |
| left | 0x50 | passThrough |
| ok | 0x28 | passThrough |
| right | 0x4F | passThrough |
| down | 0x51 | passThrough |
| back | 0xF1 | deleteBackward |
| home | 0x4A | escape |
| menu | 0x65 | returnKey |
| tv | 0x35 | .disabled |
| volumeUp | 0x80 | passThrough |
| volumeDown | 0x81 | passThrough |

导出键盘虚拟键码：rightControl `0x3E`、return `0x24`、delete `0x33`、escape `0x35`、方向 `0x7E/0x7D/0x7B/0x7C`。

### 3.6 关键文件与权限声明

```
Package.swift
Sources/XiaomiRemote2Pro/ATVV.swift          协议 + ADPCM + 会话状态机
Sources/XiaomiRemote2Pro/AudioOutput.swift   HAL 桥 + 重采样 + TCP
Sources/XiaomiRemote2Pro/BluetoothRemote.swift  CoreBluetooth 连接/重连/语音触发
Sources/XiaomiRemote2Pro/HIDMapping.swift    按键解析 + CGEventTap 抑制 ★
Sources/XiaomiRemote2Pro/Models.swift        usage 表 + 映射计划
Sources/XiaomiRemote2Pro/AppModel.swift      编排（语音会话 ↔ HID 抑制同步）
Drivers/XiaomiRemote2ProProbeHAL/…ProbeHAL.c 虚拟麦克风驱动
scripts/{build-app,build-probe-hal,install-probe-hal}.sh
Config/Info.plist                            NSBluetoothAlwaysUsageDescription
                                             NSInputMonitoringUsageDescription
```

README 要求：macOS 26+、Xcode 26 CLI、遥控器已在系统蓝牙设置中配对、**输入监控 + 辅助功能权限**、驱动安装需管理员密码（不覆盖同名驱动，可能需重启）。父仓库声明项目为实验性质，遥控器音质与延迟是主要限制。
