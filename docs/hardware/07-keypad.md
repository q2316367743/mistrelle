# 07 小键盘（keypad）：串口按键 + 动作序列（模拟按键 / 打开应用 / 执行脚本 / 权限审批 / 延时等待 / 打开网页）

> 伙伴窗口硬件页面（菜单「小键盘」）：6 键小键盘设备（支持任意键数）经串口（**9600 波特率**）
> 上报按键消息，main 解析行协议后按键位绑定**顺序执行动作序列**。每键绑定一个动作数组
> （2026-09-09 晚由单动作升级为序列），动作类型注册表化，当前六种：
> **模拟按键**（系统级组合键，模拟一次完整击键）、**打开应用**（本机应用列表下拉 + 自定义
> 路径）、**执行脚本**（任意 shell 命令）、**权限审批**（待审请求允许/拒绝）、**延时等待**
> （序列间隔 50–60000ms）、**打开网页**（http/https 网址，系统默认浏览器，2026-09-10）。
> 键位可选配置**长按动作序列**（2026-09-10：短按/长按互斥判定；2026-09-11：长按行为由队列
> 形状推导——单条模拟按键=保持按住、多条=循环整个队列、单条其他=执行一次，见下）。页面结构：上方串口
> 连接控制、下方键位卡片（草稿式序列编辑）。

## 行协议（设备 → main）

- 9600 波特率，ASCII 文本 `<键位>,<动作>`，如 `1,on`、`2,off`
- **设备不带任何行尾/分隔符**（实测 `1,on` 后无换行无回车），不能按行分帧；
  main 用文法流式解析（`数字 + , + on/off` 逐段匹配，见 keypadProtocol）
- `on`=按下（触发动作，见短按/长按判定）、`off`=释放（未配置长按的键位仅状态簿记；
  配置了长按的键位参与短按分流）；`on` 重复上报去重不重复触发
- 键位 id 支持任意数量；页面当前展示 1–6，超出页面的键位仍会点亮/触发

## 动作模型（注册表驱动，2026-09-09 重构 + 序列化）

每键绑定一个**动作序列**（数组，按下按顺序执行，存盘 `KeypadAction[]`），数组元素为按
`type` 判别的动作联合。三端各有一张注册表，**新增动作 = 各端加一个文件 + 登记一行**，
分发/归一化/序列编辑器框架零改动：

