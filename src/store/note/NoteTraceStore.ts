import { defineStore } from 'pinia'
import { useLog } from '@/hooks/UseLog'
import { TraceDetail } from '@/entity'
import {
  getFromOneByAsync,
  listByAsync,
  removeOneByAsync,
  saveListByAsync,
  saveOneByAsync
} from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'

export const useNoteTraceStore = defineStore('note-trace', () => {
  const logger = useLog({ name: 'store:note-trace' })
  const state = ref(new Array<number>())
  const rev = ref<string>()
  const detailMap = new Map<string, TraceDetail>()

  ;(async () => {
    const res = await listByAsync<number>(LocalNameEnum.LIST_NOTE_TRACE)
    state.value = res.list
    rev.value = res.rev
  })()
    .then(() => logger.debug('Note Trace 初始化成功'))
    .catch((e) => logger.error('Note Trace 初始化失败', e))

  const add = async (content: string) => {
    const now = Date.now()

    const detailId = LocalNameEnum.ITEM_NOTE_TRACE(now)
    const detail: TraceDetail = {
      content,
      id: detailId,
      createdAt: now,
      updatedAt: now
    }
    await saveOneByAsync<TraceDetail>(detailId, detail)
    detailMap.set(detailId, detail)

    state.value.push(now)
    rev.value = await saveListByAsync(LocalNameEnum.LIST_NOTE_TRACE, state.value, rev.value)

    return detailId
  }

  const getDetailById = async (id: number) => {
    const detailId = LocalNameEnum.ITEM_NOTE_TRACE(id)
    const d = detailMap.get(detailId)
    if (d) return d
    const detail = await getFromOneByAsync<TraceDetail>(detailId)
    if (!detail.record) return Promise.reject(new Error(`Not Found`))
    detailMap.set(detailId, detail.record)
    return detail.record
  }

  const deleteOne = async (id: number) => {
    const detailId = LocalNameEnum.ITEM_NOTE_TRACE(id)
    const index = state.value.findIndex((i) => i === id)
    if (index > -1) {
      // 删除记录
      state.value.splice(index, 1)
      await saveListByAsync(LocalNameEnum.LIST_NOTE_TRACE, state.value, rev.value)
      await removeOneByAsync(LocalNameEnum.ITEM_NOTE_TRACE(id))
      detailMap.delete(detailId)
    }
  }

  return {
    state,
    add,
    getDetailById,
    deleteOne
  }
})
