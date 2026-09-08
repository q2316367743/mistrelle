# 07 小键盘（keypad）：串口按键 + 系统级模拟按键

> 伙伴窗口硬件页面（菜单「小键盘」）：6 键小键盘设备（支持任意键数）经串口（**9600 波特率**）
> 上报按键消息，main 解析行协议后可按绑定**驱动系统级模拟按键**（跨平台组合键，
> 其他应用与系统快捷键均可响应）。页面结构与红绿灯一致：上方串口连接控制、下方按键绑定卡片。

## 行协议（设备 → main）

- 9600 波特率，ASCII 文本 `<键位>,<动作>`，如 `1,on`、`2,off`
- **设备不带任何行尾/分隔符**（实测 `1,on` 后无换行无回车），不能按行分帧；
  main 用文法流式解析（`数字 + , + on/off` 逐段匹配，见 keypadProtocol）
- `on`=按下、`off`=释放（按住期间保持按下语义，支持 push-to-talk 类用法）
- 键位 id 支持任意数量；页面当前展示 1–6，超出页面的键位仍会点亮/模拟

## 实现思路

- **串口原始数据读取（SerialService 通用化）**：`SerialService` 原本只写不读，本次新增
  `subscribePortData(path, cb)`：openPort 时挂 `data` 监听，utf8 文本块**原样**分发给订阅方
  （模块不做分帧假设）；端口关闭（主动/意外）清理该端口监听，重连需重新订阅。
  红绿灯/圆屏只写不读，零影响。协议解析在小键盘侧 `keypadProtocol.ts`：
  无分隔符文法流式匹配，跨 chunk 残段缓冲衔接，兼容 \r\n/空白分隔与大小写，失步丢字符重同步。
- **域化链路（照红绿灯四层结构）**：`@common` 契约 → main 域（Service 单例/Config/Ipc）→
  preload 桥（仅伙伴窗口注入）→ buddy 页面。连接编排/lastPort 记忆/意外断开处理全在 main，
  渲染层纯展示 + 绑定编辑。
- **系统级模拟按键（keySimulator.ts）**：koffi 预编译 FFI 直调平台 API，无本地编译链。
  - macOS：CoreGraphics `CGEventCreateKeyboardEvent` + `CGEventSetFlags` + `CGEventPost(kCGHIDEventTap)`，
    修饰键发独立按下/抬起事件、主键事件额外携带修饰 flag；需系统「辅助功能」授权
    （ApplicationServices `AXIsProcessTrusted` 检测，未授权时页面顶部 t-alert 引导）。
  - Windows：user32 `keybd_event` 逐键 down/up（`KEYEVENTF_KEYUP=2`），无需授权。
  - **引用计数**：同一组合被多个键位绑定时，全部释放才真正抬起（`heldCombos` Map）。
  - **防修饰键卡死**：主动断开、意外拔线、保存绑定、应用退出（`will-quit`）一律 `releaseAll()`。
- **启动即初始化**：`initKeypad()` 随 registerIpc 在 app ready 执行：加载配置 → 订阅
  `onPortClosed` → lastPort 存在于串口列表才 `openPort`（9600 默认波特率）自动连接并重挂行订阅；
  没有串口就不监听（与红绿灯一致）。
- **按下状态**：main 维护 `pressed` 集合（含未绑定键位），变化即 `keypad:state` 广播全部窗口；
  连接/断开时清空（设备状态未知）。

## 配置结构（事实源 `@common/types/keypad.ts`）

`~/.mistrelle/buddy/keypad.json`：

```jsonc
{
  "lastPort": "/dev/tty.usbmodemXXX",
  "bindings": {
    "1": { "modifiers": ["shift"], "key": "f13" },
    "2": { "modifiers": ["ctrl", "alt"], "key": "a" }
  }
}
```

- `bindings` 键 = 设备行协议键位 id（字符串），缺省 = 不模拟仅状态点亮
- 主键白名单 `KEYPAD_KEY_CODES` 元组（F1–F19 + 字母 + 数字），从元组派生类型/选项/校验；
  修饰键 `ctrl | alt | shift | meta`（meta = macOS Cmd / Windows Win）
