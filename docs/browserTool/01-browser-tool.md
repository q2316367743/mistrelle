# browserTool 浏览器工具模块

> `browser_fetch` / `browser_actions` 两个 AI 工具的浏览器执行核心。
> 主进程**一个方法** `browserTool:run` 统一服务这两个工具（替代被删除的完整 cBrowser 实现）。

## 一、设计思路

- **主进程一个入口**：`window.preload.inject.runBrowser(payload)` → IPC `browserTool:run` →
  main `BrowserToolRunner` 直接创建隐藏 BrowserWindow **进程内顺序执行**。
- **无 runner 子进程、无窗口池、无链式客户端**（全删 cBrowser 后从零写的精简版，约 300 行）。
- **载荷判别联合**：`{ kind: 'fetch' }` 抓取网页内容；`{ kind: 'actions' }` 执行自动化步骤。
- **步骤解释在 main**：renderer 工具只保留 schema 描述 + 薄 handler，把 steps 原样传给 main；
  页内执行函数（extractHtml/extractText/dispatchClick/setValue/scroll*）在 main 内定义，
  `String(fn)` 序列化后送入页面执行。

## 二、关键文件

| 层 | 文件 | 职责 |
|---|---|---|
| main | `src/main/src/modules/browser/runner.ts` | `BrowserToolRunner`：窗口生命周期 + fetch/actions 解释 + 浏览器操作实现 |
| main | `src/main/src/modules/browser/browserToolIpc.ts` | `browserTool:run` handler（每次调用 new 一个 runner 实例） |
| 契约 | `src/preload/src/modules/<域>/*Channels.ts` | `BrowserToolChannels` + `BrowserToolFetchPayload` / `BrowserToolActionsPayload` / `BrowserToolResult` |
| preload | `src/preload/src/inject.ts` | `runBrowser(payload)` 桥：error 时 reject，resolve 最后一个数据项 |
| renderer | `src/renderer/src/modules/tool/components/native/browserFetch.ts` | `browser_fetch` 工具（kind:'fetch'） |
| renderer | `src/renderer/src/modules/tool/components/native/browserAutomation.ts` | `browser_actions` 工具（kind:'actions'） |
| renderer | `src/renderer/src/types/inject.d.ts` | `runBrowser` 类型（`InjectRunBrowserPayload` 判别联合） |

## 三、IPC 契约

### 通道 `browserTool:run`（`ipcRenderer.invoke`）

请求载荷（判别联合）：

```ts
// browser_fetch：隐藏窗口导航 + 等待渲染 + 提取内容
{ kind: 'fetch', url: string, waitMs?: number, mode?: 'markdown'|'text'|'html', selector?: string }
// browser_actions：自动化操作步骤
{ kind: 'actions', steps: Array<{ type: string, [k: string]: unknown }>, options?: { show?: boolean, ... } }
```

返回 `BrowserToolResult`：

```ts
{ data: unknown[]; error?: boolean; message?: string }
```

**preload `runBrowser` 语义**：`error` 时 reject（message 为错误）；resolve 为 `data` 的**最后一个元素**
（fetch 为提取的内容，actions 为最后一个非 undefined 步骤结果）。

### actions 步骤表（type → 字段 → main 实现）

| type | 字段 | main 实现 |
|---|---|---|
| goto | url / headers? / timeout? | loadURL + dom-ready 超时（默认 60s） |
| click | selector | 页内 JS 事件分发（`dispatchClick`） |
| value | selector / value | 页内设置值 + input/change（`setValue`） |
| evaluate | script（函数体）/ args?（$0/$1...） | `new Function` 序列化执行 |
| wait | ms? 或 selector? + timeout? | sleep 或轮询 `document.querySelector`（默认 60s） |
| screenshot | selector? / savePath? | selector 滚动定位截图 / 整页截图 → temp/downloads |
| press | key / modifiers? | KEY_CODE_MAP + sendInputEvent |
| paste | text? | 剪贴板 + `document.execCommand('paste')` |
| scroll | selector? 或 x+y 或 y | 页内 scrollTo / scrollIntoView |
| cookies | action(get/set/remove/clear) + name/value/filter/cookies/url | session.cookies 系列 |
| getHtml / getText | selector? | 页内提取 outerHTML / innerText |
| getTitle | — | `document.title` |
| hide / show | — | 窗口显隐 |
| viewport | width / height | setContentSize |
| useragent | userAgent | webContents.userAgent |
| css | css | insertCSS |

## 四、注意事项

- **窗口安全**：默认 `show: false` 隐藏；`options.show === true` 或 'show' 步骤才显示；结束时销毁
- **隔离 session**：`session.fromPartition('browserTool')`（内存分区，与主窗口 Cookie/缓存隔离）
- **窗口选项白名单**：只透传 width/height/frame/transparent 等安全键，防任意构造
- **方法前置**：多数操作要求先 goto（`_pageReady` 标志），否则抛 `'"goto" method did not executed'`
- **临时目录**：screenshot 默认保存到 `<temp>/browserTool/`
- **全局超时**：5 分钟强制终止（销毁窗口并返回错误），防页面卡死
- **页内函数约束**：extractHtml 等页内函数必须**自包含**（只引用 document/window 全局），
  `String(fn)` 序列化后才能在页面上下文执行
- **执行环境限制**：executeJavaScript 抛错即中断整次运行（无 jsCodeTemplate 的 {data,error} 包装），
  步骤解释器直接拿到页面错误信息并返回

## 五、删除记录（cBrowser → browserTool）

原完整 cBrowser 实现（preload 链式客户端 `cBrowser.ts`/`cBrowserScripts.ts`、main
executor/manager/devices/types、resources runner 子进程、`cbrowser:run` 通道）已全部删除，
改为上述精简方案。turndown 依赖保留（markdown 提取需要）。
