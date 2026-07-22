import type {
  AiDiscussionRecord,
  AiDiscussionRecordItem,
  AiDiscussionSessionConfig
} from '@/entity/ai'
import { getAppData2Discussion } from '@/global/Constant'
import { useSnowflake } from '@/hooks'

/**
 * 命令模式 + 单例：把对「同一个文件路径」的写操作串行化。
 * 讨论进行时记录文件会被高频改写（流式输出 + 限流保存），若并发写入同一文件，
 * 后写会覆盖先写、甚至读到半截内容。每个路径持有唯一的写入器，命令按入队顺序
 * 依次执行，从根源上避免并发冲突。
 */
class PathCommandQueue {
  private tail: Promise<unknown> = Promise.resolve()

  /** 入队一个命令，返回其执行结果；命令严格串行执行 */
  enqueue<T>(command: () => Promise<T>): Promise<T> {
    const run = this.tail.then(command, command)
    // 吞掉异常，保证队列不会因单个命令失败而中断
    this.tail = run.catch(() => undefined)
    return run
  }
}

const queueMap = new Map<string, PathCommandQueue>()

/** 获取（或创建）某个路径对应的单例命令队列 */
const getQueue = (key: string): PathCommandQueue => {
  let queue = queueMap.get(key)
  if (!queue) {
    queue = new PathCommandQueue()
    queueMap.set(key, queue)
  }
  return queue
}

const buildDiscussionFolderPath = (discussionId: string) =>
  window.preload.path.join(getAppData2Discussion(), discussionId)

const buildDiscussionIndexPath = (discussionId: string) =>
  window.preload.path.join(buildDiscussionFolderPath(discussionId), 'index.json')

export const buildDiscussionRecordPath = (discussionId: string, recordId: string) =>
  window.preload.path.join(buildDiscussionFolderPath(discussionId), `${recordId}.json`)

interface DiscussionStore {
  discussionId: string
  /** 索引缓存，仅在索引队列内读写，保证原子性 */
  index: AiDiscussionRecordItem[] | null
}

const storeMap = new Map<string, DiscussionStore>()

const getStore = (discussionId: string): DiscussionStore => {
  let store = storeMap.get(discussionId)
  if (!store) {
    store = { discussionId, index: null }
    storeMap.set(discussionId, store)
  }
  return store
}

/** 读取索引（带缓存），索引文件的初始化与解析统一在索引队列内完成 */
const readIndex = async (discussionId: string): Promise<AiDiscussionRecordItem[]> => {
  const store = getStore(discussionId)
  if (store.index) return store.index
  return getQueue(buildDiscussionIndexPath(discussionId)).enqueue(async () => {
    if (store.index) return store.index
    const folder = buildDiscussionFolderPath(discussionId)
    const path = buildDiscussionIndexPath(discussionId)
    if (!window.preload.fs.existsSync(folder)) await window.preload.fs.mkdir(folder)
    if (!window.preload.fs.existsSync(path)) {
      await window.preload.fs.writeTextFile(path, JSON.stringify([]))
    }
    const text = await window.preload.fs.readTextFile(path)
    store.index = JSON.parse(text) as AiDiscussionRecordItem[]
    return store.index
  })
}

/** 在索引队列内原子地改写索引并落盘 */
const mutateIndex = async (
  discussionId: string,
  mutate: (list: AiDiscussionRecordItem[]) => AiDiscussionRecordItem[]
): Promise<AiDiscussionRecordItem[]> => {
  const store = getStore(discussionId)
  return getQueue(buildDiscussionIndexPath(discussionId)).enqueue(async () => {
    const next = mutate(store.index ? [...store.index] : [])
    store.index = next
    await window.preload.fs.writeTextFile(buildDiscussionIndexPath(discussionId), JSON.stringify(next))
    return next
  })
}

const toIndexItem = (record: AiDiscussionRecord): AiDiscussionRecordItem => ({
  id: record.id,
  discussionId: record.discussionId,
  name: record.name,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
})

export const discussionRecordList = async (discussionId: string) => {
  const list = await readIndex(discussionId)
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt)
}

export const discussionRecordCreate = async (
  discussionId: string,
  config: AiDiscussionSessionConfig
): Promise<AiDiscussionRecord> => {
  await readIndex(discussionId)
  const now = Date.now()
  const record: AiDiscussionRecord = {
    id: useSnowflake().nextId(),
    discussionId,
    name: '新讨论',
    currentRound: 0,
    status: 'idle',
    config,
    messages: [],
    createdAt: now,
    updatedAt: now
  }
  await Promise.all([
    mutateIndex(discussionId, (list) => [toIndexItem(record), ...list]),
    getQueue(buildDiscussionRecordPath(discussionId, record.id)).enqueue(() =>
      window.preload.fs.writeTextFile(
        buildDiscussionRecordPath(discussionId, record.id),
        JSON.stringify(record)
      )
    )
  ])
  return record
}

export const discussionRecordGet = async (discussionId: string, recordId: string) => {
  const path = buildDiscussionRecordPath(discussionId, recordId)
  // 读操作走对应路径的队列，避免读到正在写入的半截文件
  return getQueue(path).enqueue(async () => {
    if (!window.preload.fs.existsSync(path)) return undefined
    return JSON.parse(await window.preload.fs.readTextFile(path)) as AiDiscussionRecord
  })
}

/**
 * 保存讨论详情。
 * 快照在命令真正执行时才读取，因此高频调用（限流后）始终落盘最新状态；
 * 索引项与详情文件分别走各自的队列，互不阻塞。
 */
export const discussionRecordSave = async (record: AiDiscussionRecord) => {
  record.updatedAt = Date.now()
  const { discussionId, id } = record
  await mutateIndex(discussionId, (list) => {
    const item = toIndexItem(record)
    const index = list.findIndex((e) => e.id === id)
    if (index >= 0) list[index] = item
    else list.unshift(item)
    return list
  })
  await getQueue(buildDiscussionRecordPath(discussionId, id)).enqueue(() =>
    window.preload.fs.writeTextFile(buildDiscussionRecordPath(discussionId, id), JSON.stringify(record))
  )
}

export const discussionRecordRemove = async (discussionId: string, recordId: string) => {
  await mutateIndex(discussionId, (list) => list.filter((e) => e.id !== recordId))
  const path = buildDiscussionRecordPath(discussionId, recordId)
  await getQueue(path).enqueue(async () => {
    if (window.preload.fs.existsSync(path)) await window.preload.fs.rm(path)
  })
}

export const discussionRecordRemoveAll = async (discussionId: string) => {
  const list = await readIndex(discussionId)
  await Promise.all(
    list.map((item) =>
      getQueue(buildDiscussionRecordPath(discussionId, item.id)).enqueue(async () => {
        const path = buildDiscussionRecordPath(discussionId, item.id)
        if (window.preload.fs.existsSync(path)) await window.preload.fs.rm(path)
      })
    )
  )
  const folder = buildDiscussionFolderPath(discussionId)
  await getQueue(buildDiscussionIndexPath(discussionId)).enqueue(async () => {
    if (window.preload.fs.existsSync(folder)) await window.preload.fs.rm(folder)
  })
  storeMap.delete(discussionId)
}
