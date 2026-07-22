import type {
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionTool,
  ChatCompletionMessageToolCall
} from 'openai/resources/chat/completions'
import type { AIMessageContent, ChatMessage, ToolFunction } from '@/domain'
import { AbstractChat, createClient, extractReasoningContent, finishReasonToStatus } from './ChatCommon'
import { prettyDurationTime } from '@/utils/lang'
import type {
  SSEChunkData,
  ChatRequestParams,
  ChatServiceConfig,
  ChatMessageStatus,
  ChatAPI
} from './ChatCommon'
import { nanoid } from 'nanoid'
import { skillTools, applySkillToChat } from '@/modules/skill'
import { defaultTools } from '@/modules/tool'

const getReferenceContext = (ext: unknown) => {
  if (!ext || typeof ext !== 'object' || !('referenceContext' in ext)) return ''
  const value = ext.referenceContext
  return typeof value === 'string' ? value : ''
}

export type ToolCall = {
  toolCallId: string
  toolCallName: string
  parentMessageId?: string
  args?: string
  chunk?: string
  result?: string
}

export interface UseChatOptions {
  defaultMessages?: Array<ChatMessage>
  chatServiceConfig?: ChatServiceConfig
  functions?: Array<ToolFunction>
  enableSkill?: boolean
  toolConfirmHandler?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>
}

export type UseChatResult = ChatAPI & {
  getToolcallByName: (name: string) => ToolCall | undefined
}

export class ToolChat extends AbstractChat {
  readonly toolCalls = ref<ToolCall[]>([])
  private readonly _functions: ToolFunction[]
  private readonly _enableSkill: boolean
  private readonly _toolConfirmHandler?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>

  constructor(options: UseChatOptions) {
    super(options)
    this._functions = options.functions ?? []
    this._enableSkill = options.enableSkill ?? true
    this._toolConfirmHandler = options.toolConfirmHandler
  }

  private getFunctions(): ToolFunction[] {
    const base = this._functions
    return this._enableSkill ? [...base, ...defaultTools, ...skillTools] : base
  }

  private async applySkillContext(apiMessages: ChatCompletionMessageParam[]): Promise<void> {
    if (this._enableSkill) await applySkillToChat(this.messages.value, apiMessages)
  }

  protected onBeforeSendUserMessage(): void {
    this.toolCalls.value = []
  }

