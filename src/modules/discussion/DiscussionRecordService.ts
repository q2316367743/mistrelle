import type { AiDiscussionRecord, AiDiscussionRecordItem } from '@/entity/ai'
import { getAppData2Discussion } from '@/global/Constant'
import { useSnowflake } from '@/hooks'

interface DiscussionRecordCache {
  list: AiDiscussionRecordItem[]
  path: string
}

const cacheMap = new Map<string, DiscussionRecordCache>()

const buildDiscussionFolderPath = (discussionId: string) =>
  window.preload.path.join(getAppData2Discussion(), discussionId)

const buildDiscussionIndexPath = (discussionId: string, folder?: string) =>
  window.preload.path.join(folder || buildDiscussionFolderPath(discussionId), 'index.json')

export const buildDiscussionRecordPath = (discussionId: string, recordId: string) =>
  window.preload.path.join(buildDiscussionFolderPath(discussionId), `${recordId}.json`)

const loadCache = async (discussionId: string): Promise<DiscussionRecordCache> => {
  const cached = cacheMap.get(discussionId)
  if (cached) return cached

  const folder = buildDiscussionFolderPath(discussionId)
  const path = buildDiscussionIndexPath(discussionId, folder)
  if (!window.preload.fs.existsSync(folder)) {
    await window.preload.fs.mkdir(folder)
  }
  if (!window.preload.fs.existsSync(path)) {
    await window.preload.fs.writeTextFile(path, JSON.stringify([]))
  }

  const text = await window.preload.fs.readTextFile(path)
  const cache = { list: JSON.parse(text) as AiDiscussionRecordItem[], path }
  cacheMap.set(discussionId, cache)
  return cache
}

const saveIndex = async (discussionId: string, cache: DiscussionRecordCache) => {
  await window.preload.fs.writeTextFile(cache.path, JSON.stringify(cache.list))
  cacheMap.set(discussionId, cache)
}

export const discussionRecordList = async (discussionId: string) => {
  const cache = await loadCache(discussionId)
  return [...cache.list].sort((a, b) => b.updatedAt - a.updatedAt)
}

export const discussionRecordCreate = async (
  discussionId: string,
  topic: string
): Promise<AiDiscussionRecord> => {
  const cache = await loadCache(discussionId)
  const now = Date.now()
  const record: AiDiscussionRecord = {
    id: useSnowflake().nextId(),
    discussionId,
    name: topic.trim().substring(0, 24) || '新讨论',
    currentRound: 0,
    status: 'idle',
    messages: [],
    createdAt: now,
    updatedAt: now
  }
  cache.list.unshift({
    id: record.id,
    discussionId,
    name: record.name,
    currentRound: record.currentRound,
    status: record.status,
    createdAt: now,
    updatedAt: now
  })
  await Promise.all([saveIndex(discussionId, cache), discussionRecordSave(record)])
  return record
}

export const discussionRecordGet = async (discussionId: string, recordId: string) => {
  const path = buildDiscussionRecordPath(discussionId, recordId)
  if (!window.preload.fs.existsSync(path)) return undefined
  return JSON.parse(await window.preload.fs.readTextFile(path)) as AiDiscussionRecord
}

export const discussionRecordSave = async (record: AiDiscussionRecord) => {
  record.updatedAt = Date.now()
  const cache = await loadCache(record.discussionId)
  const index = cache.list.findIndex((item) => item.id === record.id)
  const item: AiDiscussionRecordItem = {
    id: record.id,
    discussionId: record.discussionId,
    name: record.name,
    currentRound: record.currentRound,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }
  if (index >= 0) cache.list[index] = item
  else cache.list.unshift(item)

  await Promise.all([
    saveIndex(record.discussionId, cache),
    window.preload.fs.writeTextFile(
      buildDiscussionRecordPath(record.discussionId, record.id),
      JSON.stringify(record)
    )
  ])
}

export const discussionRecordRemove = async (discussionId: string, recordId: string) => {
  const cache = await loadCache(discussionId)
  const index = cache.list.findIndex((item) => item.id === recordId)
  if (index >= 0) cache.list.splice(index, 1)
  await saveIndex(discussionId, cache)
  const path = buildDiscussionRecordPath(discussionId, recordId)
  if (window.preload.fs.existsSync(path)) await window.preload.fs.rm(path)
}

export const discussionRecordRemoveAll = async (discussionId: string) => {
  cacheMap.delete(discussionId)
  const folder = buildDiscussionFolderPath(discussionId)
  if (window.preload.fs.existsSync(folder)) await window.preload.fs.rm(folder)
}
