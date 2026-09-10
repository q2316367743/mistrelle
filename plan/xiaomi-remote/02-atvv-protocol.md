# ATVV 语音协议与音频链路 —— 事实汇总

> 2026-09-10 整理。来源：三个参考项目源码 + 上游反向工程报告（`b0o/ATVVoice`，Rust/Linux/PipeWire，`docs/research/report.md`）交叉验证。
> 三家实现互相印证，协议事实一致。

## 0. 先说清一个命名问题

用户口中的「小米是 VT」「小米是 ATVV」，在**三个仓库与检索到的全部公开资料里都只有 ATVV 这一个术语**，没有任何项目或文档把小米遥控器语音称为 "VT" 模式。

- 疑似来源：项目 A 记录了小米厂商私有 GATT 服务 `8A7A0001-…`（特征 `0102/0103/0112`，Notify，推测承载返回/音量键）——这与语音无关，且**完整 128-bit UUID 在文档中被 `...` 截断，未获取到**。
- 结论：**按 ATVV 实现**，同时兼容 v0.4 / v1.0 两套 caps 布局（项目 B、C 都这么做）。所谓"两种模式"实际是 **ATVV 协议版本差异 + 固件差异**，不是两个协议。

## 1. GATT 结构

| 角色 | UUID | 属性 |
|---|---|---|
| Service | `AB5E0001-5A21-4F05-BC7D-AF01F617B664` | Google ATV Voice Service（ATVV） |
| TX（主机→遥控器） | `AB5E0002-5A21-4F05-BC7D-AF01F617B664` | Write（实际多走 Write Without Response） |
| Audio（遥控器→主机） | `AB5E0003-5A21-4F05-BC7D-AF01F617B664` | Notify，音频数据 |
| CTL（遥控器→主机） | `AB5E0004-5A21-4F05-BC7D-AF01F617B664` | Notify，控制信号 |

- 多字节字段一律**大端**（上游报告作者曾因小端发 `MIC_OPEN` 被 `0x0C 0x0F 0x01` 拒绝）。
- 同一台设备上还有：标准 HID `0x1812`（被系统驱动占用，Windows 侧常 `AccessDenied`）、Device Information `180A`（用于设备校验）、厂商私有服务 `8A7A0001-…`。

## 2. 命令（主机 → 遥控器，写 TX 特征）

| 命令 | 字节 | 说明 |
|---|---|---|
| `GET_CAPS` | `0A 01 00 00 03 00`（A）/ `0A 01 00 00 03 03`（B）/ `0A 01 00 00 03 01`（C） | 取能力。**末两字节各项目不一致 → 实现要容错，不能硬编码** |
| `MIC_OPEN`（playback 模式） | `0C 00` | v1.0 形态；v0.4 为 `0C 00 <codec>` |
| `MIC_CLOSE` | `0D <streamId>` | v1.0；v0.4 为 `0D` |
| `MIC_EXTEND` | `0E <streamId>` | 长按续期（A/C 用；B 无） |

## 3. 控制 opcode（遥控器 → 主机，CTL 特征 Notify）

| opcode | 名称 | 载荷 | 备注 |
|---|---|---|---|
| `0x0B` | CAPS_RESP | 版本(2B 大端) + codec mask(1B) + frameSize(2B) + ... | major version 必须 == 1 才继续发 MIC_OPEN |
| `0x04` | AUDIO_START | reason(1B) + codec(1B) + streamId(1B) | **reason 0x03 = Hold-to-Talk（物理按住）** |
| `0x00` | AUDIO_STOP | reason(1B) | reason 0x02 = 松开/停止；0x08 = 搜索结束 |
| `0x0A` | AUDIO_SYNC | codec + seq(2B 大端) + predictor(int16 大端) + stepIndex(≤88) | 用于重置解码器状态（v1.0 有） |
| `0x08` | START_SEARCH | — | 遥控器按键触发，主机据此回 `MIC_OPEN` |
| `0x0C` | MIC_OPEN 错误 | 错误码(2B 大端) | 仅出现在返回方向 |

### 3.1 会话时序（两家的差异要说清）

**A / C 的做法（主机主导）**：
```
主机 GET_CAPS(0x0A) ──►
             ◄── CAPS(0x0B)  校验 major==1
用户按住语音键 ──► 设备 0x08 START_SEARCH ──► 主机 MIC_OPEN(0x0C 0x00)
             ◄── AUDIO_START(0x04, reason 0x03)   开流
             ◄── 音频帧（Audio 特征持续 Notify）
             ──► MIC_EXTEND(0x0E id) 每 6~8 秒续期（长按期间）
用户松开 ──► 设备 AUDIO_STOP(0x00, reason 0x02)
             ──► MIC_CLOSE(0x0D id)
```

**B 的做法（设备主导，无续期）**：
```
GET_CAPS ──►  ◄── CAPS
设备 0x08 ──► 主机 MIC_OPEN(0x0C 00)
设备 0x04 ──► 开流（decoder.reset(0,0)，且清空缓冲区）
设备 0x00 ──► 停流（0.12s 排空后 end_session；0.3s 内丢弃迟到包）
finally: MIC_CLOSE(0x0D sessionId)
```
B **完全没有 `0x0E` 续期**，靠"设备侧单次最长约 60 秒，到点重新按键"。

> **实现建议**：采用 A/C 的续期路线（更稳），续期间隔取 **6 秒**（C 的取值，比 A 的 8s 更保守），并按 B 的经验**每次会话重置解码器**。

