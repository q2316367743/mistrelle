/**
 * 服务端账号服务（main 进程单例）：对接本地 mistrelle-server（better-auth）。
 *
 * 职责：登录/注册/登出、长期 API Key 凭证管理、用户资料与积分余额缓存、状态变更广播。
 * 设计要点（详见 docs/auth/01-server-auth.md）：
 * - 所有请求一律走 `Authorization: Bearer <token>`，不携带 Cookie/Origin/Referer，
 *   从而天然绕过 better-auth 的 CSRF/origin 校验，也无需 Cookie 管理。
 * - 凭证双存：长期 API Key（业务请求）+ 会话 token（登出时服务端注销/删 key），
 *   整文件 safeStorage 加密落盘 `~/.mistrelle/setting/auth.json`。
 * - 状态为模块级单例，所有窗口共享；变更经 BrowserWindow 广播 `auth:changed`。
 */
import { app, BrowserWindow, safeStorage } from 'electron'
import axios from 'axios'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  AuthChannels,
  normalizeAuthFeatures,
  type AuthActionResult,
  type AuthBalance,
  type AuthCodeActionResult,
  type AuthCodeParams,
  type AuthCodeRedeemResult,
  type AuthCodeVerifyResult,
  type AuthDataResult,
  type AuthPageParams,
  type AuthPaged,
  type AuthPointsTransaction,
  type AuthState,
  type AuthTierInfo,
  type AuthSignInParams,
  type AuthSignUpParams,
  type AuthUser
} from '~/ipc/authChannels'

/** 服务端地址：dev 本地服务，生产远端服务；可用 MISTRELLE_SERVER_URL 覆盖 */
const DEV_SERVER_URL = 'http://127.0.0.1:3000'
const PROD_SERVER_URL = 'https://mistrelle.esion.xyz'

/** better-auth 错误码 → 中文文案（其余错误原样透传服务端 message） */
const BA_CODE_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: '邮箱或密码错误',
  USER_ALREADY_EXISTS: '该邮箱已注册，请直接登录',
  INVALID_EMAIL: '邮箱格式不正确',
  INVALID_PASSWORD: '密码不符合要求',
  FAILED_TO_CREATE_SESSION: '登录失败，请稍后重试'
}

/** API Key 名称（创建时传入，便于服务端区分来源） */
const API_KEY_NAME = 'mistrelle-desktop'

/** better-auth 挂载基点（服务端以 /auth/api 挂载并剥离前缀，见 openapi /auth/api/*） */
const AUTH_BASE = '/auth/api'

/** 本地持久化凭证：长期 API Key + 会话 + 关联邮箱 */
interface StoredCredential {
  apiKey: string
  /** 会话 token（better-auth 1.7.2 会话端点只认签名 Cookie，此字段仅作回退/信息保存） */
  sessionToken: string
  /** 签名会话 Cookie（better-auth.session_token=<signed>，登录响应原样捕获，回放给 api-key/sign-out 端点） */
  sessionCookie: string | null
  keyId: string
  email: string
}

/** 服务端请求失败（status=0 表示网络层失败，未收到 HTTP 响应） */
class AuthFailure extends Error {
  status: number

  constructor(msg: string, status = 0) {
    super(msg)
    this.status = status
  }
}

/** K/V 请求（better-auth 端点直出 JSON）Blob 之外的响应体统一按 JSON 解析 */
const http = axios.create({
  timeout: 15_000,
  validateStatus: () => true
})

function baseUrl(): string {
  const override = process.env.MISTRELLE_SERVER_URL?.trim()
  if (override) return override.replace(/\/+$/, '')
  return app.isPackaged ? PROD_SERVER_URL : DEV_SERVER_URL
}

// ── 本地凭证持久化（整文件 safeStorage 加密；不可用时降级明文，与 account.json 先例一致） ──

function authFilePath(): string {
  return join(app.getPath('home'), '.mistrelle', 'setting', 'auth.json')
}

function loadCredential(): StoredCredential | null {
  const file = authFilePath()
  if (!existsSync(file)) return null
  try {
    const text = readFileSync(file, 'utf-8')
    const plain =
      (safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(text, 'base64')) : null) ?? text
    const parsed = JSON.parse(plain) as StoredCredential
    if (typeof parsed.apiKey !== 'string' || !parsed.apiKey) return null
    return {
      ...parsed,
      sessionCookie: typeof parsed.sessionCookie === 'string' ? parsed.sessionCookie : null
    }
  } catch {
    return null
  }
}

function saveCredential(cred: StoredCredential): void {
  const file = authFilePath()
  mkdirSync(dirname(file), { recursive: true })
  const json = JSON.stringify(cred)
  const out = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json).toString('base64')
    : json
  writeFileSync(file, out, 'utf-8')
}

