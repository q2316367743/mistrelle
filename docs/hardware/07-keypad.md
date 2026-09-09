# 07 小键盘（keypad）：串口按键 + 动作序列（模拟按键 / 打开应用 / 执行脚本 / 权限审批 / 延时等待）

> 伙伴窗口硬件页面（菜单「小键盘」）：6 键小键盘设备（支持任意键数）经串口（**9600 波特率**）
> 上报按键消息，main 解析行协议后按键位绑定**顺序执行动作序列**。每键绑定一个动作数组
> （2026-09-09 晚由单动作升级为序列），动作类型注册表化，当前五种：
> **模拟按键**（系统级组合键，模拟一次完整击键）、**打开应用**（本机应用列表下拉 + 自定义
> 路径）、**执行脚本**（任意 shell 命令）、**权限审批**（待审请求允许/拒绝）、**延时等待**
> （序列间隔 50–60000ms）。页面结构：上方串口连接控制、下方键位卡片（草稿式序列编辑）。

## 行协议（设备 → main）

- 9600 波特率，ASCII 文本 `<键位>,<动作>`，如 `1,on`、`2,off`
- **设备不带任何行尾/分隔符**（实测 `1,on` 后无换行无回车），不能按行分帧；
  main 用文法流式解析（`数字 + , + on/off` 逐段匹配，见 keypadProtocol）
- `on`=按下（顺序执行绑定的动作序列）、`off`=释放（**仅状态簿记不分发动作**——序列瞬时
  执行不依赖物理释放）；`on` 重复上报去重不重复触发
- 键位 id 支持任意数量；页面当前展示 1–6，超出页面的键位仍会点亮/触发

## 动作模型（注册表驱动，2026-09-09 重构 + 序列化）

每键绑定一个**动作序列**（数组，按下按顺序执行，存盘 `KeypadAction[]`），数组元素为按
`type` 判别的动作联合。三端各有一张注册表，**新增动作 = 各端加一个文件 + 登记一行**，
分发/归一化/序列编辑器框架零改动：

| 端 | 注册表 | 条目职责 |
|----|--------|----------|
| `@common/keypad/actions/` | `KEYPAD_ACTIONS` | `KeypadActionDefinition`：type / label / normalize（配置清洗，main 落盘与渲染层保存预校验共用）/ createDefault（空白草稿） |
| `src/main/src/buddy/keypad/actions/` | `KEYPAD_ACTION_EXECUTORS` | `KeypadActionExecutor<T>`：onPress（序列执行到该动作时触发，可异步——delay 即 sleep Promise） |
| 渲染层 `components/actionEditors/` | `KEYPAD_ACTION_EDITORS` | 编辑器组件（统一契约 `props.action` 只读草稿 + `emit('change')` 回传，内部按 type 收窄） |

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
  - `off` 只做 pressed 集合簿记与广播（pressed 去重天然防长按重复触发）

### 新增动作类型指南（以「打开网址」为例）

1. `src/common/types/keypad.ts`：加 `KeypadUrlAction` 接口并入 `KeypadAction` 联合、
   `KeypadActionType` 加 `'url'`
2. `src/common/keypad/actions/url.ts`：定义 `{ type:'url', label:'打开网址', normalize,
   createDefault }`，在 `actions/index.ts` 的 `KEYPAD_ACTIONS` 登记一行
3. `src/main/src/buddy/keypad/actions/urlExecutor.ts`：`onPress` 里 `shell.openExternal(...)`，
   在执行器注册表登记一行
4. 渲染层 `actionEditors/UrlEditor.vue`（URL 输入框，emit change），在编辑器注册表登记一行

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
  - Windows：user32 `keybd_event` 逐键 down/up（`KEYEVENTF_KEYUP=2`），无需授权。
  - **引用计数**：同一组合被多个键位绑定时，全部释放才真正抬起（`heldCombos` Map）。
  - **防修饰键卡死**：主动断开、意外拔线、保存绑定、应用退出（`will-quit`）一律 `releaseAll()`。
- **打开应用（appExecutor）**：路径存在 → `shell.openPath`（.app / .exe / .lnk 通吃）；
  否则视为应用名走平台 shell（macOS `open -a <名称>`，Windows `start "" "<名称>"` 整条直传
  ——cliRun 的单引号 quote 不被 cmd 识别，win 分支不走 cliRun 拼 args）。
- **执行脚本（scriptExecutor）**：`cliRun(command, [], { timeout: 60s })`——login PATH 兜底、
  超时 kill、Promise 必 resolve；fire-and-forget，`result.error` 记日志。
