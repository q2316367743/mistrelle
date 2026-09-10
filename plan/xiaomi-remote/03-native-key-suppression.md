# 原生按键抑制（「把 HID 代理下来」）—— 三平台做法与可行性定论

> 2026-09-10 调研。回答的问题：**遥控器按键时，能不能让系统不产生原生键盘事件？**

## 0. 为什么需要它

小米遥控器在系统里**同时是一个标准 BLE HID 键盘**（HID over GATT，usage page `0x07`）。用户按方向键时系统会移动光标、按 OK 会打出 Enter。若要把按键改成自定义动作（绑定"打开应用"等），就必须**拦住原生事件**，否则会出现"动作执行了 + 光标也动了"的双重效果。

## 1. 结论速览

| 平台 | 手段 | 能否做到设备级？ | 需要什么 |
|---|---|---|---|
| **macOS** | `IOHIDManager` 只读 + `CGEventTap` 返回 `nil` 丢弃 | ⚠️ keycode + 时间窗，非设备身份 | 输入监控 + 辅助功能权限（**无需 root**） |
| macOS（彻底方案） | DriverKit HIDDriverKit 驱动 | ✅ 真设备级 | Apple 批准 entitlement + 用户装驱动，成本高一个量级 |
| Windows | 低级键盘钩子返回 1 | ❌ 全局/时间窗关联 | 无（普通用户态） |
| Windows（彻底方案） | HID filter driver | ✅ 真设备级 | 内核签名 + 安装，三家都放弃了 |
| Windows（绕过） | 注册表 `Scancode Map` 改写 | ❌ 全局改写，电脑键盘同受影响 | admin + 重启 |

**推荐（第一期 macOS）：照抄项目 C 的 `IOHIDManager` + `CGEventTap` 路线。** 覆盖绝大多数场景，无需 root、无需驱动、无需关 SIP。

## 2. macOS 方案详解（项目 C 的实现，可直接复用）

### 2.1 为什么不用 `kIOHIDOptionsTypeSeizeDevice`

`IOHIDManagerOpen(..., kIOHIDOptionsTypeSeizeDevice)` 能独占设备、从根上阻止系统接收，但**需要 root 权限**。项目 C 全文件 grep 确认未使用 seize，改走 `CGEventTap` 路线。

### 2.2 两步机制

**第一步：只读挂载 HID，拿到真实按键**

```swift
IOHIDManagerCreate(kCFAllocatorDefault, IOOptionBits(kIOHIDOptionsTypeNone))
// 匹配：kIOHIDVendorIDKey = 0x2717, kIOHIDProductIDKey = 0x32B8,
//       kIOHIDPrimaryUsagePageKey = 0x01, kIOHIDPrimaryUsageKey = 0x06
IOHIDDeviceRegisterInputReportCallback(...)   // 原始报告 → 解析按下/抬起 usage
```

**第二步：CGEventTap 丢弃同 keycode 的事件**

```swift
let eventMask = (1 << CGEventType.keyDown.rawValue)
    | (1 << CGEventType.keyUp.rawValue)
    | (1 << Self.systemDefinedEventType.rawValue)      // rawValue = 14
CGEvent.tapCreate(
    tap: .cghidEventTap,           // HID 层之后
    place: .headInsertEventTap,    // 插到最前
    options: .defaultTap,          // 可修改/可丢弃（对比 .listenOnly 只能旁听）
    eventsOfInterest: eventMask,
    callback: ...,
    userInfo: ...)
```

回调唯一职责：

```swift
return owner.shouldSuppress(type: type, event: event) ? nil : Unmanaged.passUnretained(event)
```

### 2.3 判据：keycode + 抑制窗口（不是设备身份）

`shouldSuppress` 顺序：

1. tap 被系统禁用（`.tapDisabledByTimeout` / `.tapDisabledByUserInput`）→ 重新 enable 并**放行**；
2. `event.getIntegerValueField(.eventSourceUserData) == synthesizedMarker` → **放行**（放行自己合成的按键）；
3. 取 keycode（`keyboardEventKeycode`）或 systemDefined 的 keyType（`data1 >> 16`）；
4. 查窗口表：`SuppressionWindow { isHeld: Bool, releaseDeadline: TimeInterval }`，命中即吞。

**窗口由真实 HID 报告武装**：IOHID 报告解析出按下 → 写 `isHeld = true`；抬起 → 清 `isHeld` 但保留 `releaseGrace`（`0.25s`，电源键 `2.0s`）内的迟到事件。时间基准 `ProcessInfo.processInfo.systemUptime`。

**keycode 白名单**（项目 C 实测值）：

| 键 | sourceKeyCode | systemDefined keyType |
|---|---|---|
| ok | 0x24 (Return) | — |
| tv | 0x32 | — |
| voice | 0x60 (物理 F5) | — |
| home | 0x73 | — |
| left / right / down / up | 0x7B / 0x7C / 0x7D / 0x7E | — |
| menu | 0x6E | — |
| power | 0x7F | 6 |
| volumeUp / volumeDown | — | 0 / 1 |
| **back (0xF1) / volumeUp / volumeDown** | **无 keycode**（macOS 侧本就不产生标准键盘事件，无需抑制） | |

