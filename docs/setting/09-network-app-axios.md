# 09 - 网络设置迁主进程 + main 通用 axios 客户端（统一代理）

> 状态：已落地（2026-09-21）。网络设置数据家迁 main；main 侧全部出站 HTTP 收口到通用 axios 客户端 `appAxios`，代理 / 超时 / TLS / UA 统一注入。

## 实现思路

改造前：网络设置是渲染层 Pinia store 直读写 `~/.mistrelle/setting/network.json`，唯一功能消费方是渲染层 `plugin/http.ts`（preload axios 注入代理）；**main 进程 6 个网络出口（Auth / Relay / Image / updater 检查 / quota 插件 / gzhTrends）全部裸跑，不走代理也不读网络设置**。且 axios 原生 `proxy` 对 https 目标不做 CONNECT、不支持 socks——设置页的 socket5 实际从未生效。

改造后三层：

1. **数据家迁 main**：`networkSetting.ts` 照 trafficLightConfig 先例读写同一份 `network.json`；`appAxios` 请求拦截器经**内存缓存**取值（每请求零磁盘 IO）。`saveNetworkSetting` 是唯一写入口，落盘后同步刷新缓存，保存即生效；应用外手改文件不感知（契约内不支持）。
2. **渲染层退化为视图**：`SettingNetworkStore` 加载 / 保存改走 `network:getSetting` / `network:saveSetting` IPC；返回形状不变（`setting` + `fillAxiosConfig`），设置页 UI 与 `plugin/http.ts` 零改动。
3. **main 六出口收口**：Auth / Relay / Image / updater 检查 / quota ctx.fetch / gzhTrends 全部换 `appAxios` / `createAppAxios`。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/common/types/networkSetting.ts` | 契约三方共用：`SettingNetwork` + 默认值 + `normalizeNetworkSetting()`（与默认值合并，修掉旧文件缺字段 undefined 的缺陷） |
| `src/main/src/modules/network/networkSetting.ts` | 数据家：`loadNetworkSetting()`（内存缓存 + 归一化回退）/ `saveNetworkSetting()`（唯一写入口：全量覆写 + 刷新缓存） |
| `src/main/src/modules/network/appAxios.ts` | 通用客户端：`appAxios` 单例 + `createAppAxios(overrides)` 工厂 + 请求拦截器 |
| `src/main/src/modules/network/networkIpc.ts` | `network:getSetting` / `network:saveSetting` |
| `src/preload/src/modules/network/` | Channels + 薄桥（`window.preload.network`） |
| `src/renderer/src/types/network.d.ts` | NetworkApi 声明（vite-env.d.ts 挂载） |
| `entity/setting/SettingNetwork.ts` | 改为 re-export `@common/types/networkSetting`（`@/entity` import 全兼容） |
| `store/setting/SettingNetworkStore.ts` | IPC 化（文件直读写删除；`Constant.getSettingNetworkPath` 已删） |

## appAxios 行为契约

- **显式值不被覆盖**：调用方在 axios.create 或请求级显式传的 `timeout`（含 Relay 的 0）/ `validateStatus` / UA 头，拦截器一律不覆盖；只对未设置的字段补默认（`connectTimeout*1000`、`maxRedirects`、UA）。
- **代理实现**（不用 axios 原生 proxy 打 https）：
  - https 目标：`httpsAgent = HttpsProxyAgent`（http/https 代理，CONNECT 隧道）或 `SocksProxyAgent`（socket5）
  - http 目标：axios 原生 `config.proxy`（对 http 完整可用）
  - **agent 按配置串 memo 缓存**，防每请求新建泄漏 socket
- **TLS / 读超时**：`ignoreTlsCertError` → httpsAgent `rejectUnauthorized` 取反（默认 true = 关校验，无代理时同样生效）；`readTimeout` → agent socket 空闲超时。**例外：SocksProxyAgent 构造器类型不透出 rejectUnauthorized，socks5 通道 TLS 校验跟随 Node 默认**。
- **本地绕过**：目标 host 为 127.0.0.1 / localhost / ::1 时不走代理、不挂 agent（本地事件服务 47743、dev server 3000 不受影响）。
- 依赖：`https-proxy-agent` + `socks-proxy-agent`（dependencies，externalizeDepsPlugin 只外部化 dependencies）。

## 六出口迁移对照

| 出口 | 改法 | 保留语义 |
|------|------|---------|
| AuthService | `axios.create` → `createAppAxios({timeout:15000, validateStatus})` | Set-Cookie 透出、validateStatus 全放行 |
| RelayService | 同上（timeout 0 显式不覆盖） | SSE stream 转发、abort signal、错误日志拦截器 |
| ImageService | 全局 axios → `appAxios` | arraybuffer、60s timeout |
| UpdaterService 检查 | undici fetch → `appAxios.get`（validateStatus 全放行） | 非 2xx / 失败返 null 回退 electron-updater feed |
| quotaRunner ctx.fetch | undici fetch → `appAxios.get(responseType:'text')` | `{status, body:text}` 契约不变；第三方插件 URL 同样走代理 |
| gzhTrends | 裸 https 主路径 → `appAxios`；**no-SNI 裸 https 回退保留**（axios 无法控制 servername） | 源站非常规 TLS 兜底 |

DesignStyleRemote 无独立客户端（authedApiGet 薄封装），跟随 AuthService 自动生效。

## 未收口项（有意保留）

- **渲染层 `plugin/http.ts` 三桥**（`window.preload.axios` / `net.downloadFileFromUrl` / `aiStream.streamRequest`）：搜索 / 技能下载 / favicon / AI 自定义供应商流式继续走 preload axios（Node adapter，免疫 CORS），代理经 `fillAxiosConfig` 注入。⚠️ 残缺点：axios 原生 proxy 对 https 目标不做 CONNECT、socks5 无效——二期把三桥迁 main IPC（流式照 `relay.ts` 的 requestId 事件回推范式）后由 appAxios 统一修复。
- **electron-updater** 与 **browser_fetch**：Chromium 自有网络栈，无法进 axios；前者如需强制代理只能 `session.setProxy`。
- 渲染层三处 `fetchRemoteDataUrl`（designHtml / gzh 排版管线 / 笔记卡片）用原生 fetch 抓网络图，未走代理（受 CORS 约束），二期随三桥一并收口。

## 注意事项

1. **设置加载时序**：`SettingNetworkStore` 仍是惰性初始化（首次 useXxxStore 时 IPC 拉取）；main 的 appAxios 不依赖渲染层，启动即按磁盘配置工作。
2. **缓存失效模型**：内存缓存 + 写时刷新（`saveNetworkSetting` 唯一写入口，写盘即更新缓存）；应用外手改 `network.json` 不感知——不为此留任何轮询 / TTL / watch 机制。坏 JSON 回退默认值不回写。
3. **quota 插件 URL 全走代理**：第三方插件脚本请求任意域名现在都会经过用户代理与超时（此前是 undici 裸 fetch）。
