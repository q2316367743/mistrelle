# 01 · 服务端账号接入（better-auth）

## 背景

对接本地 mistrelle-server（Elysia + better-auth 1.7.2，默认 `http://127.0.0.1:3000`，生产 `https://mistrelle.esion.xyz` 暂定），为桌面端提供登录/注册/登出与云端账号信息（会员档位/积分余额）。**客户端与共享状态全部在主进程实现**（`AuthService` 单例），多个页面（AppSide 用户菜单、账户设置页）经 preload 薄桥 + 状态推送共享，渲染层不直接发认证请求。

## 凭证策略：API Key + 会话双存

- 服务端会话默认 30 天过期，不适合桌面端频繁续期 → 登录成功后自动创建**长期 API Key**（`POST /auth/api/api-key/create`），业务请求一律 `Authorization: Bearer <apiKey>`，永久有效无需每月重登。
- 同时保留**会话 token**（响应体 `token` 字段，无需解析 Set-Cookie），用于登出时服务端注销会话与删除 key。
- 两者整文件 **safeStorage 加密**落盘 `~/.mistrelle/setting/auth.json`（不可用时降级明文，与 account.json 先例一致），结构：

```ts
interface StoredCredential {
  apiKey: string        // 业务请求 Bearer
  sessionToken: string  // 会话 token（仅作回退/信息保存）
  sessionCookie: string | null  // 签名会话 Cookie（better-auth.session_token=<signed>），会话端点鉴权用
  keyId: string         // 创建 API Key 时返回的 id
  email: string
}
```

- 换绑：再次登录时先保存新 key，再尽力回收旧 key（`api-key/delete`），避免长期 key 堆积。

## 会话端点只认签名 Cookie（关键）

better-auth 1.7.2 的 **会话类端点**（`api-key/create|delete`、`sign-out`、`get-session`）内部走 `getSessionFromCtx` → `get-session` 路由，该路由**只从签名 Cookie**（`ctx.getSignedCookie('better-auth.session_token')`）读取会话，`Authorization: Bearer <sessionToken>` 不生效（会 401 `Unauthorized or invalid session`）。

因此客户端：
1. 登录/注册成功后**捕获响应 `Set-Cookie` 中的 `better-auth.session_token=<signed>` 原样回放**（无需知道 secret，不自己签名）；
2. 携带 Cookie 的请求必须同时带 `Origin: <baseUrl>`（触发 better-auth origin 校验时与 trustedOrigins/root origin 匹配）；
3. Bearer 仅作 Cookie 缺失（旧凭证）时的回退。

> 历史教训（已修复）：服务端 `drizzleAdapter` 的 schema 键名必须与 better-auth 插件模型名**完全一致**——apiKey 插件按小写 `"apikey"` 查找表，键写成 `apiKey:` 会让 `api-key/create|list` 与 `verifyApiKey` 全部抛 BetterAuthError（HTTP 500 空体）。客户端报错若停在 `POST /auth/api/api-key/create` 的 500，先查服务端这一处。
> 另一踩坑：apiKey 插件默认 `rateLimit` 10 次/天，桌面 agent 的业务请求每次都过 `verifyApiKey`，超限后返回无效 → 业务 401 → 客户端误判凭证失效清凭证登出（现象：刷新按钮点完直接登出）。已服务端 `apiKey({ rateLimit: { enabled: false } })` 关闭；客户端不可传 `rateLimitEnabled`（`SERVER_ONLY_PROPERTY` 会 400 拒绝）。

## CSRF 规避（关键）

better-auth 的 origin-check/formCsrf 中间件只对**携带 Cookie / Origin / Referer / Sec-Fetch-*** 的请求校验：**业务请求**（`/api/user/*` 等）一律 `Authorization: Bearer <apiKey>`，不携带 Cookie → 天然跳过校验；仅**会话端点**（api-key/sign-out）回放签名 Cookie，此时必须同带 `Origin`（见上节）。

## 请求契约

- 服务端地址：`http://127.0.0.1:3000`（dev）/ `https://mistrelle.esion.xyz`（prod，`app.isPackaged` 判定），可用环境变量 `MISTRELLE_SERVER_URL` 覆盖。
- better-auth 端点直出 JSON；业务端点统一 `{ success, code, msg, data }`（code=0 成功；401 未登录、403 非管理员、429 积分不足）。
- better-auth 错误体为**顶层** `{ message, code }`（如 401 `{ message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' }`），客户端按 code 映射中文文案（`INVALID_EMAIL_OR_PASSWORD`→「邮箱或密码错误」、`USER_ALREADY_EXISTS`→「该邮箱已注册」等）；兼容嵌套 `{ error: {...} }` 与业务 `{ success, code, msg }`。
- `POST /auth/api/sign-in/email`、`/sign-up/email`（注册即登录）：响应 `{ redirect, token, user }`（sign-up 的 token 可能为 null）。
- `POST /auth/api/update-user`（会话）：body `{ name? }`，改用户名后客户端 `refresh()` 广播。
- `POST /auth/api/change-password`（会话）：body `{ currentPassword, newPassword }`（不传 `revokeOtherSessions`，当前会话保持有效、不轮换 token）。
- `GET /api/tiers/`（**公开，无需登录**）→ 启用中的档位列表 `{ code, name, category, level, basePoints, dailyGiftPoints, price, thirdPartyRelay, customFonts, extendedDesignStyles, ... }`，通道 `auth:tiers` 供会员档位卡片展示（价格元/月、能力打勾列表、免费档不打勾）。
- `GET /api/user/me` → `{ id, name, email, isAdmin, tier, membership, features: AuthFeatures, dailyGiftPoints }`（features 归一为三键布尔，见 [02-activation-and-features.md](./02-activation-and-features.md)）。
- `GET /api/user/balance` → `{ pointsGift, pointsTotal, pointsPaid, giftQuota, giftResetDate, total }`。
- `POST /api/user/activation-codes/verify|redeem`（Bearer）：激活码验证 / 兑换，链路与门控见 [02-activation-and-features.md](./02-activation-and-features.md)。

