import type {
  AiDiscussion,
  AiDiscussionRecord,
  AiDiscussionRecordItem,
  AiDiscussionSessionConfig
} from '@/entity/ai'
import { buildDiscussionSessionConfig } from '@/entity/ai'
import { useAiDiscussionStore } from '@/store'
import {
  DiscussionEngine,
  discussionRecordCreate,
  discussionRecordGet,
  discussionRecordList,
  discussionRecordSave
} from '@/modules/discussion'
import { MessageUtil } from '@/utils/modal'
import { useDiscussionName } from '@/modules/chat'
import { throttle } from 'es-toolkit'
import { openDiscussionSettingsDrawer } from './modals/DiscussionSettingsDrawer'

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
  // 创建讨论前的草稿配置，由讨论组默认值派生，可通过「高级」覆盖
  const draftConfig = ref<AiDiscussionSessionConfig>()
  let engine: DiscussionEngine | undefined

  const running = computed(() => record.value?.status === 'running')
  const orderedRoles = computed(() =>
    [...(discussion.value?.roles || [])].sort((a, b) => a.index - b.index)
  )
  // 是否已开启过讨论（用于切换「引子输入」与「轮后控制」两种形态）
  const started = computed(() => Boolean(record.value && record.value.messages.length > 0))
  const canStart = computed(() => {
    if (running.value) return false
    if (!discussion.value || discussion.value.roles.length === 0) return false
    return Boolean(input.value.trim())
  })

  const refreshList = async () => {
    if (!discussion.value) return
    records.value = await discussionRecordList(discussion.value.id)
  }

  // 流式输出会让记录高频变化，这里限流为 300ms 只落盘最新状态
  const persist = throttle(
    async () => {
      if (!record.value) return
      await discussionRecordSave(record.value)
      await refreshList()
    },
    300,
    { edges: ['trailing'] }
  )

  const flushPersist = async () => {
    await persist.flush()
  }

  const rebuildEngine = () => {
    engine?.destroy()
    if (!discussion.value || !record.value) {
      engine = undefined
      return
    }
    engine = new DiscussionEngine(discussion.value, record.value, {
      onChange: () => {
        persist()
        messageListRef.value?.scrollToBottom()
      }
    })
  }

  const initDraftConfig = () => {
    if (discussion.value) draftConfig.value = buildDiscussionSessionConfig(discussion.value)
  }

  const loadDiscussion = async () => {
    loading.value = true
    try {
      const id = route.params.id as string
      discussion.value = await useAiDiscussionStore().getById(id)
      initDraftConfig()
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

  const reachedLimit = () => {
    const config = record.value?.config
    if (!config) return false
    return config.maxRounds > 0 && (record.value?.currentRound || 0) >= config.maxRounds
  }

  /**
   * 首轮产生内容后，用 AI 为记录命名（替代主题截断）。
   * 仅在记录仍为默认名时执行一次，异步触发、不阻塞讨论流程，失败静默忽略。
   */
  const nameRecordIfNew = (target: AiDiscussionRecord) => {
    if (target.name !== '新讨论' || target.messages.length === 0) return
    const context = target.messages
      .slice(0, 4)
      .map((m) => m.content)
      .filter(Boolean)
      .join('\n')
    useDiscussionName(context)
      .then(async (name) => {
        if (!name || target.name !== '新讨论') return
        target.name = name
        await discussionRecordSave(target)
        await refreshList()
      })
      .catch(() => undefined)
  }

  /**
   * 按记录级配置驱动讨论循环：
   * - auto：自动进入下一轮，直到达到总轮数或手动停止
   * - wait_input：跑完一轮即停，等待用户补充
   * - summarize：跑完一轮后自动总结并结束
   */
  const runCycle = async () => {
    if (!discussion.value || !record.value || !engine) return
    const isStopped = () => record.value?.status === 'stopped'
    do {
      await engine.runRound()
      if (isStopped()) break

      const afterRound = record.value.config.afterRound
      if (afterRound === 'summarize') {
        if (record.value.config.summaryRole) await engine.summarize()
        record.value.status = 'completed'
        break
      }
      if (reachedLimit()) {
        record.value.status = 'completed'
        break
      }
      if (afterRound === 'wait_input') break
    } while (record.value.config.afterRound === 'auto' && !isStopped())

    await flushPersist()
    // 首轮结束后异步用 AI 命名（仅默认名记录触发一次）
    if (record.value) nameRecordIfNew(record.value)
  }

  // 第一步：用户输入引子，创建讨论并立即开始第一轮
  const handleStart = async () => {
    if (!canStart.value || !discussion.value) return
    try {
      const topic = input.value.trim()
      record.value = await discussionRecordCreate(
        discussion.value.id,
        draftConfig.value || buildDiscussionSessionConfig(discussion.value)
      )
      input.value = ''
      rebuildEngine()
      engine?.addUserMessage(topic)
      await runCycle()
      await refreshList()
    } catch (err) {
      MessageUtil.error('讨论执行失败', err)
    }
  }

  // 「再来一轮」：手动推进下一轮（沿用当前轮后行为）
  const handleNextRound = async () => {
    if (running.value || !record.value) return
    try {
      await runCycle()
      await refreshList()
    } catch (err) {
      MessageUtil.error('讨论执行失败', err)
    }
  }

  // 「我补充几句」：把用户发言加入上下文后推进一轮
  const handleSupplement = async () => {
    if (running.value || !record.value || !engine) return
    const text = input.value.trim()
    if (!text) return
    try {
      engine.addUserMessage(text)
      input.value = ''
      await runCycle()
      await refreshList()
    } catch (err) {
      MessageUtil.error('讨论执行失败', err)
    }
  }

  const handleSummarize = async () => {
    try {
      if (!engine || !record.value) return
      await engine.summarize()
      await flushPersist()
      await refreshList()
    } catch (err) {
      MessageUtil.error('总结失败', err)
    }
  }

  const handleStop = async () => {
    await engine?.stop()
    await flushPersist()
    await refreshList()
  }

  // 第三步：随时调整当前会话配置（无记录时调整草稿默认值）
  const openSettings = () => {
    if (!discussion.value) return
    const initial = record.value?.config || draftConfig.value
    if (!initial) return
    openDiscussionSettingsDrawer({
      title: discussion.value.name,
      summaryRole: discussion.value.summaryRole,
      initial,
      onApply: async (config) => {
        if (record.value) {
          record.value.config = config
          await discussionRecordSave(record.value)
          await refreshList()
        } else {
          draftConfig.value = config
        }
      }
    })
  }

  const handleNewSession = () => {
    if (running.value) return
    persist.cancel()
    record.value = undefined
    input.value = ''
    initDraftConfig()
    rebuildEngine()
  }

  const handleSelectSession = async (id: string) => {
    if (!discussion.value || running.value) return
    await flushPersist()
    record.value = await discussionRecordGet(discussion.value.id, id)
    rebuildEngine()
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (running.value || !record.value) return
    const index = record.value.messages.findIndex((m) => m.id === messageId)
    if (index < 0) return
    record.value.messages.splice(index, 1)
    await discussionRecordSave(record.value)
    await refreshList()
  }

  watch(() => route.params.id, loadDiscussion, { immediate: true })

  onUnmounted(() => {
    persist.cancel()
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
    started,
    canStart,
    orderedRoles,
    handleStart,
    handleNextRound,
    handleSupplement,
    handleSummarize,
    handleStop,
    openSettings,
    handleNewSession,
    handleSelectSession,
    handleDeleteMessage
  }
}