**合成标记**：`synthesizedMarker = 0x584D3250524F4B45`，写 `event.setIntegerValueField(.eventSourceUserData, value: marker)`，`event.post(tap: .cghidEventTap)`。

**抑制粒度**：跟映射走 —— `shouldSuppressOriginal(for:) = action != .passThrough`。未配置映射的键（passThrough）原样放行，避免"我不想改音量键，结果音量键被吞了"。

### 2.4 权限（TCC）

```swift
IOHIDCheckAccess(kIOHIDRequestTypeListenEvent) == kIOHIDAccessTypeGranted  // 输入监控
    && CGPreflightListenEventAccess()     // 输入监控（CGEventTap 监听）
    && CGPreflightPostEventAccess()       // 辅助功能（合成按键）
```

- 读 HID 报告 → **输入监控**（Input Monitoring）
- CGEventTap 丢弃/合成 → **辅助功能**（Accessibility）
- 申请入口：`IOHIDRequestAccess(kIOHIDRequestTypeListenEvent)` + `CGRequestListenEventAccess()` + `CGRequestPostEventAccess()`
- `Info.plist` 需 `NSInputMonitoringUsageDescription`（+ `NSBluetoothAlwaysUsageDescription`）
- 错误枚举：`.inputMonitoringRequired` / `.accessibilityRequired` / `.eventTapUnavailable`（tap 创建失败，通常是权限未生效或进程重启后 TCC 未刷新）

### 2.5 代价与边界（必须写进文档，不能隐瞒）

1. **误伤**：判据是 keycode + 时间窗，**不是设备身份**。遥控器按 OK 后约 250ms 内，真实键盘敲的 Enter 会被一并吞掉。同理真 F5、真方向键。
2. **彻底消除误伤的唯一路径**：DriverKit HIDDriverKit（真设备级），但需 Apple 批准的 entitlement、用户装驱动、可能涉及 SIP。
3. **ad-hoc 签名副作用**（推测，源码未写）：项目 C 默认 ad-hoc 签名（`codesign --`），每次重新构建后 TCC 授权可能失效，表现为"抑制突然不工作"。我们这边也要注意构建产物身份稳定。
4. 语音键的右 Control 保持：项目 C 抬起后**不立即释放**，等音频排空（20ms 尾 + 170ms 上限）才放开，并有 300s failsafe 兜底。

## 3. Windows 做法对比（二期参考）

### 3.1 项目 A：全局改写 + 全局钩子（❌ 设备级）

- 注册表 `Scancode Map`：F5 → F13、电源 `E0 5E` → Numpad Divide。**全局，电脑自己的 F5 也变**。
- 低级键盘钩子按 `VK_F5` / `VK_APPS` / `VK_HOME` 返回 1 吞掉。**不区分设备**。
- 自述 README：*"Enhanced keys do not install global suppression for native Back/Volume keyboard events."*
- `DECISIONS.md` D-025：*"真正无损的设备级变换需要 HID 过滤驱动或等价的设备级输入组件。"*

### 3.2 项目 B：时间窗关联抑制（⚠️ 更聪明）

- 同样用 `WH_KEYBOARD_LL` 返回 1，但**必须先收到同设备的 direct HID 信号（Frida 旁路）才吞**：
  - 普通键关联窗 **15ms**；`{tv, home, menu, power}` **60ms**；F5 **80ms**。
  - 超时未关联 → 放行（普通物理键盘因此不受影响）。
- 语音 F5 额外要求与 ATVV 控制包 `0x08` / `0x04` 关联（`mark_voice_signal()`），并记住 key-down 以连 key-up 和重复一起吞。
- 这是"不做驱动的前提下最接近设备级"的做法，但仍有时间窗竞态。

### 3.3 Frida 旁路（A/B 共用，只读）

两家都用 Frida hook `ntdll!NtDeviceIoControlFile` + IOCTL `0x80018483`，读 **9 字节**缓冲（`01 00 00` 前缀 + 3 个小端 16-bit usage）。
**严格只读，无法改写或吞掉报告**——它只是把"系统输入栈拿不到的按键"（如 `0xF1` 返回键被 kbdhid 丢弃）复制出来给应用层用。
- A：`hid_tap.js`，hook + `NtClose` 流身份撤销 + 10s 租约。
- B：Frida Gadget 注入 `WUDFHost.exe`（`CreateRemoteThread` + `LoadLibraryW`，需管理员），emit 到本地 TCP `30684`。

> 结论：**Frida 旁路解决的是"读不到按键"，不是"抑制原生按键"**。两者是不同问题，不要混淆。

## 4. 对本项目的意义

| 需求 | macOS 第一期 | Windows 二期 |
|---|---|---|
| 读到全部按键（含返回/音量） | CoreBluetooth/IOKit HID 直接可读 | 需 Frida 旁路或 Raw Input（`0xF1` 例外） |
| 抑制原生按键 | `CGEventTap` 返回 nil（推荐） | 低级钩子 + 时间窗关联（参考 B） |
| 不需要 root/sudo | ✅（仅 TCC 授权） | ✅（仅一次 UAC，若装 VB-CABLE） |
| 不需要内核驱动 | ✅ | ✅（代价是抑制不完美） |
