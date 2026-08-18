import { defineStore } from 'pinia'
import { AiAgent, AiAgentForm } from '@/entity/ai'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'
import { CommonSelect } from '@/domain'
import { BUILTIN_AGENTS } from '@/global/BuiltInAgent'
import { agentList, agentSave } from '@/modules/agent/service/AiAgentService'


/** 内置 Agent 的 id 集合，用于快速判定只读项 */
const BUILTIN_IDS: ReadonlySet<string> = new Set(BUILTIN_AGENTS.map((e) => e.id))

export const useAiAgentStore = defineStore('ai-agent', () => {
  const logger = useLog({ name: 'store:ai-agent' })

  const state = ref(new Array<AiAgent>())

  /** 内置 Agent + 用户自建 Agent，供列表与选择器统一消费 */
  const all = computed<Array<AiAgent>>(() => [...BUILTIN_AGENTS, ...state.value])

  const options = computed<Array<CommonSelect>>(() => {
    return all.value.map((e) => ({ label: e.name, value: e.id }))
  })

  const init = async () => {
    state.value = await agentList()
  }

  init().then(() => logger.debug('AI 分组初始化成功'))

  /**
   * 新增或更新 Agent，返回落库后的 agent id。
   * 内置 Agent 只读：传入内置 id 时直接返回该 id，不做任何写入。
   */
  const put = async (form: AiAgentForm, id?: string): Promise<string> => {
    // 内置 Agent 只读，拒绝写入
    if (id && BUILTIN_IDS.has(id)) return id
    let resultId = id
    let add = true
    if (id) {
      const index = state.value.findIndex((item) => item.id === id)
      if (index > -1) {
        state.value[index] = {
          ...state.value[index],
          ...form,
          updatedAt: Date.now()
        }
        add = false
      }
    }
    if (add) {
      resultId = useSnowflake().nextId()
      state.value.push({
        ...form,
        id: resultId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        top: false
      })
    }
    await agentSave(state.value)
    // add 分支必然已赋值 resultId；更新分支 id 必存在
    return resultId as string
  }

  const remove = async (id: string) => {
    // 内置 Agent 只读，拒绝删除
    if (BUILTIN_IDS.has(id)) return
    state.value = state.value.filter((item) => item.id !== id)
    await agentSave(state.value)
  }

  const getById = (id?: string): AiAgent | undefined => {
    if (!id) return undefined
    return all.value.find((item) => item.id === id)
  }

  return {
    all,
    options,
    put,
    remove,
    getById
  }
})
