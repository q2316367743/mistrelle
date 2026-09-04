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
1. 登录/注册成功后**捕获响应 `Set-Cookie` 中的签名会话 Cookie 原样回放**（无需知道 secret，不自己签名）；
   **Cookie 名随环境前缀不同**：本地 http 为 `better-auth.session_token=`，生产 https 为 `__Secure-better-auth.session_token=`
   （better-auth 1.7 在 https 下自动加 `__Secure-` 前缀并带 `Secure` 属性）。`extractSessionCookie()` 需按
   `.session_token=` 后缀兼容两代名称，否则解析为 null → 回退 Bearer → 会话端点 401 `Unauthorized or invalid session`。
2. 携带 Cookie 的请求必须同时带 `Origin: <baseUrl>`（触发 better-auth origin 校验时与 trustedOrigins/root origin 匹配）；
3. Bearer 仅作 Cookie 缺失（旧凭证）时的回退。

> **Origin 白名单依赖服务端配置（踩坑记录）**：better-auth 的 origin 校验要求回放的 `Origin` 落在服务端
> `trustedOrigins` 内（`BETTER_AUTH_URL` 会被自动列入）。服务端必须把对外域名配成
> `BETTER_AUTH_URL=https://mistrelle.esion.xyz`（无 path），否则桌面端无论回放 `http/https://mistrelle.esion.xyz`
> 都会在 `POST /auth/api/api-key/create` 处 403 `Invalid origin`（现象：注册/登录已成功、卡在创建长期 API Key）。
> 已服务端 `trustedOrigins: [env.betterAuthUrl]` 显式声明。客户端侧的 `Origin` 必须与服务端配置逐字符一致
> （由 `baseUrl()` 保证，见下节地址还原）。

> 历史教训（已修复）：服务端 `drizzleAdapter` 的 schema 键名必须与 better-auth 插件模型名**完全一致**——apiKey 插件按小写 `"apikey"` 查找表，键写成 `apiKey:` 会让 `api-key/create|list` 与 `verifyApiKey` 全部抛 BetterAuthError（HTTP 500 空体）。客户端报错若停在 `POST /auth/api/api-key/create` 的 500，先查服务端这一处。
> 另一踩坑：apiKey 插件默认 `rateLimit` 10 次/天，桌面 agent 的业务请求每次都过 `verifyApiKey`，超限后返回无效 → 业务 401 → 客户端误判凭证失效清凭证登出（现象：刷新按钮点完直接登出）。已服务端 `apiKey({ rateLimit: { enabled: false } })` 关闭；客户端不可传 `rateLimitEnabled`（`SERVER_ONLY_PROPERTY` 会 400 拒绝）。

## CSRF 规避（关键）

better-auth 的 origin-check/formCsrf 中间件只对**携带 Cookie / Origin / Referer / Sec-Fetch-*** 的请求校验：**业务请求**（`/api/user/*` 等）一律 `Authorization: Bearer <apiKey>`，不携带 Cookie → 天然跳过校验；仅**会话端点**（api-key/sign-out）回放签名 Cookie，此时必须同带 `Origin`（见上节）。

## 请求契约

- 服务端地址：`http://127.0.0.1:3000`（dev）/ `https://mistrelle.esion.xyz`（prod，`app.isPackaged` 判定），可用环境变量 `MISTRELLE_SERVER_URL` 覆盖。**调试勿将 PROD 改成裸 `http://`**——会明文传输 API Key，且调试残留曾致本地 dev 误连生产。
- better-auth 端点直出 JSON；业务端点统一 `{ success, code, msg, data }`（code=0 成功；401 未登录、403 非管理员、429 积分不足）。
- better-auth 错误体为**顶层** `{ message, code }`（如 401 `{ message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' }`），客户端按 code 映射中文文案（`INVALID_EMAIL_OR_PASSWORD`→「邮箱或密码错误」、`USER_ALREADY_EXISTS`→「该邮箱已注册」等）；兼容嵌套 `{ error: {...} }` 与业务 `{ success, code, msg }`。
- `POST /auth/api/sign-in/email`、`/sign-up/email`（注册即登录）：响应 `{ redirect, token, user }`（sign-up 的 token 可能为 null）。
- **强邮箱认证（关键）**：服务端 `emailAndPassword.requireEmailVerification: true` + `emailVerification`。未验证账号**一律无法建会话/登录**——sign-in 被拒 `403 EMAIL_NOT_VERIFIED`；sign-up 正常 2xx 但 `token: null`（不建会话），并自动发送验证邮件；业务 guard（`requireAuth`）二次兜底，未验证即使绕过也会 401。因此**客户端不存在「已登录但未验证」态**，`/me` 无需也不该返回 `emailVerified`（恒为 true）。
  - 验证邮件 callbackURL 强制指向服务端落地页 `/auth/verify`（`GET`，无 error 参数=认证成功、带 `?error=<code>`=失败中文提示），登录/注册后可引导用户自查该页结果。
  - `POST /auth/resend-verification`（**公开，无需登录**）body `{ email }` → 恒 `{ success: true, data: { sent: true } }`（防枚举，邮箱不存在/已认证也返回成功）；同邮箱 60s 冷却（进程内）。客户端通道 `auth:resendVerification`，主进程 `resendVerificationEmail(email)` 用登录框传入的邮箱调用（未验证用户无本地凭证，勿用 StoredCredential.email）。
  - `signIn/signUp` 返回 `AuthSignResult = { ok:true } | { ok:false; msg; needEmailVerify? }`；渲染层 `LoginContent` 命中 `needEmailVerify` → 关闭登录框 + `openVerifyEmail(email)` 弹框（`components/modals/VerifyEmailDialog` + `VerifyEmailContent.vue`，见下「邮箱未验证引导」）。
