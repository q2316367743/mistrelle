import { defineStore } from 'pinia'
import { AiAgent, AiAgentForm } from '@/entity/ai'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'
import { CommonSelect } from '@/domain'
import { BUILTIN_AGENTS } from '@/global/BuiltInAgent'
import { agentList, agentSave } from '@/windows/main/modules/agent/service/AiAgentService'
// 直连文件而非 '@/store'（index 会再导出本模块，经 index 会成环，同 DesignStyleStore 先例）
import { useAuthStore } from '@/windows/main/store/AuthStore'

/** 内置 Agent 的 id 集合，用于快速判定只读项 */
const BUILTIN_IDS: ReadonlySet<string> = new Set(BUILTIN_AGENTS.map((e) => e.id))

/**
 * 绑定会员能力的内置 Agent id：设计风格创建助手会创建 / 修改自定义设计风格，
 * 自定义设计风格为会员功能（features.extendedDesignStyles），故非会员隐藏该内置 Agent
 * （不可选、不可见；会员期内用它开过的历史会话经 getById 仍可继续，见 getById 注释）。
 */
const BUILTIN_AGENT_DESIGN_STYLE_ID = 'builtin:design-style'

export const useAiAgentStore = defineStore('ai-agent', () => {
  const logger = useLog({ name: 'store:ai-agent' })

  const state = ref(new Array<AiAgent>())

  /** 内置 Agent + 用户自建 Agent，供列表与选择器统一消费；非会员过滤会员专属内置 Agent */
  const all = computed<Array<AiAgent>>(() => {
    const unlocked = useAuthStore().features.extendedDesignStyles
    const builtins = unlocked
      ? BUILTIN_AGENTS
      : BUILTIN_AGENTS.filter((a) => a.id !== BUILTIN_AGENT_DESIGN_STYLE_ID)
    return [...builtins, ...state.value]
  })

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
    // 不在 all 中查找：all 会按会员档过滤「设计风格创建助手」，而会员期内用该 agent 开过的历史
    // 聊天（agentId 持久化）免费档仍需可继续 → 直接在全量底层查找（同 DesignStyleStore.getDetail
    // 保留渲染先例）。仅「新建 / 切换」入口经 all 不可见，达到隐藏语义。
    return (
      BUILTIN_AGENTS.find((item) => item.id === id) ?? state.value.find((item) => item.id === id)
    )
  }

  return {
    all,
    options,
    put,
    remove,
    getById
  }
})
