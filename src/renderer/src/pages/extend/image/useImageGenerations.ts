// ==========================================
//  文生图页数据源：生成记录 SQLite 分页 + 生成流程状态机（模块级单例）
//  单例原因：生成任务是长异步流程，路由切换（页面组件销毁）不应中断或丢失状态——
//  状态存模块闭包，跨页面存活；每次挂载 init() 重新拉取列表即可看到最新进展。
//  状态机 pending → success / failed：
//  - 提交即插入 pending（列表头插，UI 立即出占位卡），生成结束 upsert 收尾
//  - 删除 pending 中的记录后，完成时丢弃结果并清掉落盘文件（防 upsert 复活）
//  - init 时把「不在运行中」的遗留 pending（上次会话中断）收尾为 failed
//  - 失败记录按异步任务型（taskId）/ 终态（taskTerminal）/ 查询窗口（pollMaxAt）
//    判定是否可「续轮询」：可续的失败点击重试=原地改回 pending，对同一远端
//    task_id 继续轮询（不重新提交任务）；其余失败只可删除
//  筛选 / 搜索 / 分页在 main 的 SQL 内完成，本侧不持有全量数组
// ==========================================
import { useDesignStyleStore, useSettingAiStore, useSettingDefaultStore } from '@/store'
import { buildDesignStylePrompt } from '@/modules/design'
import {
  generateImage,
  resumeTaskPoll,
  type GenerateImageError,
  type GenerateImageResult
} from '@/modules/chat/service/ImageGenerate'
import { getImageGenerateDir } from '@/global/Constant'
import { useSnowflake } from '@/hooks'
import { MessageUtil } from '@/utils/modal'
import dayjs from 'dayjs'
import { canResumePoll } from './image-page-utils'

/** 每页条数 */
const PAGE_SIZE = 24

