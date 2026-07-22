import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { throttle } from 'es-toolkit'
import type { AiDiscussion, AiGroupChat, AiGroupChatMessage, MessageSegment } from '@/entity/ai'
import { useSnowflake } from '@/hooks'
import { ToolChat, type ChatRequestParams } from '@/modules/chat'
import { buildTextContent } from '@/modules/chat/engine/userContent'
import { useAiDiscussionStore, useSettingAiStore, useSettingDefaultStore } from '@/store'
import { MessageUtil } from '@/utils/modal'
import {
  groupChatGet,
  groupChatSave,
  ensureFreshContext,
  createNewContext,
  compressContext,
  getActiveContext,
  clearChatLogically,
  clearChatCompletely
} from '@/modules/discussion/DiscussionChatService'
import { GroupChatEngine, buildTranscript } from '@/modules/discussion/GroupChatEngine'

interface MessageListExpose {
  scrollToBottom: () => void
}

const resolveModel = async (modelKey: string): Promise<ChatRequestParams> => {
  const store = useSettingAiStore()
  if (!store.ready) await store.initPromise
  const option = store.optionMap.get(modelKey)
  if (!option) throw new Error('模型不存在或未启用，请在 AI 设置中配置。')
  return {
    content: [],
    model: option.identifier,
    provide: option.provideId,
    baseURL: option.baseUrl,
    apiKey: option.key
  }
}

const extractText = (chat: ToolChat): string =>
  chat.messages.value
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => m.content ?? [])
    .filter((c) => c.type === 'text' || c.type === 'markdown')
    .map((c) => (c as { data: string }).data)
    .join('')

export const useGroupChat = () => {
  const route = useRoute()
  const discussion = ref<AiDiscussion>()
  const chat = ref<AiGroupChat>()
  const loading = ref(false)
  const running = ref(false)
  const compressing = ref(false)
  const messageListRef = ref<MessageListExpose>()

  let engine: GroupChatEngine | undefined

  const orderedRoles = computed(() =>
    [...(discussion.value?.roles ?? [])].sort((a, b) => a.index - b.index)
  )

  const persist = throttle(
    async () => {
      if (chat.value) await groupChatSave(chat.value)
    },
    300,
    { edges: ['trailing'] }
  )
  const flushPersist = async () => {
    await persist.flush()
  }

  const rebuildEngine = () => {
    engine?.destroy()
    if (!discussion.value || !chat.value) {
      engine = undefined
      return
    }
    engine = new GroupChatEngine(discussion.value, chat.value, {
      onChange: () => {
        persist()
        messageListRef.value?.scrollToBottom()
      }
    })
  }

  const load = async () => {
    loading.value = true
    try {
      const id = route.params.id as string
      discussion.value = await useAiDiscussionStore().getById(id)
      chat.value = await groupChatGet(id)
      rebuildEngine()
    } catch (err) {
      MessageUtil.error('加载讨论组失败', err)
    } finally {
      loading.value = false
    }
  }

  const reloadDiscussion = async () => {
    const id = route.params.id as string
    discussion.value = await useAiDiscussionStore().getById(id)
    rebuildEngine()
  }

  /** 发送用户消息：无 @ 仅记录；有 @ 并发驱动被提及成员 */
  const send = async (payload: { segments: MessageSegment[] }) => {
    if (!discussion.value || !chat.value) return
    const now = Date.now()
    const ctx = ensureFreshContext(chat.value, now)
    const mentionedRoleIds = payload.segments
      .filter((s): s is Extract<MessageSegment, { type: 'at' }> => s.type === 'at')
      .map((s) => s.roleId)
    const text = payload.segments
      .map((s) => (s.type === 'at' ? `@${s.content}` : s.content))
      .join('')
    const userMsg: AiGroupChatMessage = {
      id: useSnowflake().nextId(),
      type: 'user',
      content: text,
      segments: payload.segments,
      timestamp: now,
      mentions: mentionedRoleIds,
      contextId: ctx.id,
      status: 'complete'
    }
    chat.value.messages.push(userMsg)
    persist()
    messageListRef.value?.scrollToBottom()

    if (mentionedRoleIds.length === 0) return

    const responderRoles = discussion.value.roles.filter((r) => mentionedRoleIds.includes(r.id))
    if (responderRoles.length === 0) return

    running.value = true
    try {
      await engine?.runResponders(userMsg, responderRoles)
    } catch (err) {
      MessageUtil.error('群聊执行失败', err)
    } finally {
      running.value = false
      await flushPersist()
    }
  }

  const newContext = async () => {
    if (!chat.value) return
    createNewContext(chat.value, Date.now())
    await flushPersist()
    MessageUtil.success('已开启新上下文')
  }

  /** 压缩当前上下文：用 LLM 摘要后开启新上下文 */
  const compressContextNow = async () => {
    if (!discussion.value || !chat.value || compressing.value) return
    compressing.value = true
    try {
      const ctxMessages = chat.value.messages.filter(
        (m) => m.contextId === chat.value!.activeContextId && m.status !== 'pending' && m.content.trim()
      )
      if (ctxMessages.length === 0) {
        MessageUtil.warning('当前上下文没有可压缩的内容')
        return
      }
      const transcript = buildTranscript(discussion.value, ctxMessages)
      const modelKey = discussion.value.roles[0]?.model || useSettingDefaultStore().state.defaultAssistantModel
      const params = await resolveModel(modelKey)
      const summarizer = new ToolChat({ functions: [], enableSkill: false })
      await summarizer.sendSystemMessage(
        '你是总结助手。把以下群聊记录压缩为一段简洁的要点摘要，保留关键结论、主要分歧、用户偏好与待办事项，用于作为新上下文的起点。直接输出摘要正文。'
      )
      await summarizer.sendUserMessage({ ...params, content: [buildTextContent(transcript)] })
      const summary = extractText(summarizer)
      summarizer.destroy()
      if (!summary.trim()) {
        MessageUtil.warning('摘要为空，已改为直接开启新上下文')
        createNewContext(chat.value, Date.now())
      } else {
        compressContext(chat.value, summary.trim(), Date.now())
      }
      await flushPersist()
      MessageUtil.success('上下文已压缩')
    } catch (err) {
      MessageUtil.error('压缩失败', err)
    } finally {
      compressing.value = false
    }
  }

  const stop = () => {
    engine?.stop()
  }

  /** 逻辑清空聊天记录：标记 clearedAt，数据保留但界面可隐藏 */
  const clearLogically = async () => {
    if (!chat.value) return
    clearChatLogically(chat.value, Date.now())
    await flushPersist()
    MessageUtil.success('聊天记录已清空（逻辑删除）')
  }

  /** 完全清空聊天缓存：删除 chat.json 与 memory，重建空 chat */
  const clearCompletely = async () => {
    if (!chat.value) return
    stop()
    engine?.destroy()
    const discussionId = chat.value.discussionId
    chat.value = await clearChatCompletely(discussionId)
    rebuildEngine()
    MessageUtil.success('聊天缓存已彻底清空')
  }

  const updateExpiryHours = async (hours: number) => {
    if (!chat.value) return
    chat.value.contextExpiryHours = hours
    await flushPersist()
  }

  watch(() => route.params.id, load, { immediate: true })

  onUnmounted(() => {
    persist.cancel()
    engine?.destroy()
  })

  return {
    discussion,
    chat,
    loading,
    running,
    compressing,
    orderedRoles,
    messageListRef,
    getActiveContext,
    load,
    reloadDiscussion,
    send,
    newContext,
    compressContext: compressContextNow,
    stop,
    clearLogically,
    clearCompletely,
    updateExpiryHours
  }
}
