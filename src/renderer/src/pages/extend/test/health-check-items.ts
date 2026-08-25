// ==========================================
//  可用性检测工具：12 个检测项定义与执行器（5 大维度）。
//  - 全部检测请求走 modules/ai 三格式适配器（chat / anthropic / responses），零协议重复。
//  - 共享观测降成本：latency 复用 connect、ttft 复用 stream、usage_sanity 复用 connect 的用量。
//  - 每请求 30s 超时（AbortSignal.any 组合任务停止信号）；connect 失败后 requiresConnect 项跳过。
// ==========================================
import { createChatCompletion, createChatStream, listAiModels } from '@/modules/ai'
import type { AiMessageParam, AiRequestParams, AiTool } from '@/modules/ai'

/** 单个检测请求的超时（ms） */
const REQUEST_TIMEOUT_MS = 30_000

export const HEALTH_DIMENSIONS = ['连通与速度', '模型真实性', '计费合规', '能力基线', '功能特性'] as const

/** 模型家族关键词映射（身份自述比对用；配置名与自述文本各自识别家族） */
const MODEL_FAMILIES: Array<{ family: string; keywords: string[] }> = [
  { family: 'OpenAI', keywords: ['gpt', 'openai', 'chatgpt', 'o1', 'o3', 'o4'] },
  { family: 'Anthropic', keywords: ['claude', 'anthropic'] },
  { family: 'DeepSeek', keywords: ['deepseek'] },
  { family: '通义千问', keywords: ['qwen', 'tongyi', '通义'] },
  { family: '智谱GLM', keywords: ['glm', 'chatglm', 'zhipu', '智谱'] },
  { family: 'Gemini', keywords: ['gemini', 'bard'] },
  { family: 'Llama', keywords: ['llama'] },
  { family: 'Mistral', keywords: ['mistral', 'mixtral'] },
  { family: 'Kimi', keywords: ['kimi', 'moonshot', '月之暗面'] },
  { family: '文心一言', keywords: ['ernie', '文心'] },
  { family: '混元', keywords: ['hunyuan', '混元'] },
  { family: '豆包', keywords: ['doubao', '豆包'] },
  { family: 'Grok', keywords: ['grok', 'xai'] }
]

const detectFamilies = (text: string): string[] => {
  const lower = text.toLowerCase()
  return MODEL_FAMILIES.filter((it) => it.keywords.some((kw) => lower.includes(kw))).map(
    (it) => it.family
  )
}

const excerpt = (text: string, max = 120): string => text.replace(/\s+/g, ' ').trim().slice(0, max)

const errMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** connect 项的观测（衍生项 latency / usage / usage_sanity 复用） */
export interface HealthConnectObservation {
  latencyMs: number
  content: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  error?: string
}

/** stream 项的观测（衍生项 ttft 复用） */
export interface HealthStreamObservation {
  ttftMs: number | null
  contentLength: number
  error?: string
}

export interface HealthCheckContext {
  apiUrl: string
  apiKey: string
  modelId: string
  format: HealthApiFormat
  /** 任务级停止信号（停止按钮触发 abort） */
  taskSignal: AbortSignal
  /** 共享观测（按注册顺序依赖填充） */
  observed: {
    connect?: HealthConnectObservation
    stream?: HealthStreamObservation
  }
  /** 追加一条执行日志 */
  log: (level: HealthLogEntry['level'], message: string) => void
}

/** 检测项执行结果（不含自身元数据，由 runHealthItem 统一包装） */
export interface HealthItemOutcome {
  status: HealthItemStatus
  latencyMs: number | null
  detail: string
}

interface HealthCheckItemDef {
  key: string
  name: string
  dimension: string
  /** 基础检测包含该项 */
  basic: boolean
  /** 依赖 chat 请求连通（connect 失败时由编排层跳过） */
  requiresConnect: boolean
  run: (ctx: HealthCheckContext) => Promise<HealthItemOutcome>
}

// ── 请求辅助 ─────────────────

