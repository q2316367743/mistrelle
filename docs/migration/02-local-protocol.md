# mistrelle:// 本地资源协议

> 让渲染进程用 URL 加载本地磁盘资源（字体 / 图片），解决 dev 模式下 file:// 被 Chromium 拦截的问题。
> 同时注册为**系统级链接**：外部应用 open `mistrelle://…` 可唤起本应用（仅接收，不弹窗/不聚焦）。

## 背景与动机

dev 模式渲染页 origin 为 `http://localhost:7743`（main 进程 `loadURL`），Chromium 安全策略禁止 http 页面加载
`file://` 子资源，报错 **"Not allowed to load local resource"**。此前 `FontFace` 直接加载
`file://.../fonts/xxx.ttf` 会触发该报错（`fontFaceRegistry.ts`）；同样受影响的有 `<img>` / `background-image`
场景（`BgResult.vue`、`imageRef.ts`、`canvasRender.ts`、`NoteService.ts`、`FilePreviewDialog.tsx` 等所有走
`net.pathToHref` 的调用方）。生产模式页面 origin 是 `file://`，本不报错，但行为应与 dev 一致。

## 实现方案：自定义协议

main 进程注册 `mistrelle://` 特权 scheme，经 `protocol.handle` 由 main 读盘返回，无跨源限制，保留浏览器 /
FontFace 缓存；纯进程内行为，不落盘、不注册系统级项，退出即消失。

### URL 约定（/{模块}/{功能}）

```text
mistrelle://app/file/<encodeURIComponent(绝对路径)>
```

- 例：`mistrelle://app/file/%2FUsers%2Fesion%2F.mistrelle%2Fassets%2Ffonts%2Fxxx.ttf`
- 由 preload 侧 `net.pathToHref(path)` 统一生成（内部 `node:path` 的 `resolve` 归一化 + `encodeURIComponent`），
  调用方 API 签名不变，无需逐个改动。
- 2026-09-03 起由 `mistrelle://local/<enc>` 迁移而来（`local` → `app/file`），调用方零改动
  （均走 `pathToHref` 运行期生成，无持久化 URL）；`protocol.handle` 侧同步按 host=`app` +
  pathname 首段 `file` 解析读盘。

### 关键文件

| 文件                                            | 职责                                                              |
|-------------------------------------------------|-------------------------------------------------------------------|
| `src/main/src/app/protocol.ts`                      | `registerLocalSchemes()`（app ready 前注册特权 scheme）+ `registerLocalProtocol()`（app ready 后 `protocol.handle`）+ `captureOpenUrl()`/`registerDeepLink()`（系统级链接接收） |
| `src/main/index.ts`                             | `requestSingleInstanceLock` + 模块顶层调 `registerLocalSchemes()`/`captureOpenUrl()`；`whenReady` 回调内调 `registerLocalProtocol()`/`registerDeepLink()` |
| `src/preload/src/lib/net.ts`                        | `pathToHref`：绝对路径 → `mistrelle://app/file/<enc>`                |
| `src/renderer/src/utils/fontFaceRegistry.ts`    | `new FontFace(name, url(pathToHref(path)))` 用 URL 源异步加载字体 |
| `electron-builder.yml`                           | mac `CFBundleURLTypes` + win/linux `protocols`：打包产物注册 mistrelle scheme |

## 系统级链接（外部应用唤起，仅接收不弹窗）

外部软件 `open mistrelle://app/…`（或浏览器/系统打开该链接）可唤起本应用：
- **单实例**：`requestSingleInstanceLock()` 抢锁失败即 `app.quit()`；二次唤起经首实例 `second-instance`
  事件收到整条 argv，取首个 `mistrelle://` 开头的参数交 `handleExternalUrl`。
- **macOS**：`open-url` 事件可能早于 ready 触发，`captureOpenUrl()` 在模块顶层挂监听，
  ready 前收到的 URL 暂存 `pendingUrls`，`registerDeepLink()`（ready 后）flush 补收；
  URL 需 `event.preventDefault()` 避免二次走默认打开流程。
- **处理语义**：`handleExternalUrl(url)` **只消费 URL**（当前仅 console 记录 + `routeExternalCommand`
  路由桩），**不 show 主窗口、不聚焦、不打扰 UI**；冷启动仍按常态建窗。命令/事件分发表
  （如 opencode → traffic-light `applyEvent`）后续挂到该桩，无需再动注册链路。

### 注册时机（易踩坑）

- `protocol.registerSchemesAsPrivileged` **必须在 `app` ready 之前调用**，因此放在 `src/main/index.ts`
  模块顶层（import 之后、`app.whenReady()` 之前），不能放进 `whenReady` 回调。
- `protocol.handle` 必须在 ready 之后注册，放 `whenReady` 回调，与 `registerIpc()` 并列。
- `requestSingleInstanceLock` / `captureOpenUrl` 同样须在 ready 前（模块顶层）挂好，
  `setAsDefaultProtocolClient`（`registerDeepLink`）在 ready 后调用。

### 特权配置

```ts
privileges: {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  corsEnabled: true,
  bypassCSP: true
}
```

- `supportFetchAPI`：FontFace 的 URL 源本质走 fetch，需要此权限；
- `corsEnabled`：**必须开**，否则跨源（renderer origin 为 http://localhost）请求该 scheme 会被 CORS 直接拦截
  （"Cross origin requests are only supported for protocol schemes: ..."）；开启后由响应头
  `Access-Control-Allow-Origin` 放行；
- `bypassCSP`：绕过页面 CSP 对 `font-src` / `img-src` 的限制；
- `standard` + `secure`：标准 URL 解析 + 视为安全上下文。

### handler 细节

- 从 `new URL(request.url)` 校验 host=`app`、pathname 首段为 `file`，随后 `decodeURIComponent`
  还原绝对路径，`readFile` 读盘返回 `Response`；host/模块不符或读取失败统一 404，不抛异常；
- 响应头设置 `Content-Type`（按扩展名映射，字体 / 常见图片）与 `Access-Control-Allow-Origin: *`（跨源 cors 请求放行）；
- 未实现 Range 分片（字体 / 图片全量返回即可，后续如需支持视频再加）。
- 注意：**handler 与系统级唤起是两条独立链路**。`protocol.handle` 只服务渲染层 fetch/子资源加载；
  外部应用 open 的 URL 由 OS 路由到 `open-url`/`second-instance`，不进 `protocol.handle`。

## 安全模型

handler 能读取的路径范围与现状一致——renderer 本就通过 fs IPC 具备任意路径读权限，该协议不扩大攻击面；
不需要 `webSecurity: false`，不影响渲染进程安全级别。系统级链接面当前只消费 URL（记录 + 路由桩），
不因外部 URL 弹窗/导航，未引入命令能力前无额外攻击面。

## 验证

- dev：`npm run dev`，打开字体预览 / 图片渲染，确认无 "Not allowed to load local resource" 报错；
- 生产：`npm run build` 后 `loadFile` 页面加载同一协议 URL 行为一致；
- 协议 URL 编解码往返：`encodeURIComponent(resolve(path))` → `new URL(...).pathname` → `decodeURIComponent` 可还原原路径；
- 系统级链接（dev 下手动验证）：把 Electron/开发产物注册为 scheme 处理者后
  `open 'mistrelle://app/file/…'`，应用被唤起但**不弹窗不聚焦**（首实例在日志可见
  `[mistrelle://] 收到外部唤起`）。