  protected toApiMessages(): ChatCompletionMessageParam[] {
    const out: ChatCompletionMessageParam[] = []

    for (const msg of this.messages.value) {
      if (msg.role === 'user') {
        const textParts = msg.content.filter((c) => c.type === 'text') as {
          data: string
        }[]
        const content = textParts.map((t) => t.data).join('') || ''
        const referenceContext = getReferenceContext(msg.ext)
        const userContent = referenceContext ? `${content}${referenceContext}` : content
        out.push({ role: 'user', content: userContent })
      } else if (msg.role === 'system') {
        const firstText = msg.content.find((c) => c.type === 'text')
        out.push({
          role: 'system',
          content: (firstText as { data: string } | undefined)?.data ?? ''
        })
      } else if (msg.role === 'assistant') {
        const parts = msg.content ?? []
        if (parts.length > 0) {
          const pendingTCs: Array<{
            id: string
            name: string
            args: string
            result: string | undefined
          }> = []
          let thinkingBuffer = ''

          const flushTCs = () => {
            if (pendingTCs.length === 0) {
              if (thinkingBuffer) {
                const lastMsg = out[out.length - 1]
                if (lastMsg && lastMsg.role === 'assistant') {
                  ;(lastMsg as unknown as Record<string, unknown>).reasoning_content =
                    thinkingBuffer.trim()
                } else {
                  out.push({
                    role: 'assistant',
                    content: '',
                    ...({
                      reasoning_content: thinkingBuffer.trim()
                    } as unknown as Record<string, unknown>)
                  } as unknown as ChatCompletionMessageParam)
                }
                thinkingBuffer = ''
              }
              return
            }
            const tcMsg: ChatCompletionMessageParam = {
              role: 'assistant',
              content: null,
              tool_calls: pendingTCs.map((tc): ChatCompletionMessageToolCall => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.args }
              }))
            }
            if (thinkingBuffer) {
              ;(tcMsg as unknown as Record<string, unknown>).reasoning_content =
                thinkingBuffer.trim()
              thinkingBuffer = ''
            }
            out.push(tcMsg)
            for (const tc of pendingTCs) {
              out.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: tc.result ?? ''
              })
            }
            pendingTCs.length = 0
          }

          for (const part of parts) {
            if (part.type === 'thinking') {
              thinkingBuffer += ((part.data as { text?: string })?.text || '') + '\n'
              continue
            }

            if (part.type === 'toolcall') {
              pendingTCs.push({
                id: part.data.toolCallId,
                name: part.data.toolCallName,
                args: part.data.args ?? '{}',
                result: part.data.result
              })
              continue
            }

            flushTCs()
            if (part.type === 'markdown' || part.type === 'text') {
              out.push({ role: 'assistant', content: part.data as string })
            }
          }

          flushTCs()
        }
      }
    }

    return out
  }

  private buildTools(): ChatCompletionTool[] {
    return this.getFunctions().map((fn) => ({
      type: 'function' as const,
      function: fn
    }))
  }

  protected handleMessageContent(mc: AIMessageContent, append = true) {
    const last = this.messages.value[this.messages.value.length - 1]
    if (!last) return
    if (last.role !== 'assistant') return
    const { content = [] } = last
    if (append) {
      const l1 = content[content.length - 1]
      if (!l1) {
        content.push(mc)
        return
      }
      if (l1.type === mc.type) {
        if (
          (l1.type === 'text' && mc.type === 'text') ||
          (l1.type === 'markdown' && mc.type === 'markdown')
        ) {
          l1.data += mc.data
          return
        } else if (l1.type === 'reasoning' && mc.type === 'reasoning') {
          l1.data.push(...mc.data)
          return
        } else if (l1.type === 'thinking' && mc.type === 'thinking') {
          l1.data.title = '思考中'
          l1.data.text = (l1.data.text || '') + mc.data.text
          return
        }
      }
    }
    content.push(mc)
    const l2 = content[content.length - 2]
    if (!l2) return
    l2.status = 'complete'
    if (l2.type === 'thinking') {
      l2.data.title = `思考完成 (用时 ${prettyDurationTime(Date.now() - l2.time)})`
    }
  }

  protected handleLastMessage(chatMessageStatus: ChatMessageStatus) {
    const last = this.messages.value[this.messages.value.length - 1]
    if (last) {
      last.status = chatMessageStatus
      if (last.role === 'assistant') {
        if (last.content) {
          const l = last.content[last.content.length - 1]
          if (l) {
            l.status = chatMessageStatus
          }
        }
      }
    }
  }

  protected async doStreamRequest(
    params: ChatRequestParams,
    signal: AbortSignal,
    seq: number
  ): Promise<void> {
    const apiMessages = this.toApiMessages()
    await this.applySkillContext(apiMessages)
    const tools = this.buildTools()

    const body: ChatCompletionCreateParamsStreaming = {
      model: params.model,
      messages: apiMessages,
      stream: true,
      tools
    }

    const extras: Record<string, unknown> = {}
    if (params.thinking) extras.thinking = { type: params.thinking }
    if (params.reasoning_effort) extras.reasoning_effort = params.reasoning_effort

    const finalBody = {
      ...body,
      ...extras
    } as ChatCompletionCreateParamsStreaming

    let requestHeaders: Record<string, string> = {}
    if (this.ctx.config.onRequest) {
      const modified = await this.ctx.config.onRequest(params)
      if (modified) {
        const m = modified as unknown as Record<string, unknown>
        if (m.body) Object.assign(finalBody, m.body)
        if (m.headers) requestHeaders = m.headers as Record<string, string>
      }
    }

    if (this.status.value !== 'streaming') {
      this.status.value = 'streaming'
    }
    this.ctx.config.onStart?.('')

    const client = createClient(params.baseURL, params.apiKey)

    const stream = await client.chat.completions.create(finalBody, {
      signal,
      headers: requestHeaders
    })

    this.messages.value[this.messages.value.length - 1].status = 'streaming'

    const accToolCalls: Map<number, { id: string; name: string; args: string }> = new Map()
    let finishReason: string | null | undefined

    for await (const chunk of stream) {
      if (seq !== this.ctx.requestSeq) return

      const choice = chunk.choices?.[0]
      if (!choice) continue

      const delta = choice.delta
      finishReason = choice.finish_reason

      const sseChunk: SSEChunkData = { data: chunk, event: 'data' }
      if (this.ctx.config.isValidChunk && !this.ctx.config.isValidChunk(sseChunk)) continue

      const reasoningContent = extractReasoningContent(delta)
      if (reasoningContent) {
        this.handleMessageContent({
          type: 'thinking',
          data: { text: reasoningContent, title: '正在思考' },
          status: 'streaming',
          time: Date.now()
        })
        continue
      }

      if (delta.content) {
        this.handleMessageContent({
          type: 'markdown',
          data: delta.content,
          status: 'streaming',
          time: Date.now()
        })
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const index = tc.index
          if (!accToolCalls.has(index)) {
            accToolCalls.set(index, { id: '', name: '', args: '' })
          }
          const entry = accToolCalls.get(index)!
          if (tc.id) entry.id = tc.id
          if (tc.function?.name) entry.name = tc.function.name
          if (tc.function?.arguments) entry.args += tc.function.arguments
        }
      }
    }

    if (seq !== this.ctx.requestSeq) return

    const finalStatus = finishReasonToStatus(finishReason)

    if (accToolCalls.size > 0) {
      const metaList: ToolCall[] = []
      for (const [, tc] of accToolCalls) {
        const id = tc.id || `call_${nanoid()}`
        metaList.push({
          toolCallId: id,
          toolCallName: tc.name,
          args: tc.args
        })
      }

      this.toolCalls.value = metaList

      const functions = this.getFunctions()
      for (const meta of metaList) {
        const fnDef = functions.find((f) => f.name === meta.toolCallName)

        if (!fnDef) {
          meta.result = `错误: 未找到工具 "${meta.toolCallName}"`
          this.handleMessageContent({
            type: 'toolcall',
            status: 'complete',
            data: {
              toolCallId: meta.toolCallId,
              toolCallName: meta.toolCallName,
              args: meta.args,
              result: meta.result
            },
            time: Date.now()
          })
          continue
        }

        const args = JSON.parse(meta.args ?? '{}')

        // 需要用户确认的工具：先渲染 pending 态，等待确认后执行
        if (fnDef.requireConfirm && this._toolConfirmHandler) {
          this.handleMessageContent({
            type: 'toolcall',
            status: 'pending',
            data: {
              toolCallId: meta.toolCallId,
              toolCallName: meta.toolCallName,
              args: meta.args
            },
            time: Date.now()
          })

          const approved = await this._toolConfirmHandler(fnDef.label || fnDef.name, args)

          if (approved) {
            try {
              const raw = await fnDef.handler(args)
              meta.result = typeof raw === 'string' ? raw : JSON.stringify(raw)
            } catch (err: unknown) {
              meta.result = `错误: ${err instanceof Error ? err.message : String(err)}`
            }
          } else {
            meta.result = '用户拒绝了该工具调用'
          }

          // 更新已渲染的 pending toolcall 内容
          const lastMsg = this.messages.value[this.messages.value.length - 1]
          if (lastMsg?.role === 'assistant' && lastMsg.content) {
            const pendingIdx = lastMsg.content.findLastIndex(
              (c) =>
                c.type === 'toolcall' &&
                c.data.toolCallId === meta.toolCallId &&
                c.status === 'pending'
            )
            if (pendingIdx >= 0) {
              const tc = lastMsg.content[pendingIdx]
              if (tc.type === 'toolcall') {
                tc.status = 'complete'
                tc.data.result = meta.result
              }
            }
          }
        } else {
          try {
            const raw = await fnDef.handler(args)
            meta.result = typeof raw === 'string' ? raw : JSON.stringify(raw)
          } catch (err: unknown) {
            meta.result = `错误: ${err instanceof Error ? err.message : String(err)}`
          }

          this.handleMessageContent({
            type: 'toolcall',
            status: 'complete',
            data: {
              toolCallId: meta.toolCallId,
              toolCallName: meta.toolCallName,
              args: meta.args,
              result: meta.result
            },
            time: Date.now()
          })
        }
      }

      this.toolCalls.value = [...this.toolCalls.value]

      await nextTick()

      await this.doStreamRequest(params, signal, seq)
      return
    }

    this.status.value = finalStatus
    this.ctx.config.onComplete?.(false, params)
  }

  getToolcallByName(name: string): ToolCall | undefined {
    return this.toolCalls.value.find((tc) => tc.toolCallName === name)
  }

  destroy(): void {
    if (this.ctx.abortController) {
      this.ctx.abortController.abort()
      this.ctx.abortController = null
    }
    this.messages.value = []
    this.status.value = 'idle'
    this.toolCalls.value = []
  }
}