## 4. 音频编码

- 编码：**IMA/DVI ADPCM**（标准 89 项 step table，**高 nibble 优先**）。
- 采样率由 codec 字段决定：`0x01 → 8000 Hz`、`0x02 → 16000 Hz`。
- 帧长：**v1.0 = 120 字节**（可不带头部）、**v0.4 = 134 字节**。
- v0.4 帧布局（上游报告经 Infineon CYW20829 参考固件确认真实布局）：

  ```
  SeqID(大端 2B) + 0x00(1B) + Predictor(大端 int16, 2B) + StepIndex(1B) + 128B ADPCM
  ```

  即头部 6 字节（3B app + 3B DVI），每帧独立可解（pred/idx 从头部重置）。
- v1.0：帧长 120B 且可不带头部，**解码器状态由 `AUDIO_SYNC(0x0A)` 初始化**（predictor + step index）。
- 小米 2 Pro 固件 2671 实测：**ATVV v1.0 + ADPCM 16kHz + 120B 帧 + Hold-to-Talk**。
- 固件差异：**RC003 每次物理语音会话都把编码器重置到 predictor/index 0，且不发 AUDIO_SYNC 包** → 主机必须自己 `reset(0,0)`，否则第二次按键会继承上次状态直接饱和到直流（项目 B 的实证）。

### 4.1 后处理（三家做法一致，建议照抄）

1. 单样本尖峰插值去咔哒（clicks）；
2. 3-tap 低通 `[0.25, 0.5, 0.25]`；
3. RMS 归一化：目标 RMS ≈ 10000，用 95 分位防削波；
4. 增益：B 默认 `gain_db = 10.0`；
5. 重采样：16kHz → 48kHz。

## 5. 虚拟声卡

### 5.1 macOS

| 方案 | 做法 | 权限 |
|---|---|---|
| **BlackHole（推荐第一期）** | 装 `/Library/Audio/Plug-Ins/HAL/BlackHole2ch.driver`，应用把 PCM 写到该输出设备；用户在系统里把 BlackHole 当麦克风 | 安装器已签名+公证；`brew install blackhole-2ch` 或官网 |
| 自研 HAL 插件（项目 C） | 自己实现 `AudioServerPlugInDriverInterface`，`sudo ditto` 到 `/Library/Audio/Plug-Ins/HAL/`，ad-hoc 签名即可 | sudo；**不需要关 SIP**（用户态插件）；本机自用无需公证 |
| CoreAudio HAL 通用事实 | 标准安装位置 `/Library/Audio/Plug-Ins/HAL/<Name>.driver`（root 拥有），重启 `coreaudiod` 或系统后生效；**不需要 kernel extension、不需要关 SIP** | |

- BlackHole README 明确："No kernel extensions or modifications to system security necessary"，兼容 10.10+。
- 项目 C 的 IPC 做法值得借鉴：应用侧 TCP（`49735`）把 PCM + 自定义包头发给 HAL 驱动，驱动侧暴露遥测属性（如 `kRemoteSamplesReceivedProperty`）。

### 5.2 Windows（二期预留）

- **VB-CABLE**（Donationware，驱动由 BUREL VINCENT 签名）是三家 Windows 项目的共同选择：通过 SetupAPI / `UpdateDriverForPlugAndPlayDevices` 装 root 设备 `VBAudioVACWDM`，再用 `IPolicyConfig` COM 把 `CABLE Output` 设为默认录音端点。
- 自写驱动（**不建议**）：微软官方 SysVAD 示例可提供虚拟麦克风，但目标机必须开测试签名（`bcdedit /set TESTSIGNING ON`）+ 装测试证书，可能需关 Secure Boot/BitLocker；正式分发需全部文件用受信任证书签名。三个项目都刻意避开。
- 项目 A 的做法：**不捆绑**，要求用户自行安装 VB-CABLE。
- 项目 B 的做法：安装包内置 + `configure-xiaomi-audio.ps1` 自动装（校验 zip SHA-256 与 `.cat` 签名、一次管理员确认、必要时 RunOnce 重启、卸载恢复原默认麦克风）。

## 6. 已知硬件限制

| 限制 | 证据 | 应对 |
|---|---|---|
| 单次音频传输超时（典型 15~60s） | A 实测约 60s 中断；B 设置页文案"约 60 秒"；上游报告称硬件 Audio Transfer Timeout | `MIC_EXTEND(0x0E)` 每 6s 续期；失败则静默重建会话 |
| 麦克风是硬件隐私门 | A 的 `VOICE_CAPTURE_TEST.md`：必须真正按住麦克风键才发音频 | 语音会话必须由物理按键触发，不能软件开麦 |
| 音量/返回键不进系统输入栈 | A `HARDWARE_MAP.md` 两轮采样；B 注释 `0xF1` 被 kbdhid 丢弃 | 需旁路读取（Windows）；macOS 侧本就不产生标准键盘事件 |
| 音质与延迟有限 | C 父仓库 README | 属预期，不做处理 |

## 7. 待确认项（实现时需实机验证）

1. `GET_CAPS` 请求末两字节的最优取值（A/B/C 三家各不相同），需要实机试；建议按 caps 响应探测而不是硬编码请求。
2. 小米厂商服务 `8A7A0001-…` 完整 UUID（被项目 A 文档截断）—— 与语音无关，暂不影响。
3. 是否有 RC001 等老固件的额外差异（三家只在 2 Pro `PID 0x32B8` 上实测充分）。
