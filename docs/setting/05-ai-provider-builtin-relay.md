# AI 设置 —— 内置供应商（服务端中转站）与自定义供应商门控

## 功能概述

「AI 设置」页左侧由扁平列表改为 **两组结构**：

1. **内置**（固定首组）：对接本地 mistrelle-server 的 **OpenAI 兼容中转站**（`/v1/models` + `/v1/chat/completions`）。免费档（未登录 + 已登录无会员）也可用，按积分计费。
2. **自定义供应商**（`thirdPartyRelay` 门控）：用户自填 Base URL / API Key 直连第三方厂商或中转，**付费档才显示**（`features.thirdPartyRelay === true`）。

同时新增**登录守卫**：未登录点「模型设置」提示登录；意外进入 `/setting/ai` 也要校验。

## 关键设计

### 内置供应商 = 主进程中转代理

服务端中转站鉴权依赖登录凭证（长期 API Key），凭证只存在于主进程 `AuthService`（safeStorage 落盘），**渲染层不可达**。因此内置供应商的请求统一走主进程 relay IPC：

```
渲染层 modules/ai ── window.preload.relay ── main RelayService ── mistrelle-server /v1/*
                    (无凭证)                  (注入 Bearer apiKey)
```

- **listModels**：`GET {server}/v1/models`（Bearer apiKey），返回 OpenAI list 形状模型列表。
- **chatStream**：`POST {server}/v1/chat/completions`（Bearer apiKey + 透传 `session_id`），服务端按积分记账、代理到 new-api 单上游；流式 SSE 字节经 `onChunk` 回调回传，协议解析仍在渲染层（复用 chat 适配器）。

### 文件结构

| 文件 | 角色 |
|---|---|
| `src/main/src/auth/AuthService.ts` | 新增导出 `getRelayContext()`：返回 `{ baseUrl, apiKey } | null`（无凭证 null；仅主进程内部使用） |
| `src/main/src/auth/RelayService.ts` | `listModels()` / `chatStream()`（axios stream + AbortSignal 取消） |
| `src/main/src/ipc/relayIpc.ts` | `relay:listModels` / `relay:chatStream` / `relay:abortStream`；流式 start/chunk/end 经 `webContents.send` 回推（handlers 不进 invoke） |
| `src/preload/src/ipc/relayChannels.ts` | 通道常量 + `RelayChatParams` / `RelayStreamHandlers` / `RelayStreamEndPayload` |
| `src/preload/src/ipc/relay.ts` | preload 桥 `window.preload.relay.{listModels, chatStream, streamAbort}`；invoke 只传可克隆参数，本地调 handlers |
| `src/renderer/src/modules/ai/service.ts` | `listRelayModels()` + `createRelayChatStream()`（内置对话流，复用 `chatAdapter` + `SseParser`） |
| `src/renderer/src/store/setting/SettingAiStore.ts` | 内置 provider 注入 / 门控过滤 / `refreshBuiltinModels` |
| `src/renderer/src/pages/setting/ai/SettingAi.vue` | 内置只读面板 + 刷新按钮 + 登录守卫 |
| `src/renderer/src/pages/setting/ai/components/SettingAiSidebar.vue` | 两组渲染 + 添加按钮移位 |

## Store 契约（SettingAiStore 变更）

- `BUILTIN_PROVIDER_ID = 'builtin'`：内置供应商固定 id；`init()` 注入 items 首项（`builtin: true`、`enable: true`、`baseUrl: 'builtin://relay'` 占位、`key: ''`）。
- **内置不落盘**：`ModelService.modelSave` 落盘前过滤 `item.builtin`，`model.json` 只存用户自定义（防污染 + 防旧版读取异常）。
- `visibleItems`：门控过滤后的对外列表——免费档（`!relayEnabled`）只含内置；付费档含全部。`options` / `vectorOptions` / `imageOptions` / `optionMap` 全部基于 `visibleItems` 派生（免费档 options 只含内置模型 = 启用项自动切回内置）。
- `relayEnabled` = `useAuthStore().features.thirdPartyRelay`（未登录/unknown 折叠为 false）。
- `refreshBuiltinModels()`：登录后调用 `listRelayModels()` 更新内置 provider.models；`init()` 及订阅 `auth:changed`（登录/登出/刷新）后自动同步（signed-in 才拉，guest 清空）。
- `AiProvideOption` 增加 `builtin?: boolean`（请求链路分流依据）。

## 请求链路分流

- `AiRequestParams` 增加 `builtin?: boolean` 与 `sessionId?: string`。
- `createChatStream` 内部按 `params.builtin` 分流：为真 → `createRelayChatStream`（主进程中转），否则直连 baseURL。`createChatCompletion`（内部调 `createChatStream`）自动覆盖，因此 **MemoryService / UseChatName 等短任务消费点只需透传 `option.builtin`**，无需各自分流。
- `ChatCommon.ts` `ResolvedChatRequestParams` 增加 `builtin?: boolean` 与 `sessionId?: string`。
- `AgentChat.resolveModel`：optionMap 命中内置 → 返回 `builtin: true` + `sessionId: this.chatId`；`agentStream.ts` 把二者透传给 `createChatStream`（分流已在 service 内部）。

## 登录守卫

| 入口 | 行为 |
|---|---|
| `AiModelSelect.vue` `handleModelSetting` | signed-in → 直接跳 `/setting/ai`；unknown → 先 `authStore.refresh()` 再判；guest → `MessageUtil.warning('请先登录后使用模型设置')` + `openLogin(() => router.push('/setting/ai'))`（登录成功回设置页） |
| `SettingAi.vue` `onMounted` | 同上判定；guest 提示登录 + `openLogin()`（已在本页，无需回调）；unknown 先 refresh |

`openLogin`（`components/modals/LoginDialog.tsx`）新增可选 `onSuccess` 回调（登录成功后关闭弹窗并执行回调），缺省仅关闭。

## 注意事项

- 内置供应商模型列表来自服务端 `/v1/models`（仅需登录即有 apiKey），未登录时内置模型为空并提示「登录后可获取」。
- 内置供应商的模型开关恒开（disabled），模型由服务端统一管理；「从接口获取模型」「添加模型」「编辑/删除模型」对内置不适用。
- `session_id`：内置对话流透传当前 chatId（服务端用量统计）；缺省服务端回退 user / 用户 id。
- 免费档判定走 `features.thirdPartyRelay`（AuthStore 已把未登录/unknown 折叠为 false），页面不直接判 `status`；登录态判定（守卫用）走 `authStore.status === 'signed-in'`。
- `SettingAiStore` 引 `useAuthStore` 直连 `@/store/AuthStore`（经 `@/store` index 可能成环，与 DesignStyleStore 先例一致）。
- relay 流式 IPC **不能**照抄 `aiStream`：`aiStream` 的 HTTP 跑在 preload 同进程，handlers 可直接调用；relay 必须在 main 注入凭证。把 `onStart`/`onChunk` 塞进 `ipcRenderer.invoke` 会触发 structured clone 失败（`An object could not be cloned`）。正确做法：invoke 只传 `params` + `requestId`，main 经 `relay:chatStreamStart` / `Chunk` / `End` 事件回推，preload 本地调 handlers。取消仍走 `streamAbort(requestId)`（requestId 经 onStart 回传）。结束以 `End` 事件为准，避免 invoke 回包赶超最后几个 chunk。
