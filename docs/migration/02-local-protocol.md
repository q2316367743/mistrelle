# mistrelle:// 本地资源协议

> 让渲染进程用 URL 加载本地磁盘资源（字体 / 图片），解决 dev 模式下 file:// 被 Chromium 拦截的问题。

## 背景与动机

dev 模式渲染页 origin 为 `http://localhost:7743`（main 进程 `loadURL`），Chromium 安全策略禁止 http 页面加载
`file://` 子资源，报错 **"Not allowed to load local resource"**。此前 `FontFace` 直接加载
`file://.../fonts/xxx.ttf` 会触发该报错（`fontFaceRegistry.ts`）；同样受影响的有 `<img>` / `background-image`
场景（`BgResult.vue`、`imageRef.ts`、`canvasRender.ts`、`NoteService.ts`、`FilePreviewDialog.tsx` 等所有走
`net.pathToHref` 的调用方）。生产模式页面 origin 是 `file://`，本不报错，但行为应与 dev 一致。

## 实现方案：自定义协议

main 进程注册 `mistrelle://` 特权 scheme，经 `protocol.handle` 由 main 读盘返回，无跨源限制，保留浏览器 /
FontFace 缓存；纯进程内行为，不落盘、不注册系统级项，退出即消失。

### URL 约定

```text
mistrelle://local/<encodeURIComponent(绝对路径)>
```

- 例：`mistrelle://local/%2FUsers%2Fesion%2F.mistrelle%2Fassets%2Ffonts%2Fxxx.ttf`
- 由 preload 侧 `net.pathToHref(path)` 统一生成（内部 `node:path` 的 `resolve` 归一化 + `encodeURIComponent`），
  调用方 API 签名不变，无需逐个改动。

### 关键文件

| 文件                                            | 职责                                                              |
|-------------------------------------------------|-------------------------------------------------------------------|
| `src/main/src/app/protocol.ts`                      | `registerLocalSchemes()`（app ready 前注册特权 scheme）+ `registerLocalProtocol()`（app ready 后 `protocol.handle`） |
| `src/main/index.ts`                             | 模块顶部调 `registerLocalSchemes()`；`whenReady` 回调内调 `registerLocalProtocol()` |
| `src/preload/src/net.ts`                        | `pathToHref`：绝对路径 → `mistrelle://local/<enc>`                |
| `src/renderer/src/utils/fontFaceRegistry.ts`    | `new FontFace(name, url(pathToHref(path)))` 用 URL 源异步加载字体 |

### 注册时机（易踩坑）

- `protocol.registerSchemesAsPrivileged` **必须在 `app` ready 之前调用**，因此放在 `src/main/index.ts`
  模块顶层（import 之后、`app.whenReady()` 之前），不能放进 `whenReady` 回调。
- `protocol.handle` 必须在 ready 之后注册，放 `whenReady` 回调，与 `registerIpc()` 并列。

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

- 从 `new URL(request.url).pathname` 去前导 `/` 后 `decodeURIComponent` 还原绝对路径，`readFile` 读盘返回 `Response`；
- 响应头设置 `Content-Type`（按扩展名映射，字体 / 常见图片）与 `Access-Control-Allow-Origin: *`（跨源 cors 请求放行）；
- 文件不存在 / 读取失败统一返回 404，不抛异常；
- 未实现 Range 分片（字体 / 图片全量返回即可，后续如需支持视频再加）。

## 安全模型

handler 能读取的路径范围与现状一致——renderer 本就通过 fs IPC 具备任意路径读权限，该协议不扩大攻击面；
不需要 `webSecurity: false`，不影响渲染进程安全级别。

## 验证

- dev：`npm run dev`，打开字体预览 / 图片渲染，确认无 "Not allowed to load local resource" 报错；
- 生产：`npm run build` 后 `loadFile` 页面加载同一协议 URL 行为一致；
- 协议 URL 编解码往返：`encodeURIComponent(resolve(path))` → `new URL(...).pathname` → `decodeURIComponent` 可还原原路径。