function clearCredential(): void {
  const file = authFilePath()
  if (existsSync(file)) rmSync(file)
}

// ── HTTP 请求 ──

/** 底层请求：放行全部状态码并透出 Set-Cookie（api-key/sign-out 等会话端点需原样回放签名 Cookie） */
async function rawRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; token?: string; headers?: Record<string, string> } = {}
): Promise<{ status: number; data: T; setCookies: string[] }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  let response
  try {
    response = await http.request<T>({
      method,
      baseURL: baseUrl(),
      url: path,
      data: options.body,
      headers
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : '未知网络错误'
    throw new AuthFailure(`无法连接服务端（${reason}）`)
  }
  return {
    status: response.status,
    data: response.data,
    setCookies: response.headers['set-cookie'] ?? []
  }
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; token?: string; headers?: Record<string, string> } = {}
): Promise<T> {
  const res = await rawRequest<T>(method, path, options)
  if (res.status >= 200 && res.status < 300) return res.data
  throw new AuthFailure(extractErrorMsg(res.status, res.data, method, path), res.status)
}

/** 业务端点（/api/*）统一 Result 包装：{ success, code, msg, data } */
async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await request<{ success: boolean; code: number; msg: string; data: T }>('GET', path, {
    token
  })
  if (!res.success) throw new AuthFailure(res.msg || '请求失败', res.code)
  return res.data
}

async function apiPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await request<{ success: boolean; code: number; msg: string; data: T }>(
    'POST',
    path,
    { body, token }
  )
  if (!res.success) throw new AuthFailure(res.msg || '请求失败', res.code)
  return res.data
}

function extractErrorMsg(status: number, body: unknown, method: string, path: string): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    // better-auth 错误体为顶层 { message, code }（如签名登录失败），code 优先映射中文
    if (typeof record.code === 'string' && BA_CODE_MESSAGES[record.code]) {
      return BA_CODE_MESSAGES[record.code]
    }
    if (typeof record.message === 'string') return record.message
    // 兼容嵌套形态 { error: { message, code } }
    const err = record.error
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>
      if (typeof e.code === 'string' && BA_CODE_MESSAGES[e.code]) return BA_CODE_MESSAGES[e.code]
      if (typeof e.message === 'string') return e.message
    }
    // 业务错误：{ success, code, msg }
    if (typeof record.msg === 'string') return record.msg
  }
  // 空响应体的 auth 404 多为服务端挂载/环境配置问题（BETTER_AUTH_URL 带路径等）
  if (status === 404 && path.startsWith(`${AUTH_BASE}/`)) {
    return '认证接口不可用（HTTP 404）：请检查服务端 better-auth 挂载点与 BETTER_AUTH_URL 配置'
  }
  return `请求失败（HTTP ${status}）：${method} ${path}`
}

// ── 共享状态 ──

let state: AuthState = { status: 'unknown', user: null, balance: null }

function setAndBroadcast(next: AuthState): void {
  state = next
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(AuthChannels.changed, next)
  }
}

/** 当前状态（渲染层 getState 与广播推送共用同一快照） */
export function current(): AuthState {
  return state
}

/**
 * 中转上下文（内置供应商 = 服务端 OpenAI 兼容中转站 /v1/*）。
 * 返回当前登录凭证与服务端地址；未登录返回 null。
 * 仅供主进程 RelayService 使用，凭证绝不下发渲染层。
 */
export function getRelayContext(): { baseUrl: string; apiKey: string } | null {
  const cred = loadCredential()
  if (!cred) return null
  return { baseUrl: baseUrl(), apiKey: cred.apiKey }
}

/** app ready 后调用一次：读取本地凭证并校验，非阻塞（失败不阻塞启动） */
let initializing: Promise<void> | null = null
export function init(): Promise<void> {
  if (!initializing) initializing = refresh().then(() => undefined).catch((error) => {
    console.error('[auth] init 失败', error)
  })
  return initializing
}

/** 刷新用户资料与余额：有本地凭证则校验（401 清除凭证回落游客），无凭证置游客 */
export async function refresh(): Promise<AuthState> {
  const cred = loadCredential()
  if (!cred) {
    setAndBroadcast({ status: 'guest', user: null, balance: null })
    return state
  }
  try {
    const [user, balance] = await Promise.all([fetchMe(cred.apiKey), fetchBalance(cred.apiKey)])
    setAndBroadcast({ status: 'signed-in', user, balance })
  } catch (error) {
    if (error instanceof AuthFailure && error.status === 401) {
      // 凭证失效：清除本地并回落游客
      clearCredential()
      setAndBroadcast({ status: 'guest', user: null, balance: null })
    } else if (state.status === 'signed-in') {
      // 临时网络故障：保留已登录展示，下次操作重试
      console.warn('[auth] 刷新失败，保留当前状态', error)
    } else {
      // 启动即不可达：保持 unknown，等待用户手动重试
      setAndBroadcast({ status: 'unknown', user: null, balance: null })
    }
  }
  return state
}

