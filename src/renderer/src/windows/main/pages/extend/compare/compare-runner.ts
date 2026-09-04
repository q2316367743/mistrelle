// ==========================================
//  模型对比检测：单模型管线执行器（速度 / 身份 / 题集 / 一致性 四阶段）。
//  - 全部请求走 modules/ai 三格式适配器（chat / anthropic / responses），零协议重复；
//    速度轮直接消费 createChatStream 逐帧计时（TTFT / 思考块 / 生成时长 / 末帧 usage）。
//  - 全局 in-flight 计数器：每请求发起 +1 / 结束 -1，速度请求记录发起时水位，
//    用于评估并发执行对速度指标的影响（报告与总览表标注）。
//  - 结果就地写入传入的 CompareModelResult（reactive 代理），阶段完成回调 onUpdate 由编排层落盘。
// ==========================================
import { createChatCompletion, createChatStream } from '@/windows/main/modules/ai'
import type { AiMessageParam, AiRequestParams } from '@/windows/main/modules/ai'
import type {
  CompareConsistencyResult,
  CompareModelResult,
  CompareModelTarget,
  CompareQuestionResult,
  CompareSpeedRun,
  CompareTokenSource
} from './compare-types'
import { judgeQuestion } from './compare-question-bank'

/** 各阶段单请求超时（ms） */
export const SPEED_TIMEOUT_MS = 180_000
export const IDENTITY_TIMEOUT_MS = 30_000
export const QUESTION_TIMEOUT_MS = 60_000

/** 速度轮默认 prompt（内置固定） */
export const DEFAULT_SPEED_PROMPT =
  '请写一篇约 600 字的中文文章，主题是「大语言模型是如何工作的」，要求条理清晰，分成 3 个小节，每节配一个小标题。'

const SPEED_MAX_TOKENS = 1500
const QUESTION_MAX_TOKENS = 1024
const IDENTITY_MAX_TOKENS = 128
/** 一致性轮同题重复次数 */
const CONSISTENCY_REPEATS = 3

/** 全局并发水位（每请求发起 +1 / 结束 -1；速度请求记录发起时快照） */
let inFlightCount = 0
const acquireInFlight = (): number => ++inFlightCount
const releaseInFlight = (): void => {
  inFlightCount = Math.max(0, inFlightCount - 1)
}

const errMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** 数值中位数（空数组返回 null） */
const median = (values: number[]): number | null => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface CompareRunnerContext {
  target: CompareModelTarget
  taskSignal: AbortSignal
  log: (level: 'info' | 'warn' | 'error', message: string) => void
  /** 结果已变更（每请求完成时触发，编排层负责落盘） */
  onUpdate: () => void
}

interface StageOptions {
  ctx: CompareRunnerContext
  result: CompareModelResult
}

interface StageUsage {
  prompt_tokens: number
  completion_tokens: number
}

const buildParams = (
  ctx: CompareRunnerContext,
  messages: AiMessageParam[],
  timeoutMs: number,
  extra?: Partial<AiRequestParams>
): AiRequestParams => ({
  baseURL: ctx.target.apiUrl,
  apiKey: ctx.target.apiKey.trim() || undefined,
  format: ctx.target.format,
  model: ctx.target.modelId,
  messages,
  signal: AbortSignal.any([ctx.taskSignal, AbortSignal.timeout(timeoutMs)]),
  ...extra
})

/** usage 累计到 result.usage（服务端上报可得时） */
const accumulateUsage = (result: CompareModelResult, usage?: StageUsage): void => {
  if (!usage) return
  result.usage.promptTokens += usage.prompt_tokens || 0
  result.usage.completionTokens += usage.completion_tokens || 0
}

/** 速度轮中位数重算（每次请求完成后调用） */
const recomputeSpeedMedian = (result: CompareModelResult): void => {
  const ttfts = result.speedRuns.map((it) => it.ttftMs).filter((it): it is number => it != null)
  const speeds = result.speedRuns.map((it) => it.tokPerSec).filter((it): it is number => it != null)
  result.speedMedian = {
    ttftMs: median(ttfts),
    tokPerSec: median(speeds)
  }
}