const createImageGenerations = () => {
  /** 当前已加载的多页记录（created_at 倒序） */
  const list = ref<ImageRecordInput[]>([])
  /** 匹配筛选的总条数（hasMore 判定 / 计数展示） */
  const total = ref(0)
  /** 搜索关键词（对外部 watchDebounced 驱动 refresh） */
  const keyword = ref('')
  const initLoading = ref(false)
  const moreLoading = ref(false)
  /** 进行中的生成任务计数（供展示，不阻塞提交） */
  const runningCount = ref(0)
  /** 进行中任务 id：init 收尾时排除（防误标），删除后仍计入（完成时丢弃结果） */
  const runningIds = new Set<string>()
  /** 陈旧请求丢弃标记：防快速切换关键词导致乱序覆盖 */
  let seq = 0

  const hasMore = computed(() => list.value.length < total.value)

  const query = async (reset: boolean): Promise<void> => {
    const token = ++seq
    if (reset) initLoading.value = true
    else moreLoading.value = true
    try {
      const res = await window.preload.db.image.list({
        filter: { keyword: keyword.value },
        limit: PAGE_SIZE,
        offset: reset ? 0 : list.value.length
      })
      if (token !== seq) return
      total.value = res.total
      if (reset) list.value = res.items
      else list.value = [...list.value, ...res.items]
    } finally {
      if (token === seq) {
        initLoading.value = false
        moreLoading.value = false
      }
    }
  }

  const refresh = (): Promise<void> => query(true)
  const loadMore = (): Promise<void> => query(false)

  /** 已删除 pending 的记录 id：生成完成后丢弃结果，不回写 DB */
  const cancelledIds = new Set<string>()

  /** 写入 DB 并同步列表中的同 id 记录（列表项就地替换） */
  const upsertLocal = async (record: ImageRecordInput): Promise<void> => {
    await window.preload.db.image.upsert(record)
    const idx = list.value.findIndex((it) => it.id === record.id)
    if (idx >= 0) list.value[idx] = record
  }

  const removeImageFile = async (path: string | null): Promise<void> => {
    if (path && window.preload.fs.existsSync(path)) await window.preload.fs.rm(path)
  }

  /**
   * 发起一次生成：插入 pending 记录 → generateImage 落盘 → 收尾 success / failed。
   * model 为显式选择的模型 key（${provideId}:${identifier}），缺省回退默认生图模型；
   * styleId 为设计风格 id，选中时把风格名快照落库（styleName，同 model 快照语义），
   * 并把风格提示词拼进实际请求（记录仍保留用户原始 prompt）；
   * 同一时刻可并行多个任务（每条记录独立 await，互不阻塞）。
   */
  const generate = async (
    promptText: string,
    size?: string,
    model?: string,
    styleId?: string
  ): Promise<void> => {
    const prompt = promptText.trim()
    if (!prompt) return

    const modelKey = model?.trim() || useSettingDefaultStore().state.defaultImageModel
    const aiStore = useSettingAiStore()
    if (!aiStore.ready) await aiStore.initPromise
    const modelName = modelKey ? (aiStore.optionMap.get(modelKey)?.model ?? modelKey) : null

    // 设计风格解析前置：name 快照随记录落库（记录出处），提示词只拼进实际请求
    // （记录保留用户原始 prompt，历史卡片可读）
    let requestPrompt = prompt
    let styleName: string | null = null
    const styleKey = styleId?.trim()
    if (styleKey) {
      try {
        const style = await useDesignStyleStore().getDetail(styleKey)
        if (style) {
          styleName = style.name
          requestPrompt = `${prompt}\n\n${buildDesignStylePrompt(style)}`
        }
      } catch {
        // 风格详情读取失败按无风格生成，不阻断任务
      }
    }

    const id = useSnowflake().nextId()
    const month = dayjs().format('YYYY-MM')
    const path = window.preload.path.join(getImageGenerateDir(month), `${id}.png`)
    // let：onTaskCreated 确认异步任务型后原地补 taskId / pollMaxAt，
    // 保证最终收尾（finishPending）展开的是已带远端标识的记录
    let record: ImageRecordInput = {
      id,
      prompt,
      model: modelName,
      styleName,
      size: size ?? null,
      path,
      width: null,
      height: null,
      status: 'pending',
      error: null,
      taskId: null,
      pollMaxAt: null,
      taskTerminal: null,
      createdAt: Date.now()
    }

    runningIds.add(id)
    runningCount.value += 1
    try {
      await window.preload.db.image.upsert(record)
      list.value.unshift(record)
      total.value += 1

      const result = await generateImage({
        prompt: requestPrompt,
        path,
        size,
        model: modelKey || undefined,
        // 确认异步任务型（响应带 task_id）：轮询开始前就把远端标识落库，
        // 生成中被中断 / 应用退出也能跨重启续轮询同一任务
        onTaskCreated: (taskId, pollMaxAt) => {
          record = { ...record, taskId, pollMaxAt }
          upsertLocal(record)
        }
      })
      if (cancelledIds.has(id)) {
        cancelledIds.delete(id)
        await removeImageFile(path)
        return
      }
      await finishPending(record, result)
    } finally {
      runningIds.delete(id)
      runningCount.value -= 1
    }
  }

  /**
   * 收尾一次生成 / 续轮询结果：成功补宽高；失败写 error，
   * 并持久化 taskId / pollMaxAt（可续轮询的依据）与 taskTerminal（不可续标记）。
   * 失败按 result 的 kind 判别是否可续：resumable（任务可能仍在跑）保留 task_id 可重试，
   * terminal（已确认终态 / 无远端任务）标 task_terminal=true 只可删除。
   */
  const finishPending = async (
    record: ImageRecordInput,
    result: GenerateImageResult | GenerateImageError
  ): Promise<void> => {
    if ('error' in result) {
      await upsertLocal({
        ...record,
        status: 'failed',
        error: result.error,
        taskId: result.taskId ?? record.taskId,
        pollMaxAt: result.pollMaxAt ?? record.pollMaxAt,
        taskTerminal: result.kind === 'terminal'
      })
    } else {
      await upsertLocal({
        ...record,
        status: 'success',
        width: result.width ?? null,
        height: result.height ?? null
      })
    }
  }

  /**
   * 续轮询一个异步任务型失败记录：记录原地改回 pending，对同一远端 task_id 继续轮询
   * （剩余查询窗口 ≤5 分钟，不重新提交任务、不重复扣费）。
   * 非可续失败（同步失败 / 已确认终态 / 已超窗口）直接提示不可重试。
   */
  const resumeRetry = async (record: ImageRecordInput): Promise<void> => {
    if (record.status !== 'failed' || !record.taskId) return
    if (!canResumePoll(record)) {
      MessageUtil.warning('该任务已超过可查询窗口或已结束：无法续轮询，请重新生成')
      return
    }
    const pending: ImageRecordInput = { ...record, status: 'pending', error: null }
    runningIds.add(record.id)
    runningCount.value += 1
    try {
      await window.preload.db.image.upsert(pending)
      const idx = list.value.findIndex((it) => it.id === record.id)
      if (idx >= 0) list.value[idx] = pending
      const result = await resumeTaskPoll({
        prompt: record.prompt,
        path: record.path ?? '',
        size: record.size ?? undefined,
        model: findModelKeyByModelName(record.model),
        taskId: record.taskId,
        // 无窗口记录的旧数据：视为从当前起再给一个完整 5 分钟窗口
        pollMaxAt: record.pollMaxAt ?? Date.now() + 5 * 60 * 1000
      })
      if (cancelledIds.has(record.id)) {
        cancelledIds.delete(record.id)
        if (record.path) await removeImageFile(record.path)
        return
      }
      await finishPending(pending, result)
    } finally {
      runningIds.delete(record.id)
      runningCount.value -= 1
    }
  }

  /** 按模型显示名反查 optionMap key（重新生成保留原模型；找不到时回退默认） */
  const findModelKeyByModelName = (name: string | null): string | undefined => {
    if (!name) return undefined
    const aiStore = useSettingAiStore()
    for (const [key, opt] of aiStore.optionMap) {
      if (opt.model === name) return key
    }
    return undefined
  }

  /** 删除记录并联动删图片文件；pending 中的纳入取消集合 */
  const remove = async (id: string): Promise<void> => {
    const rec = list.value.find((it) => it.id === id)
    await window.preload.db.image.delete(id)
    if (!rec) return
    list.value = list.value.filter((it) => it.id !== id)
    total.value = Math.max(0, total.value - 1)
    if (rec.status === 'pending') cancelledIds.add(id)
    await removeImageFile(rec.path)
  }

  /** 初始化：遗留 pending 收尾 + 首屏查询（每次挂载调用，运行中任务不受影响） */
  const init = async (): Promise<void> => {
    const stale = await window.preload.db.image.list({ filter: { status: 'pending' }, limit: 500, offset: 0 })
    const orphan = stale.items.filter((r) => !runningIds.has(r.id))
    if (orphan.length) {
      await Promise.all(
        orphan.map((r) =>
          window.preload.db.image.upsert({ ...r, status: 'failed', error: '生成中断：应用退出或刷新' })
        )
      )
    }
    await query(true)
  }

  return {
    list,
    total,
    keyword,
    initLoading,
    moreLoading,
    runningCount,
    hasMore,
    refresh,
    loadMore,
    generate,
    remove,
    resumeRetry,
    init
  }
}

let instance: ReturnType<typeof createImageGenerations> | null = null

/** 模块级单例：任务与列表状态跨路由切换存活 */
export const useImageGenerations = (): ReturnType<typeof createImageGenerations> => {
  if (!instance) instance = createImageGenerations()
  return instance
}