// ── 登录 / 注册 / 登出 ──

/** 公开档位列表（无需登录；账户卡片未登录态展示额度） */
export async function tiers(): Promise<AuthTierInfo[]> {
  const res = await request<{ success: boolean; code: number; msg: string; data: AuthTierInfo[] }>(
    'GET',
    '/api/tiers/'
  )
  if (!res.success) throw new AuthFailure(res.msg || '获取档位失败', res.code)
  return Array.isArray(res.data) ? res.data : []
}

/** 邮箱密码登录：登录取会话 → 创建长期 API Key → 双存凭证 → 刷新资料与余额 */
export async function signIn(params: AuthSignInParams): Promise<AuthActionResult> {
  try {
    const email = params.email.trim()
    const { token, sessionCookie } = await exchangeSession(`${AUTH_BASE}/sign-in/email`, {
      email,
      password: params.password,
      rememberMe: true
    })
    await provisionApiKey(token, sessionCookie, email)
    await refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** 邮箱密码注册（注册即登录）：同 signIn 的凭证落地链路 */
export async function signUp(params: AuthSignUpParams): Promise<AuthActionResult> {
  try {
    const email = params.email.trim()
    const { token, sessionCookie } = await exchangeSession(`${AUTH_BASE}/sign-up/email`, {
      name: params.name.trim(),
      email,
      password: params.password
    })
    await provisionApiKey(token, sessionCookie, email)
    await refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** 登出：服务端注销会话并删除长期 key（尽力而为），随后清除本地凭证回落游客 */
export async function signOut(): Promise<AuthActionResult> {
  const cred = loadCredential()
  if (cred) {
    const authHeaders = sessionAuthHeaders(cred.sessionToken, cred.sessionCookie)
    try {
      if (cred.keyId) {
        await request('POST', `${AUTH_BASE}/api-key/delete`, {
          body: { keyId: cred.keyId },
          headers: authHeaders
        })
      }
    } catch (error) {
      console.warn('[auth] 删除服务端 API Key 失败', error)
    }
    try {
      await request('POST', `${AUTH_BASE}/sign-out`, { body: {}, headers: authHeaders })
    } catch (error) {
      console.warn('[auth] 服务端会话注销失败', error)
    }
    clearCredential()
  }
  setAndBroadcast({ status: 'guest', user: null, balance: null })
  return { ok: true }
}

/** 修改用户名（会话端点，走签名 Cookie）；成功后刷新资料并广播 */
export async function updateUser(name: string): Promise<AuthActionResult> {
  const cred = loadCredential()
  if (!cred) return { ok: false, msg: '未登录' }
  try {
    await request('POST', `${AUTH_BASE}/update-user`, {
      body: { name },
      headers: sessionAuthHeaders(cred.sessionToken, cred.sessionCookie)
    })
    await refresh()
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** 修改密码：不轮换会话 token（revokeOtherSessions 缺省 false），当前会话保持有效 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthActionResult> {
  const cred = loadCredential()
  if (!cred) return { ok: false, msg: '未登录' }
  try {
    await request('POST', `${AUTH_BASE}/change-password`, {
      body: { currentPassword, newPassword },
      headers: sessionAuthHeaders(cred.sessionToken, cred.sessionCookie)
    })
    return { ok: true }
  } catch (error) {
    return fail(error)
  }
}

/** 验证激活码：只返回可激活内容（会员档位或积分包），不执行激活 */
export async function verifyActivationCode(
  params: AuthCodeParams
): Promise<AuthCodeActionResult<AuthCodeVerifyResult>> {
  const cred = loadCredential()
  if (!cred) return { ok: false, msg: '未登录' }
  try {
    const data = await apiPost<AuthCodeVerifyResult>(
      '/api/user/activation-codes/verify',
      { code: params.code.trim() },
      cred.apiKey
    )
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

/** 激活激活码：成功后刷新资料（tier/features/余额经 auth:changed 广播自动同步全部 UI） */
export async function redeemActivationCode(
  params: AuthCodeParams
): Promise<AuthCodeActionResult<AuthCodeRedeemResult>> {
  const cred = loadCredential()
  if (!cred) return { ok: false, msg: '未登录' }
  try {
    const data = await apiPost<AuthCodeRedeemResult>(
      '/api/user/activation-codes/redeem',
      { code: params.code.trim() },
      cred.apiKey
    )
    await refresh()
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

/** 积分流水分页（未登录返回错误，不抛跨进程异常） */
export async function listTransactions(
  params: AuthPageParams
): Promise<AuthDataResult<AuthPaged<AuthPointsTransaction>>> {
  const cred = loadCredential()
  if (!cred) return { ok: false, msg: '未登录' }
  try {
    const page = Math.max(1, Math.trunc(params.page || 1))
    const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize || 20)))
    const data = await apiGet<AuthPaged<AuthPointsTransaction>>(
      `/api/user/transactions?page=${page}&pageSize=${pageSize}`,
      cred.apiKey
    )
    return { ok: true, data }
  } catch (error) {
    return fail(error)
  }
}

// ── 服务端调用细节 ──

/** 登录/注册端点：成功返回会话 token + 签名会话 Cookie（后者供 api-key/sign-out 鉴权） */
interface AuthSessionResponse {
  token?: string | null
}

async function exchangeSession(
  path: string,
  body: Record<string, unknown>
): Promise<{ token: string; sessionCookie: string | null }> {
  const res = await rawRequest<AuthSessionResponse>('POST', path, { body })
  if (res.status >= 200 && res.status < 300) {
    const token = res.data?.token
    if (typeof token !== 'string' || !token) throw new AuthFailure('服务端未返回会话令牌')
    return { token, sessionCookie: extractSessionCookie(res.setCookies) }
  }
  throw new AuthFailure(extractErrorMsg(res.status, res.data, 'POST', path), res.status)
}

/** 从 Set-Cookie 中取出签名会话 Cookie（better-auth.session_token=<signed>），供原样回放 */
function extractSessionCookie(setCookies: string[]): string | null {
  for (const cookie of setCookies) {
    if (cookie.startsWith('better-auth.session_token=')) return cookie.split(';')[0]
  }
  return null
}

/**
 * 会话端点（api-key/sign-out）鉴权头：better-auth 1.7.2 的会话校验只认签名 Cookie，
 * Bearer 仅作 Cookie 缺失（旧凭证）时的回退；带 Cookie 时必须同带 Origin 通过 origin 校验。
 */
function sessionAuthHeaders(sessionToken: string, sessionCookie: string | null): Record<string, string> {
  return sessionCookie
    ? { Cookie: sessionCookie, Origin: baseUrl() }
    : { Authorization: `Bearer ${sessionToken}` }
}

/** 用会话创建长期 API Key 并双存凭证；换绑前尽力回收旧的长期 key */
async function provisionApiKey(
  sessionToken: string,
  sessionCookie: string | null,
  email: string
): Promise<void> {
  const existing = loadCredential()
  const res = await request<{ key: string; id: string }>('POST', `${AUTH_BASE}/api-key/create`, {
    body: { name: API_KEY_NAME },
    headers: sessionAuthHeaders(sessionToken, sessionCookie)
  })
  if (typeof res?.key !== 'string' || !res.key) throw new AuthFailure('创建 API Key 失败')
  saveCredential({
    apiKey: res.key,
    sessionToken,
    sessionCookie,
    keyId: typeof res.id === 'string' ? res.id : '',
    email
  })
  if (existing?.keyId) {
    try {
      await request('POST', `${AUTH_BASE}/api-key/delete`, {
        body: { keyId: existing.keyId },
        headers: sessionAuthHeaders(existing.sessionToken, existing.sessionCookie)
      })
    } catch (error) {
      console.warn('[auth] 回收旧 API Key 失败（忽略）', error)
    }
  }
}

async function fetchMe(apiKey: string): Promise<AuthUser> {
  const me = await apiGet<{
    id: string
    name: string
    email: string
    isAdmin: boolean
    tier: string | null
    membership: { tier: string; expiresAt: string | null } | null
    features: unknown
    dailyGiftPoints: number
  }>('/api/user/me', apiKey)
  return {
    id: me.id,
    name: me.name,
    email: me.email,
    isAdmin: me.isAdmin === true,
    tier: typeof me.tier === 'string' ? me.tier : null,
    membership: me.membership ?? null,
    features: normalizeAuthFeatures(me.features),
    dailyGiftPoints: typeof me.dailyGiftPoints === 'number' ? me.dailyGiftPoints : 0
  }
}

async function fetchBalance(apiKey: string): Promise<AuthBalance> {
  return apiGet<AuthBalance>('/api/user/balance', apiKey)
}

function fail(error: unknown): { ok: false; msg: string } {
  const msg = error instanceof Error ? error.message : '未知错误'
  console.error('[auth] 操作失败', msg)
  return { ok: false, msg }
}