| 端                                   | 注册表                    | 条目职责                                                                                                                   |
| ------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@common/keypad/actions/`            | `KEYPAD_ACTIONS`          | `KeypadActionDefinition`：type / label / normalize（配置清洗，main 落盘与渲染层保存预校验共用）/ createDefault（空白草稿） |
| `src/main/src/buddy/keypad/actions/` | `KEYPAD_ACTION_EXECUTORS` | `KeypadActionExecutor<T>`：onPress（序列执行到该动作时触发，可异步——delay 即 sleep Promise）                               |
| 渲染层 `components/actionEditors/`   | `KEYPAD_ACTION_EDITORS`   | 编辑器组件（统一契约 `props.action` 只读草稿 + `emit('change')` 回传，内部按 type 收窄）                                   |

- 三张表均用**映射类型 `{ [D in KeypadAction as D['type']]: ... }` 或编译期穷尽校验**
  强制齐活：`KeypadActionType` 联合加了成员而任一注册表漏登记，typecheck 直接报错
- `KeypadActionTypeOptions`（添加动作卡片）从 `KEYPAD_ACTIONS` 派生防失同步
- **序列执行语义**（keypadService `dispatchSequence`/`runSequence`）：
  - `on` 时顺序 `await` 各执行器 onPress（delay 以 sleep Promise 形成间隔），
    fire-and-forget，单条失败记日志继续下一条
  - **重入守卫**：每键 `running` Set，序列执行中忽略该键位的再次触发（序列含延时时
    长于物理按压，防连按并发重入）
  - combo 在序列中 = **模拟一次完整击键**（按下 → 按住 60ms（`COMBO_TAP_HOLD_MS`）→
    自动抬起），物理松开键位不再参与抬起时机（原 push-to-talk 语义随序列化移除）；
    断开/拔线/保存绑定的 `releaseAll()` 兜底不变
  - `off` 只做 pressed 集合簿记与广播（pressed 去重天然防长按重复触发）；
    **例外**：配置了长按的键位见下节

### 短按/长按互斥判定（2026-09-10）

- `KeypadBinding.holdActions?`（可选长按动作序列）配置后该键启用判定；阈值全局常量
  `KEYPAD_HOLD_MS = 600`（common 类型事实源，暂不做每键可配）
- **判定逻辑**（keypadService，`holdTimers Map<keyId, timer>`）：
  - `on`：有 `holdActions` → 启动 600ms 计时器；到时仍按住 → 执行长按序列（timer 回调
    自删，后续 `off` 回到纯簿记）；无 `holdActions` → 照旧按下立即执行短按序列
  - `off`：若计时器仍在挂起（未达阈值）→ 取消计时并执行**短按序列**；否则仅簿记
  - 两者互斥：快速点击零感知延迟（off 即触发短按），长按无需等松手
- **零回归**：未配置 `holdActions` 的键位行为与旧版完全一致（按下立即执行）
- **边界**：拔线/断开 `resetPressed` 遍历清空挂起计时器；长按序列执行中松手再按，
  `running` 重入守卫与 `pressed` 去重照常兜底
- 配置归一化：`normalizeBinding` 对 `holdActions` 复用 `normalizeActions` 逐条清洗，
  空/全非法不落盘（无该字段 = 旧版行为）
- UI：绑定面板分「短按 · 点击触发」「长按 · 按住 600ms 触发」两区块，各复用
  `KeypadSequenceEditor`（新增可选 `emptyText` prop 定制空态文案）；保存时空序列不写
  `holdActions`；键帽摘要只展示短按序列（长按不上键帽）

### 长按行为：由队列形状推导（2026-09-11）

长按期间「做什么」不做配置，直接由**长按队列的形状**推导——判定收口在
`@common/types/keypad` 的 `resolveKeypadHoldBehavior(holdActions)`，main 执行侧与渲染层
展示共用同一函数，避免两端规则漂移：

| 长按队列形状                 | 行为              | 语义                                                                                                                    |
| ---------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 单条普通「模拟按键」         | `keep` 保持按住   | 按住达到阈值后 `pressCombo` **不自动抬起**，松手才 `releaseCombo` —— 真正的长按该键（语音输入 / 按住修饰键 / 游戏按键） |
| 多条（任意类型）             | `repeat` 持续循环 | 按住达到阈值后循环执行整个队列，每轮之间停 `holdRepeatMs`，松手停止（音量 / 方向键 / 切歌）                             |
| 单条媒体键（音量/亮度/播放） | `repeat` 持续循环 | 例外走循环：这类键由系统直接消费，按一次只算一步，保持按住不会持续生效，只有反复触发才等价于「长按音量键」              |
| 单条非「模拟按键」           | `once` 执行一次   | 单条打开应用只执行一次，避免反复开窗口                                                                                  |

- **四种触发全覆盖**：点击 = 短按序列；长按（单条模拟按键）= 持续按住该按键；
  长按（多条）= 持续循环整个列表；单条其他类型 = 执行一次
- **keep 档**：只有「模拟按键」会被按住，队列里的其他类型动作照常执行一次
- **repeat 档**：一轮跑完再等间隔（串行不重叠）；**队列里每个动作都会逐轮重跑**
  （放「打开应用」会反复开窗口，属误配）；每轮前复核会话有效 + 按键仍按住 + 总时长上限
  `KEYPAD_REPEAT_MAX_MS = 60000`（防 `off` 丢失导致无限连发）
- **循环间隔** `holdRepeatMs`：20–5000ms，缺省 `KEYPAD_REPEAT_MS_DEFAULT = 100`，
  仅 `repeat` 时落盘；面板在推导为「持续循环」时显示间隔输入（`HoldBehaviorEditor.vue`）
- **结束时机**：抬手（`off`）是权威出口——repeat 唤醒间隔等待立即停、keep 倒序抬起组合；
  断开/拔线/换连接/保存绑定经 `resetPressed` 一并中止（见下节「断开即停」）
- **零回归**：无 `holdActions` 的键位行为与旧版完全一致（按下立即执行短按序列）

### 断开即停：会话世代中止（2026-09-11）

**主动断开、异常拔线、换连接、保存绑定**都必须让所有按键事件立即停止，因此引入「连接会话世代」：

- `resetPressed()`（上述四处的统一出口）执行顺序：**`endSession()` 换代中止在途序列** →
  `running.clear()` → 清空挂起的长按计时 → 结束循环与保持会话 → 清 `pressed` → `releaseAll()`
- **在途序列的中止**：`runSequence` 每条动作前复核 `isSessionLive(generation)`，且用
  `Promise.race([当前动作, 该世代的中止信号])` 等待——断开瞬间世代信号 resolve，
  卡在 `delay` 或异步动作上的 await 立刻返回，不再向下执行**后续动作**
  （注意：中止信号必须按世代捕获，不能读模块变量，换代后它已指向新世代的未决 promise）
- **挂起的长按计时**：回调先复核世代，计时期间已断开则丢弃该次长按，不触发动作
- **循环 / 保持会话**：`runRepeatLoop` 每轮复核 `isSessionLive` 与 `pressed`；
  `runKeepSession` 立即 `releaseCombo` 抬起已按住的组合（`heldCombos` 引用计数保证不误抬）
- **`running` 用 Map<keyId, 世代>**：旧序列收尾只清理自己的世代，不会误删重连后同键位新序列的条目
- **主动断开的即时性**：`disconnect()` 先发起 `closePort`（其内部**同步**摘除数据监听，
  之后不会再有新按键进来）再 `resetPressed`，使循环/保持/计时在端口关闭的等待期间就停止，
  而不是等关闭完成才停
- **异常拔线**：`onPortClosed` 回调按 `config.lastPort` 判定属自己后同样走 `resetPressed`
- **退出兜底**：`will-quit` 调 `endSession()` + `releaseAll()`，防修饰键卡死到系统

### 新增动作类型指南（2026-09-10「打开网页」已按此落地）

1. `src/common/types/keypad.ts`：加 `KeypadUrlAction` 接口并入 `KeypadAction` 联合、
   `KeypadActionType` 加 `'url'`
2. `src/common/keypad/actions/url.ts`：定义 `{ type:'url', label:'打开网页', normalize,
createDefault }`（normalize 校验 http/https 协议，`isValidKeypadUrl` 经 index.ts
   再导出供渲染层实时提示共用），在 `actions/index.ts` 的 `KEYPAD_ACTIONS` 登记一行
3. `src/main/src/buddy/keypad/actions/urlExecutor.ts`：`onPress` 里 `shell.openExternal(...)`
   （无效网址 reject 由 runSequence 统一捕获），在执行器注册表登记一行
4. 渲染层 `actionEditors/UrlEditor.vue`（URL 输入框，协议不合法标红提示，emit change），
   在编辑器注册表（EDITORS + ICONS 的 `LinkIcon`）登记

归一化（normalizeBinding 逐条查表）、添加动作卡片、序列行动态编辑器、执行分发全部自动生效。

## 实现思路

- **串口原始数据读取（SerialService 通用化）**：`subscribePortData(path, cb)`——openPort 时挂
  `data` 监听，utf8 文本块**原样**分发给订阅方（模块不做分帧假设）；协议解析在小键盘侧
  `keypadProtocol.ts`：无分隔符文法流式匹配，跨 chunk 残段缓冲衔接，兼容 \r\n/空白分隔与
  大小写，失步丢字符重同步。红绿灯/圆屏只写不读，零影响。
- **域化链路（照红绿灯四层结构）**：`@common` 契约 → main 域（Service 单例/Config/Ipc/actions）→
  preload 桥（仅伙伴窗口注入）→ buddy 页面。连接编排/lastPort 记忆/意外断开处理全在 main。
- **模拟按键（keySimulator.ts）**：koffi 预编译 FFI 直调平台 API，无本地编译链。
  - macOS：CoreGraphics `CGEventCreateKeyboardEvent` + `CGEventSetFlags` + `CGEventPost(kCGHIDEventTap)`，
    修饰键发独立按下/抬起事件、主键事件额外携带修饰 flag；需系统「辅助功能」授权
    （`AXIsProcessTrusted` 检测，未授权时页面顶部 t-alert 引导）。
    **`setFlags` 无条件调用**（含 0，2026-09-12）——不显式清零会继承全局 flag 状态，
    Fn 位粘连后普通键会被当成 Fn+键。
  - Windows：user32 `keybd_event` 逐键 down/up（`KEYEVENTF_KEYUP=2`），无需授权。
  - **Fn 是修饰键**（2026-09-12）：`MAC_MODIFIERS.fn = { code: 0x3F, flag: 1 << 23 }`；
    `key` 可缺省=只投递修饰键（见「注意事项」Fn 键节）。
  - **媒体键走另一条路径**（2026-09-11）：macOS 不能当普通键盘事件发——须构造
    `NX_SYSDEFINED`（type 14）系统定义事件，`subtype=8`（aux control buttons）、
    `data1 = (NX_KEYTYPE_* << 16) | (down ? 0x0a : 0x0b) << 8`、`data2=-1`；字段号实测为
    subtype=83 / data1=149 / data2=150（AppKit 产出事件的字段布局，见 keySimulator 常量）。
    Windows 用 `VK_VOLUME_*` / `VK_MEDIA_*` 虚拟键；**亮度在 Windows 无标准虚拟键 → 静默跳过**
    （配置仍保留，仅该平台不生效）。
  - **引用计数**：同一组合被多个键位绑定时，全部释放才真正抬起（`heldCombos` Map）；
    长按 keep 档的保持按住依赖它——抬起时 `releaseCombo` 幂等，未按住时跳过。
  - **防修饰键卡死**：主动断开、意外拔线、保存绑定、应用退出（`will-quit`）一律 `releaseAll()`。
- **打开应用（appExecutor）**：路径存在 → `shell.openPath`（.app / .exe / .lnk 通吃）；
  否则视为应用名走平台 shell（macOS `open -a <名称>`，Windows `start "" "<名称>"` 整条直传
  ——cliRun 的单引号 quote 不被 cmd 识别，win 分支不走 cliRun 拼 args）。
- **执行脚本（scriptExecutor）**：`cliRun(command, [], { timeout: 60s })`——login PATH 兜底、
  超时 kill、Promise 必 resolve；fire-and-forget，`result.error` 记日志。
- **延时等待（delayExecutor）**：onPress 返回 `setTimeout(ms)` 包装的 Promise，序列
  `await` 它形成动作间隔；定义（含 50–60000ms 边界）在 `@common/keypad/actions/delay.ts`。
- **打开网页（urlExecutor）**：`shell.openExternal(url)` 交系统默认浏览器；仅接受
  http/https 协议（定义侧 `isValidKeypadUrl` 白名单，防 file: 等非网页协议误配）。
- **启动即初始化**：`initKeypad()` 随 registerIpc 在 app ready 执行：加载配置 → 订阅
  `onPortClosed` → lastPort 存在于串口列表才 `openPort` 自动连接并重挂行订阅。
- **按下状态**：main 维护 `pressed` 集合（含未绑定键位），变化即 `keypad:state` 广播全部窗口；
  连接/断开时清空（设备状态未知）。序列执行中另有 `running` 集合做每键重入守卫；
  配置了长按的键位另有 `holdTimers` 挂起判定计时（见短按/长按判定节）。

## 本机应用目录与图标（app 动作支撑）

- **应用枚举 `src/main/src/modules/appCatalog.ts`**：`listInstalledApps()`——macOS 扫
  `/Applications`、`/System/Applications`（含各自 `Utilities`）、`~/Applications` 顶层 `*.app`
  （名称 = 目录名去后缀，不解析 Info.plist）；Windows 扫开始菜单 Programs（ProgramData +
  AppData）递归 `*.lnk`（openPath 可直接打开快捷方式）。每次调用现扫（顶层 readdir 毫秒级）。
- **图标提取 `src/main/src/modules/appIcon.ts`**：`iconPngForApp(path)`——macOS **纯 Node
  进程内解析 icns**：读 `.app/Contents/Resources/*.icns`（多个取文件最大），解析 icns 容器
  逐 chunk（type+长度）取内嵌 PNG 数据（PNG 魔数校验，ic07+ 均为 PNG 编码），优先 64~256px
  段最大者（18px 下拉图标清晰且文件小）；无 icns 回退取 Resources 下最大 *.png。**不走外部
  进程**——qlmanage 依赖 QuickLook XPC 实测会挂起（提取超时全 404），`app.getFileIcon` 因
  NSImage 断言崩溃全库禁用（见 docs/app/01）。现代应用普遍仍打包 .icns（实测 Safari/WeChat/
  QQ/Calculator 均有），仅纯 Assets.car 无 icns 的应用取不到 → null → 前端首字母占位。
  Windows 用 PowerShell `ExtractAssociatedIcon`（.lnk 先解析目标；脚本落临时 .ps1 用 `-File`
  执行，规避 cmd 引号坑，best-effort）。产物缓存 `~/.mistrelle/cache/app-icons/<md5(路径)>.png`。
- **图标服务**：本地事件服务（express）新增 `GET /icon/app?path=<enc 绝对路径>`——Origin 守卫
  同资源面；缓存命中直出 PNG，miss 提取落缓存，失败 404（前端回退首字母占位）。
  渲染层直接 import `EVENT_SERVER_ORIGIN`（@common）拼 URL，经 `<img>` 加载（浏览器缓存 +
  `Cache-Control: public, max-age=86400`）。

## 配置结构（事实源 `@common/types/keypad.ts`）

`~/.mistrelle/buddy/keypad.json`：

```jsonc
{
  "lastPort": "/dev/tty.usbmodemXXX",
  "layout": "grid4x2",
  "bindings": {
    "1": { "actions": [{ "type": "combo", "modifiers": ["shift"], "key": "f13" }] },
    "2": {
      "name": "切到Cursor",
      "actions": [{ "type": "app", "path": "/Applications/Cursor.app" }]
    },
    "3": {
      "actions": [
        { "type": "app", "path": "/Applications/WeChat.app" },
        { "type": "delay", "ms": 500 },
        { "type": "combo", "modifiers": ["meta"], "key": "v" }
      ]
    },
    "4": {
      "actions": [{ "type": "url", "url": "https://github.com" }],
      "holdActions": [{ "type": "app", "path": "/Applications/Safari.app" }]
    },
    "5": {
      "actions": [{ "type": "combo", "modifiers": ["meta"], "key": "c" }],
      "holdActions": [{ "type": "combo", "modifiers": ["ctrl"], "key": "f13" }]
    },
    "6": {
      "actions": [{ "type": "combo", "modifiers": [], "key": "f14" }],
      "holdActions": [
        { "type": "combo", "modifiers": [], "key": "f15" },
        { "type": "delay", "ms": 50 },
        { "type": "combo", "modifiers": [], "key": "f16" }
      ],
      "holdRepeatMs": 120
    }
  }
}
```

- 上例：键 4 长按单条「打开应用」= 执行一次；
  键 5 长按单条「模拟按键」= 保持按住 Ctrl+F13，松手才抬起；
  键 6 长按三条 = 循环整个队列，每轮间隔 120ms

- `bindings` 键 = 设备行协议键位 id（字符串），值 = **绑定对象 `{name?, actions, holdActions?, holdRepeatMs?}`**
  （`name` 可选显示名称——键帽优先显示名称，未命名回退首条动作摘要 +「共 N 个动作」小字；
  `actions` = 短按动作序列；`holdActions` = 可选长按动作序列（行为由队列形状推导），
  `holdRepeatMs` = 长按循环间隔（仅推导为循环时落盘），见长按行为节），
  缺省/空序列 = 未绑定仅状态点亮
- `layout` = 键盘样式布局 id（纯展示偏好，`keypad:saveLayout` 保存，白名单
  `KEYPAD_LAYOUT_IDS` 校验，非法/缺省归一化回退 `'grid4x2'`）。
  现有取值：`'grid4x2'`（样式一）/ `'grid4x2Knob'`（样式二，含旋钮）
- **旋钮键位号**（样式二）：右转 `10` / 左转 `11` / 按下 `12`（键位 9 = 右组下方按键）。
  三者在 `bindings` 里与普通键位完全同构，例如预置的音量映射：
  ```jsonc
  "10": { "name": "音量 +", "actions": [{ "type": "combo", "modifiers": [], "key": "volume-up" }] },
  "11": { "name": "音量 -", "actions": [{ "type": "combo", "modifiers": [], "key": "volume-down" }] },
  "12": { "name": "静音",   "actions": [{ "type": "combo", "modifiers": [], "key": "mute" }] }
  ```
  键位号是纯数字串（协议 `^(\d+),(on|off)` 接受任意数字），无编号上限；
  旋钮占用哪些号完全由布局定义决定，换型号只需改布局定义
- **存量兼容**：`normalizeBinding`——`{name?, actions, holdActions?, holdRepeatMs?}` 新格式 / 上一代纯数组
  序列（无名）/ 最早的单动作对象（含无 `type` 的最老 combo 格式 `{modifiers, key}`）多代全兼容，
  自动包装归一，无需迁移脚本；序列内非法条目逐条丢弃，清空的序列整个丢弃；
  `name` trim 非空才落盘，`holdActions` 空/全非法不落盘，`holdRepeatMs` 取整夹 20–5000
  且仅推导为「持续循环」（多条队列）时落盘
- 模拟按键主键白名单 `KEYPAD_KEY_CODES` 元组（**Enter** + F1–F19 + 字母 + 数字），从元组派生
  类型/选项/校验；修饰键 `ctrl | alt | shift | meta`（meta = macOS Cmd / Windows Win）
- **媒体 / 系统功能键**（2026-09-11）另立元组 `KEYPAD_MEDIA_KEY_CODES`：`volume-up` /
  `volume-down` / `mute` / `brightness-up` / `brightness-down` / `play-pause` / `track-next` /
  `track-prev`（中文名映射 `KEYPAD_MEDIA_KEY_LABELS`，展示走 `keypadKeyLabel`）。
  这类键**没有修饰键语义**（归一化强制清空 modifiers），也**无法用键盘录制捕获**
  （浏览器只给得到 `event.code`，收不到音量键），只能在编辑器「功能键」下拉里选
- `isKeypadKeyName` = 普通键 ∪ 媒体键；`isKeypadRegularKeyName` / `isKeypadMediaKeyName`
  分别收窄（录制映射只认普通键，执行侧按媒体键分流）
- 归一化：`normalizeBinding` 逐条走 `normalizeAction` 查 `KEYPAD_ACTIONS` 注册表按 type
  分发清洗，未注册类型/非法条目丢弃

## 关键文件

| 文件                                                    | 职责                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/common/types/keypad.ts`                            | 类型契约：`KeypadAction*` 判别联合 / `KeypadBinding`（含 `holdActions?` + `holdRepeatMs?`）/ `KEYPAD_HOLD_MS` + 循环间隔常量 / `KeypadConfig/State/Api` / `AppCatalogItem` + 普通键/媒体键/修饰键白名单守卫                                                                                                                                                                                                                                                                                                                                                          |
| `src/common/keypad/actions/`                            | **动作定义注册表**：combo/app/script/permission/delay/url（label/normalize/createDefault）+ `KEYPAD_ACTIONS` 聚合 + 穷尽校验 + `KeypadActionTypeOptions`                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/common/buddy/keypad/keypadChannels.ts`             | IPC 通道常量（getConfig/saveBindings/listApps/connect/disconnect/getState/state）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/main/src/buddy/keypad/actions/`                    | **动作执行器注册表**：onPress（可异步）+ 映射类型聚合（combo=击键模拟、app=shell.openPath/`open -a`、script=cliRun、permission=审批回传、delay=sleep Promise、url=shell.openExternal）                                                                                                                                                                                                                                                                                                                                                                               |
| `src/main/src/buddy/keypad/keySimulator.ts`             | koffi 模拟按键：平台键码表、pressCombo/releaseCombo/releaseAll、AXIsProcessTrusted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/main/src/buddy/keypad/keypadConfig.ts`             | keypad.json 读写与归一化（normalizeBinding 多代格式兼容归一 {name?,actions,holdActions?}/纯数组/单动作 + normalizeAction 查表）                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/main/src/buddy/keypad/keypadService.ts`            | 单例服务：init/connect/disconnect/行解析/handleEvent（短按/长按互斥判定 holdTimers）/dispatchHold（keep 保持 / repeat 循环 / once）+runRepeatLoop+runKeepSession+**会话世代 endSession（断开即中止在途序列）**/resetPressed/dispatchSequence+runSequence（顺序执行+世代感知重入守卫）/saveBindings/broadcastState                                                                                                                                                                                                                                                    |
| `src/main/src/buddy/keypad/keypadIpc.ts`                | IPC handler 注册（含 listApps）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/main/src/buddy/keypad/keypadProtocol.ts`           | 无分隔符流式解析器：`数字,on/off` 文法匹配 + 不完整前缀等待 + 失步丢字符重同步                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/main/src/modules/appCatalog.ts`                    | 本机应用枚举（mac .app 扫描 / win 开始菜单 .lnk）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/main/src/modules/appIcon.ts`                       | 应用图标提取（mac qlmanage / win PowerShell）+ PNG 磁盘缓存                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/main/src/server/index.ts`                          | 本地事件服务：新增 `/icon/app` 图标面（Origin 守卫 + 缓存 + 404 回退）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/preload/src/modules/keypad/keypad.ts`              | 渲染层桥（buddy.ts 注入 `keypad`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/renderer/src/windows/buddy/pages/hardware/keypad/` | 页面：`Keypad.vue` + `useKeypad.ts` + SerialPanel/KeypadKeys/KeypadKeyCap/**KeypadKnob**（旋钮：圆盘 + 盘内左右转提示 + 键位号提示，按压通道由布局派生）/KeypadBindingPanel/**KeypadRouteSelect**（旋钮路切换条）/KeypadSequenceEditor/**HoldBehaviorEditor**（长按行为展示 + 循环时间隔输入）/KeypadPlaceholder + `keypadLayouts.ts`（布局注册表：分组 + 判别 cell + preset + `knobRoutes`）/`layoutPreset.ts`（样式预置仅补空缺）/`iconHref.ts`（图标 URL/应用名工具）+ `actionText.ts`（动作摘要文本）+ `actionEditors/`（编辑器注册表 + comboRecorder 单例录制） |

## 页面交互

- 顶部串口面板（照红绿灯精简：下拉 + 刷新 + 连接/断开 + 状态 tag，无调试模式）
- 已连接显示**实体键盘外观**（2026-09-09 增强）：
  - **键盘样式**：面板头部 t-select 切换（`config.layout` 持久化，`keypad:saveLayout`）；
    布局定义在渲染层 `keypadLayouts.ts` 注册表，模型为**分组 + 判别 cell**：
    `{ id, label, groups: [{ columns, cells }], preset? }`，cell 分两类——
    **普通键位** `{ kind: 'key', keyId, cols?, rows? }`（cols/rows 跨格数，组内经 grid
    auto-placement 排布）、**旋钮** `{ kind: 'knob', cwKey, ccwKey, pressKey? }`。
    多个分组在键盘外壳内横排、组间由 `t-divider`(vertical) 做**纯视觉分隔**（不参与格位）。
    - **样式一（4×2）**：单分组 4 列，键位 1 左侧竖跨 2 行、键位 6 底部横跨 2 列，
      2/3/4/5 普通键。
    - **样式二（4×2 + 旋钮）**：左分组 4 列八键（键位 1–8）；右分组 1 列——上为旋钮、
      下为键位 9；`preset` 预置旋钮音量映射（右转 10 音量+ / 左转 11 音量- / 按下 12 静音）。
    - 新增样式 = @common 加联合成员 + IDS 登记 + 渲染层注册表加布局定义。
  - **旋钮（2026-09-14）**：无极、可左右转，**三路各占一个普通键位号**，设备按普通按键
    上报（`<id>,on` / `<id>,off`），因此协议解析/动作模型/执行器/IPC **零改动**，完全复用
    按键绑定链路。**「是否可按压」是布局配置**——`KeypadKnobCell.pressKey` 缺省即该旋钮
    不可按压：配置面板的路切换条与键位号提示都由 `knobRoutes(cell)` 从布局派生
    （可按压 3 路 / 不可按压 2 路），不写死三路；不可按压型号仅用 10/11，12 闲置属预期。
    编辑方式：点旋钮 → 右侧面板顶部「绑定路」切换条（左转/右转/按下，`t-radio-group`
    default-filled）选中哪路就配哪路，下方复用现有序列编辑器（面板契约仍是单一 keyId，
    切路只 emit 新 keyId，既有 watch 自然重载草稿，单向数据流不破）。
  - **样式预置**：`KeypadLayoutDefinition.preset` 为该样式的开箱默认绑定；切到此样式时由
    `layoutPreset.applyLayoutPreset` **仅补未绑定键位、不覆盖用户已有绑定**，无新增则跳过
    保存。切换样式本身即触发一次 `saveBindings`（其内部 resetPressed，属低频可接受）。
  - **设备侧要求**：旋钮转动必须 `on`/`off` **成对上报**——`keypadService.handleEvent`
    对同一键位号有按下去重（`if (pressed.has(keyId)) return`），只发 `on` 会让后续转动被吞。
  - **外壳与键帽**（拟物风，只参考实物布局不参考颜色）：格子固定正方形 `--key-size: 88px`
    （合并键 = 整数倍格子不变形），外壳 `--td-bg-color-secondarycontainer` + 内外阴影整体
    居中；键帽 = 白面（`--td-bg-color-container`）+ 灰色厚度层/阴影（半透明黑随主题自适应）+
    顶部白高光 + 大圆角，键帽上显示键位号 + **绑定摘要**（`binding.name` 优先——名称即代表
    整个序列；未命名显示首条动作摘要 +「共 N 个动作」小字，app 首条带 `/icon/app` 图标；
    `actionText.ts` 的 `keypadActionSummary` 共享；未绑定 = 灰字）
  - **按下动画**：鼠标 mousedown 下压（translateY + 厚度压缩，0.08s 短促过渡）mouseup 回弹；
    设备物理按下（pressed 推送）键帽同步保持按下态 + 品牌色描边发光
  - **点击键位 → 右侧配置面板**（2026-09-09 重构，替代原 t-popup 弹出——功能增多后 popup
    空间小且位置随键位漂移）：`.panel-body` 左右两栏（`.keyboard-area` flex:1 内键盘居中 +
    `.side-panel` 300px 常驻栏）。点击键帽 → 键帽 brand 描边 + 外圈 ring 选中态
    （`KeypadKeyCap` 新增 `selected` prop）→ 右栏渲染 `KeypadBindingPanel`（Fluent 风格：
    迷你键帽徽标 + 「配置键位 N」标题 + 实时摘要副文本（各动作摘要 `→` 连接）+ **右上角 X
    关闭按钮**（`emit('close')`）→ **显示名称输入框**（可选，maxlength 20，留空显示动作
    摘要）→ **短按/长按两区块**（2026-09-10：「短按 · 点击触发」恒显 + 「长按 · 按住
    600ms 触发」空态文案「未配置长按 · 键位按下立即执行短按序列」；各渲染一个**动作序列
    编辑器 `KeypadSequenceEditor`**——草稿 `{name, actions, holdActions, holdRepeatMs}`
    面板持有、props 只读 + emit change 单向流、新增可选 `emptyText` prop 定制空态；
    长按序列非空时其下再挂 **`HoldBehaviorEditor`**——2026-09-11：展示由队列形状推导出的
    行为（执行一次 / 保持按住 / 持续循环）+ 仅「持续循环」时显示循环间隔输入（20–5000ms））→
    清除/保存操作行）。
    序列编辑器：每条动作一行（**序号徽标 + 类型图标 + 摘要文本 + 上移/下移/删除**），点行
    手风琴展开该条编辑器（单开、Transition 淡入、不套浅底容器）；底部「＋ 添加动作」虚线
    按钮展开**类型图标选择卡片**（KEYPAD_ACTION_ICONS 映射 + KEYPAD_ACTIONS 注册表渲染，
    悬停态品牌色），选中即追加 `createDefault()` 到序列尾部并展开。
    **combo 的 createDefault 不预设主键**（`{modifiers: []}`，2026-09-12）——新增后主键为空，
    由用户录制主键或勾选修饰键；两者皆空属未完成动作（摘要显示「未选择按键」、归一化拒绝、保存按钮禁用）。
    旧版曾默认填 F13 占位，导致「Fn 只能勾选、主键却总是存在」的误导，已移除。
    编辑器自身也去表单化：**combo = 录制区展示主键键帽**（未设置主键时显示「未设置主键 · Fn 请用下方修饰键」，
    整块虚线区点击录制、录制中品牌色脉冲呼吸；**「修饰键」勾选行**（t-checkbox-group，
    Ctrl/Alt/Shift/Cmd/Fn）——Fn 录不到只能由此勾选，勾选时显示「Fn 无法录制」提示；
    **「清除主键」按钮**=只按住修饰键（长按 Fn 的唯一入口，无修饰键时禁用））、
    **app = 选中项大图标 + 名称**（select `valueDisplay` 自定义）、**delay = t-input-number**
    （50–60000ms，步进 100，suffix ms）。
    关闭途径：再点同一键（toggle）/ 右上角 X / 保存 / 清除成功；点其他键即切换面板内容
    （`:key="activeKeyId"` 重挂重建草稿）。未选键时右栏显示空态提示（gesture-click 图标 +
    「点击左侧键位，配置按键动作」），**常驻不跳动**；面板/空态切换经 `panel-fade` 过渡。
    保存预校验 = 短按序列非空且短按/长按逐条 normalize 通过（逐条异步展开校验失败即禁用保存）；
    序列全部删除后保存等价清除。外观职责：`.side-panel` 容器持边框/背景/圆角/内边距，
    `KeypadBindingPanel` 剥离外观（width/padding/background 已删）只留内容布局，宽度撑满
    容器。键盘格子固定正方形 `--key-size`（88px），合并键 = 整数倍格子不变形，外壳内整体居中
- macOS 未授权时顶部 `t-alert` 引导授权（仅 combo 场景需要；Windows 恒不显示）
- 未连接显示占位（连接后可配置绑定）

## 注意事项

- **短按序列里的 combo 是完整击键**：短按序列中的模拟按键按下 60ms 自动抬起；
  需要「按住期间保持组合」请把**单条模拟按键放进长按队列**（keep 档，见长按行为节）；
  heldCombos 引用计数与 releaseAll 兜底仍保留（覆盖连按/保持/保存绑定/断开等竞态窗口）
- **长按判定边界**：仅配置了 `holdActions` 的键位生效；阈值全局 600ms 不做每键可配；
  长按触发后（按住达阈值）松手不再触发短按（互斥）；拔线/断开清空挂起计时器与长按会话；
  长按队列执行中该键位的后续触发被 `running` 守卫忽略（与短按一致）
- **断开必须立即停**（2026-09-11）：主动断开/拔线/换连接/保存绑定统一走 `resetPressed`，
  先 `endSession()` 换代中止在途序列（`Promise.race` 与世代信号竞速，卡在 delay 上的 await 立刻返回），
  再清计时/循环/保持会话并 `releaseAll`；`disconnect()` 先发起 `closePort`（同步摘监听）
  再 reset，使停止不等端口关闭完成。**注意世代信号须按世代捕获**（读写模块变量会在换代后
  指向新 promise 导致永不 resolve）
- **长按行为由形状决定，无配置项**（2026-09-11）：单条模拟按键 = 保持按住（keep）、
  多条 = 循环（repeat）、单条其他类型 = 执行一次（once）、单条媒体键 = 循环（例外）。
  **repeat 会逐轮重跑整个队列**（放「打开应用」= 反复开窗口，属误配，面板提示已说明）；
  keep 只对「模拟按键」生效，队列里其他动作仍只执行一次
- **长按的停止出口**：抬手（`off`）为主；repeat 若 `off` 丢失最长持续
  `KEYPAD_REPEAT_MAX_MS = 60000`（每轮前复核会话有效/按键仍按住/总时长），
  或下一次断开/保存绑定；keep 的组合由引用计数 + `releaseAll()` 兜底（与 combo 一致）
- **序列重入守卫**：同键位序列执行中（含延时）再次触发被忽略——快速连按不会并发跑两条
  序列；要重新触发需等当前序列跑完。**长按会话不走该守卫**（由 `pressed` 去重 +
  `holdLoops`/`keepSessions` 单会话登记保证同一键位不会并发起两个会话）；
  `running` 为 `Map<keyId, 世代>`，旧序列收尾不会误删重连后新序列的条目
- **koffi 为原生依赖**（dependencies，externalizeDeps 外部化），与 better-sqlite3 同由
  electron-builder smartUnpack 处理 .node 产物，无需额外 asarUnpack 配置
- macOS 虚拟键码为 ANSI 布局位置码（`kVK_ANSI_*`），非字符值；新增主键需同时补
  `MAC_KEY_CODES`（`enter` = kVK_Return 0x4c）与 Windows 侧 `winKeyCode` 特判
  （`enter` = VK_RETURN 0x0D，**漏特判会被字母公式误算成 E 键**）；`KEYPAD_KEY_CODES` 元组同步
- **Fn 键（macOS，2026-09-12）**：Fn 归入**修饰键**而非主键——它在 macOS 是 `flagsChanged`
  标志位（`kCGEventFlagMaskSecondaryFn` = `1 << 23`），不是普通按键。合成路径 =
  `CGEventCreateKeyboardEvent(null, kVK_Function 0x3F, down)` + `CGEventSetFlags(...)` + `CGEventPost(0)`；
  Apple 头文件（CGEvent.h）明示该 API 按键码自动生成 `flagsChanged` 事件，故无需手写 `CGEventSetType`。
  `NX_KEYTYPE_*` 枚举里**没有** Fn，因此不能走媒体键那条 `NX_SYSDEFINED` 路径。
  - 建模：`KeypadModifier` 增 `'fn'`；`KeypadComboAction.key` 改**可选**以支持「只按住修饰键」
    （归一化约束：主键与修饰键不可同时为空）。用法=长按队列放**单条「模拟按键」且仅勾 Fn**
    （无主键），按住超过 `KEYPAD_HOLD_MS` 即持续按住 Fn、松手释放。原型场景=按住 Fn 触发
    微信输入法语音输入（**能否触发取决于对方读键方式，只能实机验证**，本仓库不保证）。
  - **Fn flag 粘连**：`post()` 的 `setFlags` 改为**无条件调用**（原为 `if (flags)`）——
    不显式清零会继承全局 flag 状态，Fn 位粘连后普通键会被应用当成 Fn+键（已知坑）。
  - **Windows 无 Fn**（fn 无对应 VK）：`WIN_MODIFIER_CODES` 改 `Partial`，投递时静默跳过；
    若组合里只有 Fn 则该平台什么都不投递，仅修饰键+Fn 的组合退化为只发主键
  - 限制（未验证/不可控）：① 合成 Fn 只对**基于 event tap 的软件**可见，若目标程序用
    `IOHIDManager` 直读真实键盘设备则收不到；② 系统级 Globe 动作（输入法切换/表情面板）由
    WindowServer 在事件 tap 之前执行，**不保证触发**且可能有副作用；③ 前台若有更高优先级的
    HID event tap 会吞掉合成 Fn；④ 需先按住达全局 600ms 阈值才发出 Fn
- **媒体键的三个已知限制**：① 亮度键在 Windows 无标准虚拟键，静默不生效；
  ② 音量/亮度这类键由系统直接消费，部分应用内快捷键场景收不到；
  ③ 媒体键无组合语义，编辑器选了媒体键会自动清空已录制的修饰键（归一化也会强制清空）
  （**Fn 同理**：macOS 上普通键与 Fn 可共存，但媒体键 + Fn 无意义，归一化丢弃修饰键）
- 模拟按键针对「快捷键触发」场景；捕获原始输入的游戏（Raw Input）不响应注入事件
- 流式解析宽容：动作大小写宽容、容忍 \r\n/空白分隔；失步（乱码）丢字符重同步
- 按键无反应的排查顺序：确认应用已连接且串口选对（macOS 会同时列出 `tty.*`/`cu.*` 变体）→
  端口未被其他串口工具占用（多读端抢数据，且打开即复位设备）→ 临时在 keypadService
  订阅回调 `console.info` 原始数据核对文法（正式代码无收包日志，避免刷屏）
- 录制快捷键是**页面级** keydown 监听：系统/菜单保留组合（如 macOS Cmd+Q/Cmd+W）
  被先行消费录不到，属预期；跨窗口保存绑定前必须 JSON 深拷贝
  （config 是深层 reactive Proxy，浅展开嵌套对象跨 contextBridge 克隆报错，useQuota 同款坑）
- Windows 图标提取/`start` 打开为 best-effort 未实测（开发机 macOS）；纯 Assets.car 无
  .icns 的应用取不到图标 → 404 → 前端首字母占位，属预期降级
- **应用图标不显示排查**：先 `curl 'http://127.0.0.1:47743/icon/app?path=<enc>'` 看状态码——
  404 = 提取失败（查该应用 Resources 是否有 .icns/.png），缓存目录
  `~/.mistrelle/cache/app-icons/` 有产物 = 服务正常查前端
