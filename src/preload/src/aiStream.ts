/**
 * aiStream 桥（preload）：AI 流式请求的薄通道。
 * - 复用 Node http 适配器（sandbox:false，Node 上下文），天然免疫渲染层 CORS。
 * - 只做「字节转发」：SSE 分帧与各厂商格式归一化全部由渲染层 modules/ai 完成，
 *   本桥不感知任何 AI 协议细节。
 * - onStart / onChunk 回调经 contextBridge 代理传入，与本桥同进程调用即可（同 net.ts 约定）。
 */
import axios from 'axios'
import type { Readable } from 'node:stream'

export interface AiStreamHandlers {
  /** 响应头就绪回调（首个数据块之前） */
  onStart?: (info: { requestId: string; status: number; headers: Record<string, string> }) => void
  /** 数据块回调：原始字节（Node Buffer 剥离出独立 ArrayBuffer，避免共享池切片） */
  onChunk?: (chunk: ArrayBuffer) => void
}

/** 进行中请求的取消句柄，按 requestId 索引 */
const controllers = new Map<string, AbortController>()

let seq = 0
const nextRequestId = (): string => `ai-stream-${Date.now()}-${seq++}`

export const aiStreamApi = {
  /**
   * 发起流式请求；Promise 在流结束/中止后 resolve（{ aborted }），失败则 reject。
   * 取消：调用 streamAbort(requestId)。
   */
  streamRequest: async (
    config: Record<string, unknown>,
    handlers: AiStreamHandlers
  ): Promise<{ aborted: boolean }> => {
    const requestId = nextRequestId()
    const controller = new AbortController()
    controllers.set(requestId, controller)
    const { onStart, onChunk } = handlers

    try {
      const response = await axios({
        ...config,
        adapter: axios.getAdapter('http'),
        responseType: 'stream',
        // 流式场景禁用 axios 整体超时：其 timeout 定时器在响应头到达后不会清除，会在响应体读取
        // 期间（AI 思考 / 长回答常远超默认 30s）触发并 request.destroy()，导致流迭代抛 AbortError，
        // 被渲染层误判为主动取消。超时与取消统一由渲染层 AbortSignal（streamAbort）控制。
        timeout: 0,
        signal: controller.signal,
        // 4xx/5xx 必须走 onStart + 字节流，由渲染层 transport 提取错误体。
        // axios 默认 validateStatus 会直接抛「Request failed with status code 403」，
        // 错误体是 Node stream，过不了 contextBridge，调用方只能看到这句空壳。
        validateStatus: () => true
      })
      onStart?.({
        requestId,
        status: response.status,
        headers: Object.fromEntries(
          Object.entries(response.headers as Record<string, unknown>)
        ) as Record<string, string>
      })

      const stream = response.data as Readable
      for await (const chunk of stream) {
        if (controller.signal.aborted) break
        const buffer = chunk as Buffer
        // 拷贝出独立 ArrayBuffer（避免共享池切片 / SharedArrayBuffer 类型问题），再经桥转给渲染层
        const ab = new ArrayBuffer(buffer.byteLength)
        new Uint8Array(ab).set(buffer)
        onChunk?.(ab)
      }
      return { aborted: controller.signal.aborted }
    } catch (error) {
      if (controller.signal.aborted) return { aborted: true }
      throw error
    } finally {
      controllers.delete(requestId)
    }
  },

  /** 取消进行中的流式请求 */
  streamAbort: (requestId: string): void => {
    controllers.get(requestId)?.abort()
  }
}
