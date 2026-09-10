import type { ZhuqueDetectResult } from '@/windows/main/modules/tool/components/article/articleTypes'
import { SseParser } from '@/windows/main/modules/ai/sse'

/**
 * 长文创作侧边栏的外部接口（去 AI 味流式改写 + 朱雀 AIGC 检测预留）。
 * 去 AI 味经 main RelayService → mistrelle-server /api/rewrite SSE。
 */

/** 去 AI 味流式接口是否已接入 */
export const HUMANIZE_ENABLED = true

export interface HumanizeStreamRequest {
  /** 原文全文 */
  text: string
  /** 流式增量回调（编辑器经 watch content 实时跟随渲染） */
  onDelta: (delta: string) => void
  /** 中止信号 */
  signal?: AbortSignal
  /** 改写深度 1~10，默认 5 */
  depth?: number
}

/** 从非 2xx 响应体提取可读错误（优先 Result.msg） */
function extractJsonError(status: number, text: string): string {
  try {
    const json = JSON.parse(text) as Record<string, unknown>
    if (typeof json.msg === 'string' && json.msg) return json.msg
    if (typeof json.message === 'string' && json.message) return json.message
  } catch {
    // ignore
  }
  if (text.trim()) return text.trim().slice(0, 200)
  return `请求失败（HTTP ${status}）`
}

/**
 * 去 AI 味流式改写：输入正文，流式输出去 AI 味内容。
 * 增量经 onDelta 输出，resolve 完整改写文本；abort 时抛 AbortError。
 */
export async function requestHumanizeStream(req: HumanizeStreamRequest): Promise<string> {
  type StartInfo = { requestId: string; status: number; headers: Record<string, string> }
  const queue: Uint8Array[] = []
  let waiter: (() => void) | null = null
  let settled = false
  let streamError: unknown = null
  let infoResolved = false
  let resolveInfo!: (info: StartInfo) => void
  let rejectInfo!: (error: unknown) => void
  const infoPromise = new Promise<StartInfo>((resolve, reject) => {
    resolveInfo = resolve
    rejectInfo = reject
  })

  const wake = (): void => {
    if (waiter) {
      const pending = waiter
      waiter = null
      pending()
    }
  }

  const donePromise = window.preload.relay.rewriteStream(
    { content: req.text, depth: req.depth ?? 5 },
    {
      onStart: (info) => {
        infoResolved = true
        resolveInfo(info)
      },
      onChunk: (chunk) => {
        queue.push(new Uint8Array(chunk))
        wake()
      }
    }
  )
  donePromise.then(
    () => {
      settled = true
      if (!infoResolved) rejectInfo(new DOMException('Aborted', 'AbortError'))
      wake()
    },
    (error: unknown) => {
      settled = true
      streamError = error
      if (!infoResolved) rejectInfo(error)
      wake()
    }
  )

  const startInfo = await infoPromise

  if (startInfo.status >= 400) {
    let errorText = ''
    for (;;) {
      if (queue.length > 0) {
        errorText += new TextDecoder().decode(queue.shift() as Uint8Array)
        continue
      }
      if (settled) break
      await new Promise<void>((resolve) => {
        waiter = resolve
      })
    }
    throw new Error(extractJsonError(startInfo.status, errorText))
  }

  let removeAbortListener: (() => void) | null = null
  if (req.signal) {
    if (req.signal.aborted) {
      window.preload.relay.streamAbort(startInfo.requestId)
    } else {
      const onAbort = (): void => {
        window.preload.relay.streamAbort(startInfo.requestId)
      }
      req.signal.addEventListener('abort', onAbort, { once: true })
      removeAbortListener = () => req.signal?.removeEventListener('abort', onAbort)
    }
  }

  try {
    const decoder = new TextDecoder()
    const parser = new SseParser()
    let full = ''
    let failedMessage: string | null = null

    const handleFrames = (frames: ReturnType<SseParser['feed']>): void => {
      for (const frame of frames) {
        if (!frame.data) continue
        let json: Record<string, unknown>
        try {
          json = JSON.parse(frame.data) as Record<string, unknown>
        } catch {
          continue
        }
        const type = json.type
        if (type === 'delta' && typeof json.content === 'string' && json.content) {
          full += json.content
          req.onDelta(json.content)
        } else if (type === 'completed' && typeof json.content === 'string') {
          full = json.content
        } else if (type === 'failed') {
          failedMessage =
            typeof json.message === 'string' ? json.message : '去 AI 味失败'
        }
      }
    }

    for (;;) {
      if (req.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }
      if (queue.length > 0) {
        const text = decoder.decode(queue.shift() as Uint8Array, { stream: true })
        handleFrames(parser.feed(text))
        continue
      }
      if (settled) break
      await new Promise<void>((resolve) => {
        waiter = resolve
      })
    }
    handleFrames(parser.flush())

    if (streamError) throw streamError
    if (req.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (failedMessage) throw new Error(failedMessage)
    return full
  } finally {
    removeAbortListener?.()
  }
}

/** 朱雀检测是否已接入 */
export const ZHUQUE_ENABLED = false

/** 朱雀 AIGC 检测：输入正文，返回 ai / 疑似 ai / 人工 三个占比（百分比，和为 100） */
export async function requestZhuqueDetect(_text: string): Promise<ZhuqueDetectResult> {
  throw new Error('朱雀检测暂未开放，需企业认证接入')
}
