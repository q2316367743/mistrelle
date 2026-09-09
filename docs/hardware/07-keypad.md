# 07 小键盘（keypad）：串口按键 + 动作注册表（模拟按键 / 打开应用 / 执行脚本）

> 伙伴窗口硬件页面（菜单「小键盘」）：6 键小键盘设备（支持任意键数）经串口（**9600 波特率**）
> 上报按键消息，main 解析行协议后按键位绑定**执行对应动作**。动作类型注册表化，当前三种：
> **模拟按键**（系统级组合键，跨平台其他应用与系统快捷键均可响应）、**打开应用**（本机应用
> 列表下拉 + 自定义路径）、**执行脚本**（任意 shell 命令）。页面结构：上方串口连接控制、
> 下方键位卡片（草稿式内联编辑）。

## 行协议（设备 → main）

- 9600 波特率，ASCII 文本 `<键位>,<动作>`，如 `1,on`、`2,off`
- **设备不带任何行尾/分隔符**（实测 `1,on` 后无换行无回车），不能按行分帧；
  main 用文法流式解析（`数字 + , + on/off` 逐段匹配，见 keypadProtocol）
- `on`=按下、`off`=释放（按住期间保持按下语义）；`on` 重复上报去重不重复触发
- 键位 id 支持任意数量；页面当前展示 1–6，超出页面的键位仍会点亮/触发

## 动作模型（注册表驱动，2026-09-09 重构）

每键绑定**一种**动作（按 `type` 判别的联合，存盘 `KeypadAction`）。三端各有一张注册表，
**新增动作 = 各端加一个文件 + 登记一行**，分发/归一化/卡片框架零改动：

| 端 | 注册表 | 条目职责 |
|----|--------|----------|
| `@common/keypad/actions/` | `KEYPAD_ACTIONS` | `KeypadActionDefinition`：type / label / normalize（配置清洗，main 落盘与渲染层保存预校验共用）/ createDefault（空白草稿） |
| `src/main/src/buddy/keypad/actions/` | `KEYPAD_ACTION_EXECUTORS` | `KeypadActionExecutor<T>`：onPress（设备 on）/ onRelease?（设备 off，仅 push-to-talk 类动作需要） |
| 渲染层 `components/actionEditors/` | `KEYPAD_ACTION_EDITORS` | 编辑器组件（统一契约 `props.action` 只读草稿 + `emit('change')` 回传，内部按 type 收窄） |

- 三张表均用**映射类型 `{ [D in KeypadAction as D['type']]: ... }` 或编译期穷尽校验**
  强制齐活：`KeypadActionType` 联合加了成员而任一注册表漏登记，typecheck 直接报错
- `KeypadActionTypeOptions`（类型下拉）从 `KEYPAD_ACTIONS` 派生防失同步
- **触发语义**：combo 按下按住组合、释放抬起（push-to-talk）；app / script 仅在 `on` 触发一次
  （handleEvent 的 pressed 集合去重天然防长按重复），fire-and-forget，失败只记日志

### 新增动作类型指南（以「打开网址」为例）

1. `src/common/types/keypad.ts`：加 `KeypadUrlAction` 接口并入 `KeypadAction` 联合、
   `KeypadActionType` 加 `'url'`
2. `src/common/keypad/actions/url.ts`：定义 `{ type:'url', label:'打开网址', normalize,
   createDefault }`，在 `actions/index.ts` 的 `KEYPAD_ACTIONS` 登记一行
3. `src/main/src/buddy/keypad/actions/urlExecutor.ts`：`onPress` 里 `shell.openExternal(...)`，
   在执行器注册表登记一行
4. 渲染层 `actionEditors/UrlEditor.vue`（URL 输入框，emit change），在编辑器注册表登记一行

归一化（normalizeAction 查表）、类型下拉、卡片动态编辑器、执行分发全部自动生效。

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
- **启动即初始化**：`initKeypad()` 随 registerIpc 在 app ready 执行：加载配置 → 订阅
  `onPortClosed` → lastPort 存在于串口列表才 `openPort` 自动连接并重挂行订阅。