- 归一化：主键/修饰键白名单清洗、修饰键去重，非法条目丢弃

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/common/types/keypad.ts` | 类型契约：`KeypadModifier/KeypadKeyName/KeypadBinding/KeypadConfig/KeypadState/KeypadApi` + 白名单守卫 |
| `src/common/buddy/keypad/keypadChannels.ts` | IPC 通道常量（getConfig/saveBindings/connect/disconnect/getState/state） |
| `src/main/src/buddy/keypad/keySimulator.ts` | koffi 模拟按键：平台键码表、pressCombo/releaseCombo/releaseAll、AXIsProcessTrusted |
| `src/main/src/buddy/keypad/keypadConfig.ts` | keypad.json 读写与归一化 |
| `src/main/src/buddy/keypad/keypadService.ts` | 单例服务：init/connect/disconnect/行解析/saveBindings/broadcastState |
| `src/main/src/buddy/keypad/keypadIpc.ts` | IPC handler 注册（无指令发送通道，设备单向输入） |
| `src/main/src/buddy/keypad/keypadProtocol.ts` | 无分隔符流式解析器：`数字,on/off` 文法匹配 + 不完整前缀等待 + 失步丢字符重同步 |
| `src/main/src/modules/serial/SerialService.ts` | 新增 `subscribePortData` 原始数据订阅（通用能力，非 keypad 专属） |
| `src/preload/src/modules/keypad/keypad.ts` | 渲染层桥（buddy.ts 注入 `keypad`） |
| `src/renderer/src/windows/buddy/pages/hardware/keypad/` | 页面：`Keypad.vue` + `useKeypad.ts` + SerialPanel/KeypadKeys/KeypadKeyCard/KeypadPlaceholder |

## 页面交互

- 顶部串口面板（照红绿灯精简：下拉 + 刷新 + 连接/断开 + 状态 tag，无调试模式）
- 已连接显示 6 张键位卡片：键号徽标 + 按下点亮（success 描边）+ **录制快捷键**绑定——
  点「录制快捷键」后页面级捕获下一个 keydown（`event.code` 映射主键 + 修饰键 flags），
  连组合键直接按出来即可，Esc/失焦取消，捕获即存回读对齐；「清除」解绑
- macOS 未授权时顶部 `t-alert` 引导授权（Windows 恒不显示）
- 未连接显示占位（连接后可配置绑定）

## 注意事项

- **koffi 为原生依赖**（dependencies，externalizeDeps 外部化），与 better-sqlite3 同由
  electron-builder smartUnpack 处理 .node 产物，无需额外 asarUnpack 配置
- macOS 虚拟键码为 ANSI 布局位置码（`kVK_ANSI_*`），非字符值；新增主键需同时补
  `MAC_KEY_CODES`（Windows 侧为公式计算无需补表）与 `KEYPAD_KEY_CODES` 元组
- 模拟按键针对「快捷键触发」场景；捕获原始输入的游戏（Raw Input）不响应注入事件
- 流式解析宽容：动作大小写宽容、容忍 \r\n/空白分隔；失步（乱码）丢字符重同步；
  `on` 重复上报去重不重复触发
- 按键无反应的排查顺序：确认应用已连接且串口选对（macOS 会同时列出 `tty.*`/`cu.*` 变体）→
  端口未被其他串口工具占用（多读端抢数据，且打开即复位设备）→ 临时在 keypadService
  订阅回调 `console.info` 原始数据核对文法（正式代码无收包日志，避免刷屏）
- 录制快捷键是**页面级** keydown 监听：系统/菜单保留组合（如 macOS Cmd+Q/Cmd+W）
  被先行消费录不到，属预期；跨窗口保存绑定前必须 JSON 深拷贝
  （config 是深层 reactive Proxy，浅展开嵌套对象跨 contextBridge 克隆报错，useQuota 同款坑）