const buildParams = (
  ctx: HealthCheckContext,
  messages: AiMessageParam[],
  extra?: Partial<AiRequestParams>
): AiRequestParams => ({
  baseURL: ctx.apiUrl,
  apiKey: ctx.apiKey.trim() || undefined,
  format: ctx.format,
  model: ctx.modelId,
  messages,
  signal: AbortSignal.any([ctx.taskSignal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  ...extra
})

/** 非流式单轮请求 + 计时（connect / 身份自述 / 能力基线共用） */
const requestCompletion = async (
  ctx: HealthCheckContext,
  prompt: string,
  extra?: Partial<AiRequestParams>
): Promise<{ content: string; latencyMs: number; usage?: HealthConnectObservation['usage'] }> => {
  const start = performance.now()
  const result = await createChatCompletion(
    buildParams(ctx, [{ role: 'user', content: prompt }], extra)
  )
  return {
    content: result.content,
    latencyMs: Math.round(performance.now() - start),
    usage: result.usage
  }
}

// ── 12 个检测项定义 ─────────────────

const ITEM_DEFS: HealthCheckItemDef[] = [
  {
    key: 'connect',
    name: '接口连通性',
    dimension: '连通与速度',
    basic: true,
    requiresConnect: false,
    run: async (ctx) => {
      try {
        ctx.log('info', '接口连通性：发起最小对话请求…')
        const { content, latencyMs, usage } = await requestCompletion(ctx, '连通性检测，请回复：OK', {
          maxTokens: 64
        })
        ctx.observed.connect = { latencyMs, content, usage }
        if (!content.trim()) return { status: 'fail', latencyMs, detail: '响应内容为空' }
        return { status: 'pass', latencyMs, detail: `响应正常，返回 ${content.trim().length} 字符` }
      } catch (error) {
        const message = errMessage(error)
        ctx.observed.connect = { latencyMs: 0, content: '', error: message }
        return { status: 'fail', latencyMs: null, detail: `请求失败：${message}` }
      }
    }
  },
  {
    key: 'latency',
    name: '响应时延',
    dimension: '连通与速度',
    basic: true,
    requiresConnect: true,
    run: async (ctx) => {
      const obs = ctx.observed.connect
      if (!obs) return { status: 'fail', latencyMs: null, detail: '连通性请求未执行，无法测得时延' }
      if (obs.error) return { status: 'fail', latencyMs: null, detail: `接口不可达（${obs.error}）` }
      const { latencyMs } = obs
      if (latencyMs < 3000) return { status: 'pass', latencyMs, detail: `非流式完整响应耗时 ${latencyMs}ms，速度良好` }
      if (latencyMs < 10000) return { status: 'warn', latencyMs, detail: `非流式完整响应耗时 ${latencyMs}ms，偏慢` }
      return { status: 'fail', latencyMs, detail: `非流式完整响应耗时 ${latencyMs}ms，过慢` }
    }
  },
  {
    key: 'stream',
    name: '流式输出',
    dimension: '连通与速度',
    basic: false,
    requiresConnect: true,
    run: async (ctx) => {
      try {
        ctx.log('info', '流式输出：发起流式请求（stream=true）…')
        const start = performance.now()
        let ttftMs: number | null = null
        let content = ''
        for await (const chunk of createChatStream(
          buildParams(ctx, [{ role: 'user', content: '流式检测，请从 1 数到 5' }], { maxTokens: 64 })
        )) {
          const text = chunk.choices?.[0]?.delta?.content
          if (text) {
            if (ttftMs === null) ttftMs = Math.round(performance.now() - start)
            content += text
          }
        }
        ctx.observed.stream = { ttftMs, contentLength: content.length }
        if (!content) return { status: 'fail', latencyMs: null, detail: '流式请求完成但未收到任何内容块' }
        return { status: 'pass', latencyMs: ttftMs, detail: `收到流式内容 ${content.length} 字符` }
      } catch (error) {
        const message = errMessage(error)
        ctx.observed.stream = { ttftMs: null, contentLength: 0, error: message }
        return { status: 'fail', latencyMs: null, detail: `流式请求失败：${message}` }
      }
    }
  },
  {
    key: 'ttft',
    name: '首字时延',
    dimension: '连通与速度',
    basic: false,
    requiresConnect: true,
    run: async (ctx) => {
      const obs = ctx.observed.stream
      if (!obs) return { status: 'fail', latencyMs: null, detail: '流式请求未执行，无法测得首字时延' }
      if (obs.error) return { status: 'fail', latencyMs: null, detail: `流式请求失败（${obs.error}）` }
      if (obs.ttftMs == null) return { status: 'fail', latencyMs: null, detail: '未收到流式内容块，无法测得首字时延' }
      const { ttftMs } = obs
      if (ttftMs < 2000) return { status: 'pass', latencyMs: ttftMs, detail: `首块内容到达耗时 ${ttftMs}ms` }
      if (ttftMs < 5000) return { status: 'warn', latencyMs: ttftMs, detail: `首块内容到达耗时 ${ttftMs}ms，偏慢` }
      return { status: 'fail', latencyMs: ttftMs, detail: `首块内容到达耗时 ${ttftMs}ms，过慢` }
    }
  },
  {
    key: 'model_list',
    name: '模型列表核验',
    dimension: '模型真实性',
    basic: false,
    requiresConnect: false,
    run: async (ctx) => {
      if (ctx.format === 'anthropic') {
        return { status: 'skip', latencyMs: null, detail: 'Anthropic 格式无公开模型列表接口，跳过' }
      }
      try {
        ctx.log('info', '模型列表核验：GET /models …')
        const start = performance.now()
        const models = await listAiModels({
          baseURL: ctx.apiUrl,
          apiKey: ctx.apiKey.trim() || undefined,
          format: ctx.format
        })
        const latencyMs = Math.round(performance.now() - start)
        const hit = models.some((it) => it.id === ctx.modelId)
        if (hit) {
          return { status: 'pass', latencyMs, detail: `模型 ${ctx.modelId} 在 /models 列表中（共 ${models.length} 个）` }
        }
        return {
          status: 'warn',
          latencyMs,
          detail: `模型 ${ctx.modelId} 不在 /models 返回中（列表共 ${models.length} 个），可能是中转站私映模型`
        }
      } catch (error) {
        return { status: 'warn', latencyMs: null, detail: `模型列表获取失败：${errMessage(error)}` }
      }
    }
  },
  {
    key: 'identity',
    name: '模型身份自述',
    dimension: '模型真实性',
    basic: true,
    requiresConnect: true,
    run: async (ctx) => {
      const { content, latencyMs } = await requestCompletion(
        ctx,
        '请直接回答：你是哪家公司开发的哪个大模型？只需一句话。',
        { maxTokens: 128 }
      )
      const configured = detectFamilies(ctx.modelId)
      const claimed = detectFamilies(content)
      const said = `自述：「${excerpt(content)}」`
      if (!configured.length) return { status: 'warn', latencyMs, detail: `配置模型「${ctx.modelId}」无法识别家族，${said}` }
      if (!claimed.length) return { status: 'warn', latencyMs, detail: `自述未识别出模型家族，${said}` }
      if (configured.some((it) => claimed.includes(it))) {
        return { status: 'pass', latencyMs, detail: `自述与配置一致（${configured.join(' / ')}），${said}` }
      }
      return {
        status: 'fail',
        latencyMs,
        detail: `疑似模型掺假：配置为 ${configured.join(' / ')}，自述为 ${claimed.join(' / ')}，${said}`
      }
    }
  },
  {
    key: 'usage',
    name: '用量上报',
    dimension: '计费合规',
    basic: true,
    requiresConnect: true,
    run: async (ctx) => {
      const obs = ctx.observed.connect
      if (!obs) return { status: 'fail', latencyMs: null, detail: '连通性请求未执行，无法核验用量' }
      if (obs.error) return { status: 'fail', latencyMs: null, detail: `接口不可达（${obs.error}）` }
      if (!obs.usage) return { status: 'warn', latencyMs: obs.latencyMs, detail: '响应未携带 usage 用量字段，无法核账' }
      if (obs.usage.total_tokens > 0) {
        const u = obs.usage
        return {
          status: 'pass',
          latencyMs: obs.latencyMs,
          detail: `usage 上报正常：prompt ${u.prompt_tokens} / completion ${u.completion_tokens} / total ${u.total_tokens}`
        }
      }
      return { status: 'warn', latencyMs: obs.latencyMs, detail: `usage 数值异常：total_tokens=${obs.usage.total_tokens}` }
    }
  },
  {
    key: 'usage_sanity',
    name: '用量合理性',
    dimension: '计费合规',
    basic: false,
    requiresConnect: true,
    run: async (ctx) => {
      const obs = ctx.observed.connect
      if (!obs) return { status: 'fail', latencyMs: null, detail: '连通性请求未执行，无法核验用量' }
      if (obs.error) return { status: 'fail', latencyMs: null, detail: `接口不可达（${obs.error}）` }
      if (!obs.usage) return { status: 'warn', latencyMs: null, detail: '无 usage 可比对' }
      const chars = obs.content.trim().length
      const tokens = obs.usage.completion_tokens
      // 思考模型的推理 token 计入 completion 但不计入正文，阈值放宽到 5 倍 + 20 余量
      if (tokens <= chars * 5 + 20) {
        return { status: 'pass', latencyMs: null, detail: `用量与内容长度匹配（${tokens} tokens / ${chars} 字符）` }
      }
      return {
        status: 'warn',
        latencyMs: null,
        detail: `完成用量疑似虚高：${tokens} tokens 对应仅 ${chars} 字符内容（扣费陷阱嫌疑，思考模型属正常）`
      }
    }
  },
  {
    key: 'chinese',
    name: '中文理解',
    dimension: '能力基线',
    basic: false,
    requiresConnect: true,
    run: async (ctx) => {
      const { content, latencyMs } = await requestCompletion(ctx, '中国的首都是哪座城市？请直接回答城市名。', {
        maxTokens: 64
      })
      if (content.includes('北京')) return { status: 'pass', latencyMs, detail: `正确回答：「${excerpt(content, 60)}」` }
      return { status: 'fail', latencyMs, detail: `回答异常：「${excerpt(content, 60)}」` }
    }
  },
  {
    key: 'instruction',
    name: '指令遵循',
    dimension: '能力基线',
    basic: false,
    requiresConnect: true,
    run: async (ctx) => {
      const { content, latencyMs } = await requestCompletion(
        ctx,
        '请只回复计算结果数字，不要任何其他内容：17 乘 23 等于多少？',
        { maxTokens: 32 }
      )
      const reply = content.trim()
      const digits = reply.replace(/[\s,，]/g, '')
      if (digits === '391') return { status: 'pass', latencyMs, detail: `严格遵循指令：${digits}` }
      if (reply.includes('391')) return { status: 'warn', latencyMs, detail: `包含正确结果但未严格遵循指令：「${excerpt(reply, 60)}」` }
      return { status: 'fail', latencyMs, detail: `计算错误：「${excerpt(reply, 60)}」` }
    }
  },
  {
    key: 'reasoning',
    name: '基础推理',
    dimension: '能力基线',
    basic: false,
    requiresConnect: true,
    run: async (ctx) => {
      const { content, latencyMs } = await requestCompletion(
        ctx,
        '小明比小红高，小红比小华高。请问谁最矮？只回答名字。',
        { maxTokens: 128 }
      )
      if (content.includes('小华')) return { status: 'pass', latencyMs, detail: `推理正确：「${excerpt(content, 60)}」` }
      return { status: 'fail', latencyMs, detail: `推理错误：「${excerpt(content, 60)}」` }
    }
  },
  {
    key: 'tool_call',
    name: '工具调用',
    dimension: '功能特性',
    basic: false,
    requiresConnect: true,
    run: async (ctx) => {
      const tools: AiTool[] = [
        {
          type: 'function',
          function: {
            name: 'get_current_weather',
            description: '查询指定城市的当前天气',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string', description: '城市名' } },
              required: ['city']
            }
          }
        }
      ]
      try {
        ctx.log('info', '工具调用：携带 tools 发起请求…')
        const start = performance.now()
        let toolCallName: string | null = null
        let finishReason: string | null = null
        for await (const chunk of createChatStream(
          buildParams(ctx, [{ role: 'user', content: '请帮我查询北京的天气' }], { tools, maxTokens: 128 })
        )) {
          const choice = chunk.choices?.[0]
          const call = choice?.delta.tool_calls?.[0]
          if (call?.function?.name) toolCallName = call.function.name
          if (choice?.finish_reason) finishReason = choice.finish_reason
        }
        const latencyMs = Math.round(performance.now() - start)
        if (toolCallName) return { status: 'pass', latencyMs, detail: `模型发起工具调用 ${toolCallName}()` }
        if (finishReason === 'tool_calls') return { status: 'pass', latencyMs, detail: 'finish_reason=tool_calls' }
        return {
          status: 'warn',
          latencyMs,
          detail: `未发起工具调用（finish_reason=${finishReason ?? '无'}），可能不支持 function calling`
        }
      } catch (error) {
        return { status: 'warn', latencyMs: null, detail: `工具调用请求失败：${errMessage(error)}` }
      }
    }
  }
]

// ── 对外执行入口 ─────────────────

/** 按套餐取检测项（basic=4 项核心结论，full=全部 12 项） */
export const getHealthCheckItems = (mode: HealthCheckMode): HealthCheckItemDef[] =>
  mode === 'basic' ? ITEM_DEFS.filter((it) => it.basic) : ITEM_DEFS

/**
 * 执行单个检测项并包装成完整结果（统一打结果日志）。
 * 项内未消化的请求异常在此兜底为 fail；任务被停止时在中断处标记 skip。
 * requiresConnect 项在连通性失败时由编排层先行跳过，此处不重复判定。
 */
export const runHealthItem = async (
  item: HealthCheckItemDef,
  ctx: HealthCheckContext
): Promise<HealthItemResult> => {
  let outcome: HealthItemOutcome
  try {
    outcome = await item.run(ctx)
  } catch (error) {
    outcome = ctx.taskSignal.aborted
      ? { status: 'skip', latencyMs: null, detail: '检测被停止' }
      : { status: 'fail', latencyMs: null, detail: `检测执行异常：${errMessage(error)}` }
  }
  return {
    key: item.key,
    name: item.name,
    dimension: item.dimension,
    status: outcome.status,
    latencyMs: outcome.latencyMs,
    detail: outcome.detail
  }
}

/** 检测项定义元信息（表单套餐说明 / 报告用） */
export const HEALTH_ITEM_METAS: Array<Pick<HealthCheckItemDef, 'key' | 'name' | 'dimension' | 'basic'>> =
  ITEM_DEFS.map(({ key, name, dimension, basic }) => ({ key, name, dimension, basic }))