- **按下状态**：main 维护 `pressed` 集合（含未绑定键位），变化即 `keypad:state` 广播全部窗口；
  连接/断开时清空（设备状态未知）。

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
  "bindings": {
    "1": { "type": "combo", "modifiers": ["shift"], "key": "f13" },
    "2": { "type": "app", "path": "/Applications/WeChat.app" },
    "3": { "type": "script", "command": "~/scripts/demo.sh" }
  }
}
```

- `bindings` 键 = 设备行协议键位 id（字符串），缺省 = 未绑定仅状态点亮
- **存量兼容**：无 `type` 的旧条目（`{modifiers, key}`）归一化时回退 combo，无需迁移脚本
- 模拟按键主键白名单 `KEYPAD_KEY_CODES` 元组（F1–F19 + 字母 + 数字），从元组派生类型/选项/校验；
  修饰键 `ctrl | alt | shift | meta`（meta = macOS Cmd / Windows Win）
- 归一化：`normalizeAction` 查 `KEYPAD_ACTIONS` 注册表按 type 分发清洗，未注册类型/非法条目丢弃

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/common/types/keypad.ts` | 类型契约：`KeypadAction*` 判别联合 / `KeypadConfig/State/Api` / `AppCatalogItem` + 主键/修饰键白名单守卫 |
| `src/common/keypad/actions/` | **动作定义注册表**：combo/app/script（label/normalize/createDefault）+ `KEYPAD_ACTIONS` 聚合 + 穷尽校验 + `KeypadActionTypeOptions` |
| `src/common/buddy/keypad/keypadChannels.ts` | IPC 通道常量（getConfig/saveBindings/listApps/connect/disconnect/getState/state） |
| `src/main/src/buddy/keypad/actions/` | **动作执行器注册表**：onPress/onRelease 钩子 + 映射类型聚合（combo=pressCombo/releaseCombo、app=shell.openPath/`open -a`、script=cliRun） |
| `src/main/src/buddy/keypad/keySimulator.ts` | koffi 模拟按键：平台键码表、pressCombo/releaseCombo/releaseAll、AXIsProcessTrusted |
| `src/main/src/buddy/keypad/keypadConfig.ts` | keypad.json 读写与归一化（normalizeAction 查表 + 存量 combo 回退） |
| `src/main/src/buddy/keypad/keypadService.ts` | 单例服务：init/connect/disconnect/行解析/handleEvent 查执行器分发/saveBindings/broadcastState |
| `src/main/src/buddy/keypad/keypadIpc.ts` | IPC handler 注册（含 listApps） |
| `src/main/src/buddy/keypad/keypadProtocol.ts` | 无分隔符流式解析器：`数字,on/off` 文法匹配 + 不完整前缀等待 + 失步丢字符重同步 |
| `src/main/src/modules/appCatalog.ts` | 本机应用枚举（mac .app 扫描 / win 开始菜单 .lnk） |
| `src/main/src/modules/appIcon.ts` | 应用图标提取（mac qlmanage / win PowerShell）+ PNG 磁盘缓存 |
| `src/main/src/server/index.ts` | 本地事件服务：新增 `/icon/app` 图标面（Origin 守卫 + 缓存 + 404 回退） |
| `src/preload/src/modules/keypad/keypad.ts` | 渲染层桥（buddy.ts 注入 `keypad`） |
| `src/renderer/src/windows/buddy/pages/hardware/keypad/` | 页面：`Keypad.vue` + `useKeypad.ts` + SerialPanel/KeypadKeys/KeypadKeyCard/KeypadPlaceholder + `actionEditors/`（编辑器注册表 + comboRecorder 单例录制） |

## 页面交互

- 顶部串口面板（照红绿灯精简：下拉 + 刷新 + 连接/断开 + 状态 tag，无调试模式）
- 已连接显示 6 张键位卡片：键号徽标 + 按下点亮（success 描边）+ **草稿式内联编辑**——
  动作类型 t-select（未绑定时选择即建空白草稿；options 从动作注册表派生）+
  `<component :is>` 按 `KEYPAD_ACTION_EDITORS` 动态渲染编辑器：
  - **combo**：录制快捷键（页面级 keydown 捕获，Esc/失焦取消，录到即回填草稿）+ 组合预览；
    录制器 `comboRecorder.ts` 模块级单例，全局同时仅一处录制、新录制顶掉旧录制（旧侧只复位 UI）
  - **app**：t-select `filterable + creatable + clearable`，选项渲染图标 + 名称（图标走
    `/icon/app`，失败回退首字母占位）；手输路径回车经 creatable 生成自定义路径
  - **script**：t-textarea 命令框（2~5 行自适应）
- 「保存」前用动作定义 normalize 预校验（空白草稿/未选应用/空命令时禁用），写回后以 main
  回读为准同步草稿；「清除」解绑。配置回读（保存/清除/外部变更）驱动草稿同步
- macOS 未授权时顶部 `t-alert` 引导授权（仅 combo 场景需要；Windows 恒不显示）
- 未连接显示占位（连接后可配置绑定）

## 注意事项

- **koffi 为原生依赖**（dependencies，externalizeDeps 外部化），与 better-sqlite3 同由
  electron-builder smartUnpack 处理 .node 产物，无需额外 asarUnpack 配置
- macOS 虚拟键码为 ANSI 布局位置码（`kVK_ANSI_*`），非字符值；新增主键需同时补
  `MAC_KEY_CODES`（Windows 侧为公式计算无需补表）与 `KEYPAD_KEY_CODES` 元组
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