- **延时等待（delayExecutor）**：onPress 返回 `setTimeout(ms)` 包装的 Promise，序列
  `await` 它形成动作间隔；定义（含 50–60000ms 边界）在 `@common/keypad/actions/delay.ts`。
- **启动即初始化**：`initKeypad()` 随 registerIpc 在 app ready 执行：加载配置 → 订阅
  `onPortClosed` → lastPort 存在于串口列表才 `openPort` 自动连接并重挂行订阅。
- **按下状态**：main 维护 `pressed` 集合（含未绑定键位），变化即 `keypad:state` 广播全部窗口；
  连接/断开时清空（设备状态未知）。序列执行中另有 `running` 集合做每键重入守卫。

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
    "2": { "name": "切到Cursor", "actions": [{ "type": "app", "path": "/Applications/Cursor.app" }] },
    "3": {
      "actions": [
        { "type": "app", "path": "/Applications/WeChat.app" },
        { "type": "delay", "ms": 500 },
        { "type": "combo", "modifiers": ["meta"], "key": "v" }
      ]
    }
  }
}
```

- `bindings` 键 = 设备行协议键位 id（字符串），值 = **绑定对象 `{name?, actions}`**
  （`name` 可选显示名称——键帽优先显示名称，未命名回退首条动作摘要 +「共 N 个动作」小字；
  `actions` = 动作序列数组，按下按顺序执行），缺省/空序列 = 未绑定仅状态点亮
- `layout` = 键盘样式布局 id（纯展示偏好，`keypad:saveLayout` 保存，白名单
  `KEYPAD_LAYOUT_IDS` 校验，非法/缺省归一化回退 `'grid4x2'`）
- **存量兼容**：`normalizeBinding`——`{name?, actions}` 新格式 / 上一代纯数组序列（无名）/
  最早的单动作对象（含无 `type` 的最老 combo 格式 `{modifiers, key}`）三代全兼容，
  自动包装归一，无需迁移脚本；序列内非法条目逐条丢弃，清空的序列整个丢弃；
  `name` trim 非空才落盘
- 模拟按键主键白名单 `KEYPAD_KEY_CODES` 元组（**Enter** + F1–F19 + 字母 + 数字），从元组派生
  类型/选项/校验；修饰键 `ctrl | alt | shift | meta`（meta = macOS Cmd / Windows Win）
- 归一化：`normalizeBinding` 逐条走 `normalizeAction` 查 `KEYPAD_ACTIONS` 注册表按 type
  分发清洗，未注册类型/非法条目丢弃

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/common/types/keypad.ts` | 类型契约：`KeypadAction*` 判别联合 / `KeypadConfig/State/Api` / `AppCatalogItem` + 主键/修饰键白名单守卫 |
| `src/common/keypad/actions/` | **动作定义注册表**：combo/app/script/permission/delay（label/normalize/createDefault）+ `KEYPAD_ACTIONS` 聚合 + 穷尽校验 + `KeypadActionTypeOptions` |
| `src/common/buddy/keypad/keypadChannels.ts` | IPC 通道常量（getConfig/saveBindings/listApps/connect/disconnect/getState/state） |
| `src/main/src/buddy/keypad/actions/` | **动作执行器注册表**：onPress（可异步）+ 映射类型聚合（combo=击键模拟、app=shell.openPath/`open -a`、script=cliRun、permission=审批回传、delay=sleep Promise） |
| `src/main/src/buddy/keypad/keySimulator.ts` | koffi 模拟按键：平台键码表、pressCombo/releaseCombo/releaseAll、AXIsProcessTrusted |
| `src/main/src/buddy/keypad/keypadConfig.ts` | keypad.json 读写与归一化（normalizeBinding 三代格式兼容归一 {name?,actions}/纯数组/单动作 + normalizeAction 查表） |
| `src/main/src/buddy/keypad/keypadService.ts` | 单例服务：init/connect/disconnect/行解析/handleEvent/dispatchSequence+runSequence（顺序执行+重入守卫）/saveBindings/broadcastState |
| `src/main/src/buddy/keypad/keypadIpc.ts` | IPC handler 注册（含 listApps） |
| `src/main/src/buddy/keypad/keypadProtocol.ts` | 无分隔符流式解析器：`数字,on/off` 文法匹配 + 不完整前缀等待 + 失步丢字符重同步 |
| `src/main/src/modules/appCatalog.ts` | 本机应用枚举（mac .app 扫描 / win 开始菜单 .lnk） |
| `src/main/src/modules/appIcon.ts` | 应用图标提取（mac qlmanage / win PowerShell）+ PNG 磁盘缓存 |
| `src/main/src/server/index.ts` | 本地事件服务：新增 `/icon/app` 图标面（Origin 守卫 + 缓存 + 404 回退） |
| `src/preload/src/modules/keypad/keypad.ts` | 渲染层桥（buddy.ts 注入 `keypad`） |
| `src/renderer/src/windows/buddy/pages/hardware/keypad/` | 页面：`Keypad.vue` + `useKeypad.ts` + SerialPanel/KeypadKeys/KeypadKeyCap/KeypadBindingPanel/KeypadSequenceEditor/KeypadPlaceholder + `keypadLayouts.ts`（布局注册表）+ `iconHref.ts`（图标 URL/应用名工具）+ `actionText.ts`（动作摘要文本）+ `actionEditors/`（编辑器注册表 + comboRecorder 单例录制） |

