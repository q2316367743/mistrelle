import { defineStore } from 'pinia'
import { Project, ProjectForm } from '@/entity'
import {
  projectList,
  projectListSave,
  projectRemove,
  projectCreateSkeleton,
  buildProjectDirPath
} from '@/modules/project'
import { destroyChatSessionsByPrefix } from '@/modules/chat'
import { useSnowflake } from '@/hooks'
import { useLog } from '@/hooks/UseLog'

export const useProjectStore = defineStore('project:list', () => {
  const logger = useLog({ name: 'store:project' })
  const state = ref(new Array<Project>())

  const init = async () => {
    state.value = await projectList()
  }

  init()
    .then(() => logger.debug('项目初始化成功'))
    .catch((e) => logger.error('项目初始化失败', e))

  const getById = (id?: string): Project | undefined => {
    if (!id) return undefined
    return state.value.find((e) => e.id === id)
  }

  const put = async (form: ProjectForm, id?: string) => {
    const now = Date.now()
    if (id) {
      const idx = state.value.findIndex((e) => e.id === id)
      if (idx > -1) {
        state.value[idx] = { ...state.value[idx], ...form, updatedAt: now }
      }
    } else {
      const newItem: Project = {
        ...form,
        id: useSnowflake().nextId().toString(),
        createdAt: now,
        updatedAt: now
      }
      state.value.push(newItem)
      await projectCreateSkeleton(newItem.id)
    }
    await projectListSave(state.value)
  }

  const updateName = async (id: string, name: string) => {
    const idx = state.value.findIndex((e) => e.id === id)
    if (idx < 0) return
    state.value[idx] = { ...state.value[idx], name, updatedAt: Date.now() }
    await projectListSave(state.value)
  }

  const remove = async (id: string) => {
    state.value = state.value.filter((e) => e.id !== id)
    await projectListSave(state.value)
    // 销毁该项目下的所有内存会话，避免后台请求与常驻持久化残留
    destroyChatSessionsByPrefix(buildProjectDirPath(id))
    await projectRemove(id)
  }

  return { state, init, getById, put, updateName, remove }
})