## 状态机与广播

```ts
type AuthStatus = 'unknown' | 'guest' | 'signed-in'
// unknown：启动中 / 服务端不可达（不销毁本地凭证，等待重试）
// guest：未登录或凭证 401 失效（已清除本地凭证）
// signed-in：已登录（user + balance 缓存）
```

- `init()`（app ready 后调用，非阻塞）：读本地凭证 → Bearer 调 `/api/user/me` 校验 → 广播状态；401 → 清凭证置 guest；网络失败 → 保持 unknown。
- 每次状态变更 `setAndBroadcast()` → `BrowserWindow.getAllWindows()` 逐窗 `webContents.send('auth:changed', state)`。
- 变更类 IPC（signIn/signUp/signOut）返回 `AuthActionResult = { ok: true } | { ok: false; msg }`，**不抛跨进程包装异常**；失败 msg 由渲染层 MessageUtil 直接展示。

## 关键文件

| 层 | 文件 | 职责 |
|---|---|---|
| main 服务 | `src/main/src/auth/AuthService.ts` | 单例状态、HTTP 客户端（axios）、凭证持久化、signIn/signUp/signOut/refresh/init |
| 通道契约 | `src/preload/src/ipc/authChannels.ts` | `auth:*` 通道 + 载荷/返回类型（main 与 preload 共用） |
| main IPC | `src/main/src/ipc/authIpc.ts` | 通道透传（`registerIpc.ts` 注册 + `index.ts` 挂 init） |
| preload 桥 | `src/preload/src/ipc/auth.ts` | `window.preload.auth.*` 薄桥 + `onChanged` 订阅 |
| 渲染 store | `src/renderer/src/store/AuthStore.ts` | 拉取快照 + 订阅推送，跨页共享 |
| 登录弹窗 | `src/renderer/src/components/modals/LoginDialog.tsx` + `LoginContent.vue` | DialogPlugin 命令式弹窗（登录/注册页签），AGENTS.md 拆壳约定 |
| 页面接入 | `AppSide.vue`、`pages/setting/account/`（见 [06-account-page.md](../setting/06-account-page.md)）、`pages/setting/account/modals/` | 用户菜单（登录入口/登出/服务端昵称，「未登录」态展示）；账户页为身份主视觉 + 账户与安全设置行 + 第三方密钥，弹窗仍为 EditName / ChangePassword / MemberTier / RedeemCode（命令式） |

## 未登录展示（参考 workbuddy）

- AppSide 左下角用户菜单：未登录显示「未登录」（通用图标），已登录显示服务端昵称/邮箱。
- 本地用户名/头像设置已**整体移除**（`SettingAccount` 实体删除 `avatar`/`nickname`，账户页「用户名」项删除）——登录后昵称以服务端账号为准，无本地回退。
- 账户页未登录态：身份区提示登录后可查看积分；「会员档位」打开公开档位列表（`auth:tiers`）。积分数字仅已登录且 `balance` 有值时展示。

## 注意事项

- **服务端挂载点**：better-auth 挂载于 `/auth/api`（openapi 文档中的 `/auth/api/*` 即真实路径），验证：
  `curl --noproxy '*' http://127.0.0.1:3000/auth/api/ok` 应返回 200 `{"ok":true}`。
  客户端对 auth 端点的空体 404 会提示检查挂载点 / `BETTER_AUTH_URL` 配置（此前 `/api/auth` 挂载曾因 `BETTER_AUTH_URL` 带路径致空体 404，判别特征：双剥前缀 `/api/auth/api/auth/...` 命中而正常路径 404 空体）。
- 登出为「尽力而为」：服务端注销/删 key 失败不阻塞本地清除（只 warn），用户仍视为已登出。
- 刷新遇临时网络故障且当前已登录：保留旧展示，不误清凭证（仅 401 才清）。
- 渲染层不再使用 `NativeUtil.getUserProfile` stub（从未被调用，可忽略）。
- 后续业务对接（如 /v1/chat/completions、usage）直接复用 `AuthService.current()` 的凭证走主进程，勿在渲染层重建客户端。
- `authChannels.ts` 独立于 `channels.ts`（500 行红线），新增通道只改本域文件。