## 页面交互

- 顶部串口面板（照红绿灯精简：下拉 + 刷新 + 连接/断开 + 状态 tag，无调试模式）
- 已连接显示**实体键盘外观**（2026-09-09 增强）：
  - **键盘样式**：面板头部 t-select 切换（`config.layout` 持久化，`keypad:saveLayout`）；
    布局定义在渲染层 `keypadLayouts.ts` 注册表（`{ id, label, columns, cells }`，cells 带
    `cols/rows` 跨格数经 grid auto-placement 排布）。样式一（4×2）：键位 1 左侧竖跨 2 行、
    键位 6 底部横跨 2 列，2/3/4/5 普通键。新增样式 = @common 加联合成员 + IDS 登记 +
    渲染层注册表加布局定义
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
    摘要）→ **动作序列编辑器 `KeypadSequenceEditor`**（草稿 `{name, actions}` 面板持有、
    props 只读 + emit change 单向流）→ 清除/保存操作行）。
    序列编辑器：每条动作一行（**序号徽标 + 类型图标 + 摘要文本 + 上移/下移/删除**），点行
    手风琴展开该条编辑器（单开、Transition 淡入、不套浅底容器）；底部「＋ 添加动作」虚线
    按钮展开**类型图标选择卡片**（KEYPAD_ACTION_ICONS 映射 + KEYPAD_ACTIONS 注册表渲染，
    悬停态品牌色），选中即追加 `createDefault()` 到序列尾部并展开。
    编辑器自身也去表单化：**combo = 键帽式 kbd 组合展示**
    （`[Ctrl] + [Shift] + [F13]` 每键一块小键帽，整块虚线区点击录制、录制中品牌色脉冲呼吸）、
    **app = 选中项大图标 + 名称**（select `valueDisplay` 自定义）、**delay = t-input-number**
    （50–60000ms，步进 100，suffix ms）。
    关闭途径：再点同一键（toggle）/ 右上角 X / 保存 / 清除成功；点其他键即切换面板内容
    （`:key="activeKeyId"` 重挂重建草稿）。未选键时右栏显示空态提示（gesture-click 图标 +
    「点击左侧键位，配置按键动作」），**常驻不跳动**；面板/空态切换经 `panel-fade` 过渡。
    保存预校验 = 序列非空且逐条 normalize 通过（逐条异步展开校验失败即禁用保存）；
    序列全部删除后保存等价清除。外观职责：`.side-panel` 容器持边框/背景/圆角/内边距，
    `KeypadBindingPanel` 剥离外观（width/padding/background 已删）只留内容布局，宽度撑满
    容器。键盘格子固定正方形 `--key-size`（88px），合并键 = 整数倍格子不变形，外壳内整体居中
- macOS 未授权时顶部 `t-alert` 引导授权（仅 combo 场景需要；Windows 恒不显示）
- 未连接显示占位（连接后可配置绑定）

## 注意事项

- **combo 已无 push-to-talk**：序列中的模拟按键是一次完整击键（按住 60ms 自动抬起），
  「按住期间保持组合」的旧用法不再支持；heldCombos 引用计数与 releaseAll 兜底仍保留
  （覆盖连按/保存绑定/断开等竞态窗口）
- **序列重入守卫**：同键位序列执行中（含延时）再次触发被忽略——快速连按不会并发跑两条
  序列；要重新触发需等当前序列跑完
- **koffi 为原生依赖**（dependencies，externalizeDeps 外部化），与 better-sqlite3 同由
  electron-builder smartUnpack 处理 .node 产物，无需额外 asarUnpack 配置
- macOS 虚拟键码为 ANSI 布局位置码（`kVK_ANSI_*`），非字符值；新增主键需同时补
  `MAC_KEY_CODES`（`enter` = kVK_Return 0x4c）与 Windows 侧 `winKeyCode` 特判
  （`enter` = VK_RETURN 0x0D，**漏特判会被字母公式误算成 E 键**）；`KEYPAD_KEY_CODES` 元组同步
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
