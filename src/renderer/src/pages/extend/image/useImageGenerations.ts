// ==========================================
//  文生图页数据源：生成记录 SQLite 分页 + 生成流程状态机（模块级单例）
//  单例原因：生成任务是长异步流程，路由切换（页面组件销毁）不应中断或丢失状态——
//  状态存模块闭包，跨页面存活；每次挂载 init() 重新拉取列表即可看到最新进展。
//  状态机 pending → success / failed：
//  - 提交即插入 pending（列表头插，UI 立即出占位卡），生成结束 upsert 收尾
//  - 删除 pending 中的记录后，完成时丢弃结果并清掉落盘文件（防 upsert 复活）
//  - init 时把「不在运行中」的遗留 pending（上次会话中断）收尾为 failed
//  筛选 / 搜索 / 分页在 main 的 SQL 内完成，本侧不持有全量数组
// ==========================================
import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { generateImage } from '@/modules/chat/service/ImageGenerate'
import { getImageGenerateDir } from '@/global/Constant'
import { useSnowflake } from '@/hooks'
import dayjs from 'dayjs'

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
   * 同一时刻可并行多个任务（每条记录独立 await，互不阻塞）。
   */
  const generate = async (promptText: string, size?: string, model?: string): Promise<void> => {
    const prompt = promptText.trim()
    if (!prompt) return

    const modelKey = model?.trim() || useSettingDefaultStore().state.defaultImageModel
    const aiStore = useSettingAiStore()
    if (!aiStore.ready) await aiStore.initPromise
    const modelName = modelKey ? (aiStore.optionMap.get(modelKey)?.model ?? modelKey) : null

    const id = useSnowflake().nextId()
    const month = dayjs().format('YYYY-MM')
    const path = window.preload.path.join(getImageGenerateDir(month), `${id}.png`)
    const record: ImageRecordInput = {
      id,
      prompt,
      model: modelName,
      size: size ?? null,
      path,
      width: null,
      height: null,
      status: 'pending',
      error: null,
      createdAt: Date.now()
    }

    runningIds.add(id)
    runningCount.value += 1
    try {
      await window.preload.db.image.upsert(record)
      list.value.unshift(record)
      total.value += 1

      const result = await generateImage({ prompt, path, size, model: modelKey || undefined })
      if (cancelledIds.has(id)) {
        cancelledIds.delete(id)
        await removeImageFile(path)
        return
      }
      if ('error' in result) {
        await upsertLocal({ ...record, status: 'failed', error: result.error })
      } else {
        await upsertLocal({
          ...record,
          status: 'success',
          width: result.width ?? null,
          height: result.height ?? null
        })
      }
    } finally {
      runningIds.delete(id)
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

  /** 以原 prompt / size / 模型重新发起一次（新记录，保留失败历史） */
  const retry = (record: ImageRecordInput): Promise<void> =>
    generate(record.prompt, record.size ?? undefined, findModelKeyByModelName(record.model))

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
    retry,
    init
  }
}

let instance: ReturnType<typeof createImageGenerations> | null = null

/** 模块级单例：任务与列表状态跨路由切换存活 */
export const useImageGenerations = (): ReturnType<typeof createImageGenerations> => {
  if (!instance) instance = createImageGenerations()
  return instance
}