/** 单次速度测试：流式逐帧计时（思考块 / 首块 / 生成时长 / usage / 结束原因） */
const runSpeedOnce = async (
  ctx: CompareRunnerContext,
  prompt: string
): Promise<{ run: CompareSpeedRun; usage?: StageUsage }> => {
  const inFlight = acquireInFlight()
  const start = performance.now()
  let thinkMs: number | null = null
  let ttftMs: number | null = null
  let firstAt: number | null = null
  let lastAt: number | null = null
  let content = ''
  let isThinking = false
  let finishReason: string | null = null
  let usage: StageUsage | undefined
  try {
    for await (const chunk of createChatStream(
      buildParams(ctx, [{ role: 'user', content: prompt }], SPEED_TIMEOUT_MS, {
        maxTokens: SPEED_MAX_TOKENS,
        bodyOverride: { temperature: 0.5 }
      })
    )) {
      const now = performance.now()
      const choice = chunk.choices?.[0]
      const reasoning = choice?.delta.reasoning_content
      if (reasoning) {
        if (thinkMs == null) thinkMs = Math.round(now - start)
        isThinking = true
      }
      const text = choice?.delta.content ?? choice?.message?.content
      if (text) {
        if (ttftMs == null) {
          ttftMs = Math.round(now - start)
          firstAt = now
        }
        lastAt = now
        content += text
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason
      if (chunk.usage) usage = chunk.usage
    }
    const endAt = lastAt ?? performance.now()
    const totalMs = Math.round(endAt - start)
    const genMs = firstAt != null && lastAt != null ? Math.round(lastAt - firstAt) : null
    const completionTokens = usage?.completion_tokens ?? null
    const tokenSource: CompareTokenSource = usage?.completion_tokens ? 'usage' : 'estimate'
    // usage 缺失时用字符数估算（中文约 1 字 ≈ 1 token，偏保守参考值）
    const tokens = completionTokens ?? Math.max(1, content.length)
    const tokPerSec = genMs && genMs > 0 ? Math.round((tokens / genMs) * 10000) / 10 : null
    return {
      run: {
        ttftMs,
        thinkMs,
        genMs,
        totalMs,
        isThinking,
        contentChars: content.length,
        completionTokens,
        tokenSource,
        tokPerSec,
        finishReason,
        inFlight
      },
      usage
    }
  } finally {
    releaseInFlight()
  }
}

/** 速度轮：N 次测速（每次完成后更新中位数并回调落盘） */
export const runSpeedStage = async (opts: StageOptions, runs: number, prompt: string): Promise<void> => {
  const { ctx, result } = opts
  for (let i = 0; i < runs; i++) {
    if (ctx.taskSignal.aborted) return
    result.stage = `速度轮 ${i + 1}/${runs}`
    ctx.onUpdate()
    try {
      const { run, usage } = await runSpeedOnce(ctx, prompt)
      accumulateUsage(result, usage)
      result.speedRuns.push(run)
      recomputeSpeedMedian(result)
      if (run.ttftMs == null && run.contentChars === 0) {
        ctx.log('warn', `${result.target.modelName} 速度轮第 ${i + 1} 次未收到内容输出`)
      }
    } catch (error) {
      result.speedRuns.push({
        ttftMs: null,
        thinkMs: null,
        genMs: null,
        totalMs: null,
        isThinking: false,
        contentChars: 0,
        completionTokens: null,
        tokenSource: 'estimate',
        tokPerSec: null,
        finishReason: null,
        inFlight: 0,
        error: errMessage(error)
      })
      ctx.log('error', `${result.target.modelName} 速度轮第 ${i + 1} 次失败：${errMessage(error)}`)
    }
    ctx.onUpdate()
  }
}

/** 身份轮：模型自述（全文保留，供不同提供方同款模型横向比对） */
export const runIdentityStage = async (opts: StageOptions): Promise<void> => {
  const { ctx, result } = opts
  if (ctx.taskSignal.aborted) return
  result.stage = '身份自述'
  ctx.onUpdate()
  acquireInFlight()
  try {
    const start = performance.now()
    const completion = await createChatCompletion(
      buildParams(ctx, [{ role: 'user', content: '请直接回答：你是哪家公司开发的哪个大模型？只需一句话。' }], IDENTITY_TIMEOUT_MS, {
        maxTokens: IDENTITY_MAX_TOKENS
      })
    )
    accumulateUsage(result, completion.usage)
    result.identity = {
      content: completion.content.trim(),
      latencyMs: Math.round(performance.now() - start)
    }
  } catch (error) {
    result.identity = { content: '', latencyMs: 0, error: errMessage(error) }
    ctx.log('error', `${result.target.modelName} 身份自述失败：${errMessage(error)}`)
  } finally {
    releaseInFlight()
  }
  ctx.onUpdate()
}

/** 题集轮：启用题逐题测试（temperature=0，关键词 + 可选正则判分，答案全文保留供人工复核） */
export const runQuestionStage = async (opts: StageOptions, questions: CompareQuestionInput[]): Promise<void> => {
  const { ctx, result } = opts
  for (let i = 0; i < questions.length; i++) {
    if (ctx.taskSignal.aborted) return
    const question = questions[i]
    result.stage = `题集轮 ${i + 1}/${questions.length}`
    ctx.onUpdate()
    acquireInFlight()
    let item: CompareQuestionResult
    try {
      const completion = await createChatCompletion(
        buildParams(ctx, [{ role: 'user', content: question.question }], QUESTION_TIMEOUT_MS, {
          maxTokens: QUESTION_MAX_TOKENS,
          bodyOverride: { temperature: 0 }
        })
      )
      accumulateUsage(result, completion.usage)
      const answer = completion.content.trim()
      item = {
        key: question.key,
        tag: question.tag,
        question: question.question,
        answer,
        reference: question.reference,
        pass: answer ? judgeQuestion(question, answer) : null,
        answerChars: answer.length,
        truncated: completion.finishReason === 'length'
      }
    } catch (error) {
      item = {
        key: question.key,
        tag: question.tag,
        question: question.question,
        answer: '',
        reference: question.reference,
        pass: null,
        answerChars: 0,
        truncated: false,
        error: errMessage(error)
      }
      ctx.log('error', `${result.target.modelName} 题集「${question.tag}」请求失败：${errMessage(error)}`)
    } finally {
      releaseInFlight()
    }
    result.questions.push(item)
    if (item.pass === true) result.questionPassed += 1
    ctx.onUpdate()
  }
}

/** 一致性轮：同题各 3 次重复（temperature=0），答案全同 = 稳定 */
export const runConsistencyStage = async (opts: StageOptions, questions: CompareQuestionInput[]): Promise<void> => {
  const { ctx, result } = opts
  for (let i = 0; i < questions.length; i++) {
    if (ctx.taskSignal.aborted) return
    const question = questions[i]
    result.stage = `一致性轮 ${i + 1}/${questions.length}`
    ctx.onUpdate()
    const answers: string[] = []
    let error: string | undefined
    for (let r = 0; r < CONSISTENCY_REPEATS; r++) {
      if (ctx.taskSignal.aborted) return
      acquireInFlight()
      try {
        const completion = await createChatCompletion(
          buildParams(ctx, [{ role: 'user', content: question.question }], QUESTION_TIMEOUT_MS, {
            maxTokens: QUESTION_MAX_TOKENS,
            bodyOverride: { temperature: 0 }
          })
        )
        accumulateUsage(result, completion.usage)
        answers.push(completion.content.trim())
      } catch (err) {
        error = errMessage(err)
        break
      } finally {
        releaseInFlight()
      }
    }
    const item: CompareConsistencyResult = {
      key: question.key,
      tag: question.tag,
      question: question.question,
      answers,
      allSame: answers.length === CONSISTENCY_REPEATS && answers.every((it) => it === answers[0]),
      error
    }
    if (error) ctx.log('error', `${result.target.modelName} 一致性「${question.tag}」请求失败：${error}`)
    result.consistency.push(item)
    ctx.onUpdate()
  }
}