- `POST /auth/api/update-user`（会话）：body `{ name? }`，改用户名后客户端 `refresh()` 广播。
- `POST /auth/api/change-password`（会话）：body `{ currentPassword, newPassword }`（不传 `revokeOtherSessions`，当前会话保持有效、不轮换 token）。
- `GET /api/tiers/`（**公开，无需登录**）→ 启用中的档位列表，通道 `auth:tiers`。
- `GET /api/points-packs/`（**公开，无需登录**）→ `{ items }`，通道 `auth:pointsPacks`。SKU 可无限次买，每笔 30 天到期清零，无结转。
- `GET /api/user/me` → `{ id, name, email, isAdmin, tier, membership, features: AuthFeatures, dailyGiftPoints }`（features 归一为三键布尔，见 [02-activation-and-features.md](./02-activation-and-features.md)）。
- `GET /api/user/balance` → `{ pointsGift, pointsPaid, pointsPack, giftQuota, total }`（未过期账本剩余合计；登录时发放当日赠送）。
- `GET /api/user/pack-lots` → `{ remaining, items }`，增量包各笔剩余与到期日。
- `GET /api/user/transactions?page&pageSize`（Bearer）→ `{ total, page, pageSize, items }`；流水含 `gift_grant` / `pack_grant` / `expire`。
- `POST /api/user/activation-codes/verify|redeem`（Bearer）：激活码验证 / 兑换（会员档位或积分增量包），链路与门控见 [02-activation-and-features.md](./02-activation-and-features.md)。

## 状态机与广播

```ts
type AuthStatus = 'unknown' | 'guest' | 'signed-in'
// unknown：启动中 / 服务端不可达（不销毁本地凭证，等待重试）
// guest：未登录或凭证 401 失效（已清除本地凭证）
// signed-in：已登录（user + balance 缓存）
```

- `init()`（app ready 后调用，非阻塞）：读本地凭证 → Bearer 调 `/api/user/me` 校验 → 广播状态；401 → 清凭证置 guest；网络失败 → 保持 unknown。
- 每次状态变更 `setAndBroadcast()` → `BrowserWindow.getAllWindows()` 逐窗 `webContents.send('auth:changed', state)`。
- 变更类 IPC（signIn/signUp/signOut）返回 `AuthActionResult = { ok: true } | { ok: false; msg }`，**不抛跨进程包装异常**；失败 msg 由渲染层 MessageUtil 直接展示。signIn/signUp 特殊返回 `AuthSignResult`（带可选 `needEmailVerify`，见上契约节），不再吞错统一弹 toast，由 `LoginContent` 分支处理。

## 邮箱未验证引导

- 触发：仅登录/注册提交后（`LoginContent`）命中 `needEmailVerify`——覆盖「未验证登录被拒 403」与「注册/重复注册返回 token:null」两种路径。不做全局轮询（未验证账号建不了会话，登录成功即已验证，无「登录后仍需验证」场景）。
- 弹框：`VerifyEmailDialog.tsx`（`DialogPlugin` 外壳）+ `VerifyEmailContent.vue`（内容）。文案提示验证邮件已发送至该邮箱；根据邮箱域名推断提供商（`utils/mailProvider.ts`：知名域名枚举 + 未知域兜底 `https://mail.<domain>`）展示「前往 XX 邮箱」按钮 → `shell.openExternal`；「重新发送验证邮件」按钮调 `auth:resendVerification`，成功后本地 60s 倒计时禁用（与服务端冷却一致）。
- 邮箱域名映射是渲染层纯函数（`mailProviderOf(email) → { name, url } | null`），未知邮箱直接隐藏入口，不保证兜底地址真实存在（只是尽力引导）。

## 关键文件

| 层 | 文件 | 职责 |
|---|---|---|
| main 服务 | `src/main/src/modules/auth/AuthService.ts` | 单例状态、HTTP 客户端（axios）、凭证持久化、signIn/signUp（返回 `AuthSignResult` 判 needEmailVerify）/resendVerificationEmail/signOut/refresh/init |
| 通道契约 | `src/preload/src/modules/auth/authChannels.ts` | `auth:*` 通道 + 载荷/返回类型（main 与 preload 共用） |
| main IPC | `src/main/src/modules/auth/authIpc.ts` | 通道透传（`registerIpc.ts` 注册 + `index.ts` 挂 init） |
| preload 桥 | `src/preload/src/modules/auth/auth.ts` | `window.preload.auth.*` 薄桥 + `onChanged` 订阅 |
| 渲染 store | `src/renderer/src/windows/main/store/AuthStore.ts` | 拉取快照 + 订阅推送，跨页共享（`types/auth.d.ts` 镜像契约需同步） |
| 登录弹窗 | `src/renderer/src/components/modals/LoginDialog.tsx` + `LoginContent.vue` | DialogPlugin 命令式弹窗（登录/注册页签），AGENTS.md 拆壳约定 |
| 邮箱验证引导 | `src/renderer/src/components/modals/VerifyEmailDialog.tsx` + `VerifyEmailContent.vue` | 邮箱未验证弹框：前往提供商邮箱（外链）+ 重发验证邮件（60s 倒计时） |
| 邮箱域名推断 | `src/renderer/src/utils/mailProvider.ts` | `mailProviderOf(email)`：知名域枚举 + `mail.<domain>` 兜底 |
| 页面接入 | `AppSide.vue`、`pages/setting/account/`（见 [06-account-page.md](../setting/06-account-page.md)）、`pages/setting/account/modals/` | 用户菜单；账户页身份主视觉 + 账户与安全 + 第三方密钥；积分流水抽屉（`PointsLedgerDrawer`）；弹窗仍为 EditName / ChangePassword / MemberTier / RedeemCode |

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