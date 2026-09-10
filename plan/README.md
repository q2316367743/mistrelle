# plan/ —— 预研与方案储备

> 本目录存放**尚未实施**的功能预研、技术调研与落地方案，目的是让后续接手时**跳过调研阶段**直接进入实现。
>
> 与 `docs/` 的分工：`docs/` 记录**已落地**功能的技术实现；`plan/` 记录**待实施**方案的调研结论与设计取舍。
> 功能落地后，应把最终实现整理进 `docs/<模块>/`，本目录对应条目标记「已实施」或删除。

## 索引

| 文档 | 描述 |
|------|------|
| [xiaomi-remote/01-reference-projects.md](./xiaomi-remote/01-reference-projects.md) | 三个开源参考项目逐仓精读：MiVibe-Remote（Win/C#）、remote-bridge-hub（Win/Python）、pub-ai-inputs 小米遥控器（macOS/Swift）—— 技术栈、BLE 连接、按键处理、语音实现、目录结构、已知限制 |
| [xiaomi-remote/02-atvv-protocol.md](./xiaomi-remote/02-atvv-protocol.md) | ATVV（Android TV Voice over BLE）协议全量事实：UUID、opcode 序列、caps 版本差异、ADPCM 帧格式与后处理、虚拟声卡方案（macOS CoreAudio HAL / Windows VB-CABLE） |
| [xiaomi-remote/03-native-key-suppression.md](./xiaomi-remote/03-native-key-suppression.md) | 「按遥控器时不让系统产生原生键盘事件」三平台做法对比与可行性定论：macOS CGEventTap 路线（推荐）、Windows 钩子关联抑制、驱动级方案成本 |
| [xiaomi-remote/04-mistrelle-integration.md](./xiaomi-remote/04-mistrelle-integration.md) | 本项目接入方案：`hold` 动作（按住语义）、动作体系下沉、域/契约/页面结构、Swift sidecar、分阶段交付、风险清单 |

**当前状态：调研完成，方案已评审，暂缓实施（2026-09-10 决定）。**
