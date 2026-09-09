# 01 本地事件服务（HTTP）

> main 进程内置 express 服务，监听 **127.0.0.1:47743**（只绑回环）。承载两个面：
> **资源面** `/file/<编码绝对路径>`（渲染层加载本地字体 / 图片，替代原 `mistrelle://` 自定义协议）；
> **事件面** `/buddy/event?platform=…&event=…`（外部进程投递事件，词汇表白名单详见 hardware/05）。
> 不经系统唤起、不激活应用；`mistrelle://` 协议（含系统级链接）已于 2026-09-04 整体删除。

## 背景与动机

- 资源面：dev 模式渲染页 origin 为 `http://localhost:7743`，Chromium 禁止 http 页面加载 `file://`
  子资源。原方案为自定义协议（`protocol.handle` 读盘返回）；HTTP 服务同效且实现更直白，
  `webview` 任意 session/partition 均可达（自定义协议只注册在默认 session）。
- 事件面：opencode 插件经系统深链 `open mistrelle://…` 投递事件时，macOS LaunchServices 会把
  本应用激活到前台抢焦点（接收侧无 API 可拒绝），深链冷启动还会把未运行的应用整个拉起（负优化）。
  本地 HTTP 由进程直接回环连接，**结构性零焦点、零进程开销**；应用未运行时投递失败静默丢弃
  （红绿灯「灯灭」语义正确）。

## URL 契约

| 面 | 形式 | 说明 |
|----|------|------|
| 探活 | `GET /ping` → 204 | 外部进程判断应用是否在跑 |
| 资源 | `GET /file/<encodeURIComponent(绝对路径)>` | 读盘返回，`Content-Type` 按扩展名映射 + `Access-Control-Allow-Origin: *` |
| 事件 | `GET\|POST /buddy/event?platform=<软件>&event=<Buddy 事件>` | **零校验纯转发**：完整原始事件 `publishRawBuddyEvent` 发布到原始事件总线（`buddyEventBus.ts` raw 段），监听器各取所需——白名单过滤（`buddyEventFilter`，命中发布校验后总线供设备消费）与集成调试事件流（`integrationsActivity`，全量转发伙伴窗口）；对外始终 204，未知路由 404 |
| 权限 | `POST /buddy/permission/ask\|replied\|decide`（JSON body） | 接入适配层，thin 转调权限审批基座（`buddy/permission/permissionService`）：ask 挂起等决定、replied 撤下原生侧已答项、decide 供外部脚本回传允许/拒绝；契约与语义见 hardware/08 |

- 地址事实源：`src/common/server/eventServer.ts` 的 `EVENT_SERVER_ORIGIN`（main 与 preload 共享；
  插件模板为独立文件无法 import，端口常量注释互指）。
- 资源 URL 由 preload 侧 `net.pathToHref(path)` 统一生成（`resolve` 归一化 + `encodeURIComponent`），
  渲染层调用方 API 签名不变。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/main/src/server/index.ts` | `startEventServer()`：express 装配（/ping、/file 资源面、事件路由、权限面）、Origin 守卫、生命周期 |
| `src/main/src/buddy/permission/permissionService.ts` | 权限审批基座（注册表/广播/决定回传，见 hardware/08） |
| `src/main/src/buddy/events/buddyEventBus.ts` | 原始事件总线（raw）+ 校验后事件总线（typed） |
| `src/main/src/buddy/events/buddyEventFilter.ts` | 事件面白名单过滤监听器（校验收口） |
| `src/main/src/buddy/integrations/integrationsActivity.ts` | 集成调试事件流全量采集（见 hardware/06） |
| `src/common/server/eventServer.ts` | `EVENT_SERVER_ORIGIN` 端口事实源（跨端共享） |
| `src/main/index.ts` | `whenReady` 内调 `startEventServer()`，先于建窗（保证渲染层子资源可达） |
| `src/preload/src/lib/net.ts` | `pathToHref`：绝对路径 → `{ORIGIN}/file/<enc>` |
| `resources/plugins/opencode/mistrelle-integration.js` | 事件投递方（纯 fetch，见 docs/hardware/03） |

## 安全模型

- 只绑 `127.0.0.1`：局域网不可达；本机其他进程可访问——与现状持平（渲染层本就经 fs IPC 具备
  任意路径读权限，服务不扩大攻击面）。
- **Origin 守卫**（资源面）：请求带 `Origin` 且非本应用来源（`http://localhost:7743` /
  `http://127.0.0.1:7743` / `null`）→ 403。防公网网页经浏览器回环 drive-by 读盘（带 Origin 的
  CORS 请求被拒；`<img>`/字体等子资源与插件、curl 均无 Origin，不受影响）。
- 事件面只消费 query 参数，无命令执行能力；platform/event 白名单校验收口在原始总线的
  过滤监听器（`buddyEventFilter`），未命中不进入设备消费链路（调试事件流仅本地展示）。
- 无 Range 分片（字体 / 图片全量返回；后续视频预览需要时再加）。

## 生命周期与验证

- `startEventServer()` 在 `app.whenReady` 内先于建窗调用；端口占用只打日志不崩溃（渲染层资源
  加载会 404，事件投递方静默丢弃）；`will-quit` 时 `server.close()`。
- 手动验证：
  - `curl 'http://127.0.0.1:47743/ping' -o /dev/null -w '%{http_code}'` → 204
  - `curl 'http://127.0.0.1:47743/file/%2FUsers%2F%E2%80%A6%2Fx.png' -o /dev/null -w '%{http_code}'` → 200
  - `curl 'http://127.0.0.1:47743/buddy/event?platform=opencode&event=session.idle'` → 204 且各设备分发
