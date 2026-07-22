import type { AiDiscussion, AiDiscussionRecord, AiDiscussionRecordItem } from '@/entity/ai'
import { useAiDiscussionStore } from '@/store'
import {
  DiscussionEngine,
  discussionRecordCreate,
  discussionRecordGet,
  discussionRecordList,
  discussionRecordSave
} from '@/modules/discussion'
import { MessageUtil } from '@/utils/modal'

interface MessageListExpose {
  scrollToBottom: () => void
}

export const useDiscussionPage = () => {
  const route = useRoute()
  const discussion = ref<AiDiscussion>()
  const records = ref<AiDiscussionRecordItem[]>([])
  const record = ref<AiDiscussionRecord>()
  const input = ref('')
  const loading = ref(false)
  const messageListRef = ref<MessageListExpose>()
  let engine: DiscussionEngine | undefined

  const running = computed(() => record.value?.status === 'running')
  const orderedRoles = computed(() =>
    [...(discussion.value?.roles || [])].sort((a, b) => a.index - b.index)
  )
  const canRun = computed(() => {
    if (running.value) return false
    if (!discussion.value || discussion.value.roles.length === 0) return false
    return Boolean(record.value || input.value.trim())
  })
  const modeText = computed(() => {
    if (!discussion.value) return '未加载'
    if (discussion.value.mode === 'manual') return '手动推进'
    if (discussion.value.mode === 'rounds_limit') return `限制 ${discussion.value.maxRounds} 轮`
    return `自动推进，上限 ${discussion.value.maxRounds} 轮`
  })
  const summaryText = computed(() => {
    if (!discussion.value?.summaryRole) return '未配置总结者'
    if (discussion.value.summaryTrigger === 'after_each_round') return '每轮结束后总结'
    if (discussion.value.summaryTrigger === 'after_all_rounds') return '结束后总结'
    return '手动总结'
  })

  const saveRecordDebounced = useDebounceFn(async () => {
    if (!record.value) return
    await discussionRecordSave(record.value)
    records.value = await discussionRecordList(record.value.discussionId)
  }, 600)

  const rebuildEngine = () => {
    engine?.destroy()
    if (!discussion.value || !record.value) {
      engine = undefined
      return
    }
    engine = new DiscussionEngine(discussion.value, record.value, {
      onChange: () => {
        saveRecordDebounced()
        messageListRef.value?.scrollToBottom()
      }
    })
  }

  const loadDiscussion = async () => {
    loading.value = true
    try {
      const id = route.params.id as string
      discussion.value = await useAiDiscussionStore().getById(id)
      records.value = discussion.value ? await discussionRecordList(id) : []
      record.value = records.value[0]
        ? await discussionRecordGet(id, records.value[0].id)
        : undefined
      rebuildEngine()
    } catch (err) {
      MessageUtil.error('加载讨论组失败', err)
    } finally {
      loading.value = false
    }
  }

  const ensureRecord = async () => {
    if (record.value || !discussion.value) return record.value
    record.value = await discussionRecordCreate(discussion.value.id, input.value)
    records.value = await discussionRecordList(discussion.value.id)
    rebuildEngine()
    return record.value
  }

  const finishIfNeeded = async () => {
    if (!discussion.value || !record.value) return false
    const limited = discussion.value.mode !== 'manual'
    if (!limited || record.value.currentRound < discussion.value.maxRounds) return false
    if (discussion.value.summaryTrigger === 'after_all_rounds' && discussion.value.summaryRole) {
      await engine?.summarize()
    }
    record.value.status = 'completed'
    await discussionRecordSave(record.value)
    records.value = await discussionRecordList(discussion.value.id)
    return true
  }

  const runCycle = async () => {
    if (!discussion.value || !record.value || !engine) return
    const isStopped = () => record.value?.status === 'stopped'
    do {
      await engine.runRound()
      if (isStopped()) break
      if (discussion.value.summaryTrigger === 'after_each_round' && discussion.value.summaryRole) {
        await engine.summarize()
      }
      if (await finishIfNeeded()) break
    } while (discussion.value.mode === 'auto' && !isStopped())
  }

  const handleRun = async () => {
    try {
      const current = await ensureRecord()
      if (!current || !engine) return
      if (input.value.trim()) {
        engine.addUserMessage(input.value)
        input.value = ''
      }
      await runCycle()
      await discussionRecordSave(current)
      records.value = await discussionRecordList(current.discussionId)
    } catch (err) {
      MessageUtil.error('讨论执行失败', err)
    }
  }

  const handleSummarize = async () => {
    try {
      if (!engine || !record.value) return
      await engine.summarize()
      await discussionRecordSave(record.value)
    } catch (err) {
      MessageUtil.error('总结失败', err)
    }
  }

  const handleStop = async () => {
    await engine?.stop()
    if (record.value) await discussionRecordSave(record.value)
  }

  const handleNewSession = () => {
    record.value = undefined
    input.value = ''
    rebuildEngine()
  }

  const handleSelectSession = async (id: string) => {
    if (!discussion.value || running.value) return
    record.value = await discussionRecordGet(discussion.value.id, id)
    rebuildEngine()
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (running.value || !record.value) return
    const index = record.value.messages.findIndex((m) => m.id === messageId)
    if (index < 0) return
    record.value.messages.splice(index, 1)
    await discussionRecordSave(record.value)
  }

  watch(() => route.params.id, loadDiscussion, { immediate: true })

  onUnmounted(() => {
    engine?.destroy()
  })

  return {
    discussion,
    records,
    record,
    input,
    loading,
    messageListRef,
    running,
    orderedRoles,
    canRun,
    modeText,
    summaryText,
    handleRun,
    handleSummarize,
    handleStop,
    handleNewSession,
    handleSelectSession,
    handleDeleteMessage
  }
}
