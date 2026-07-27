import { onMounted, ref } from 'vue'
import { useAiAgentStore } from '@/store'
import { toolMap } from '@/modules/tool'
import { localSkillList, LocalSkill } from '@/modules/skill'

export const useAgentToolLabels = () => {
  const agentStore = useAiAgentStore()
  const skillMap = ref<Map<string, LocalSkill>>(new Map())

  onMounted(async () => {
    const list = await localSkillList()
    skillMap.value = new Map(list.map((s) => [s.dirName, s]))
  })

  const agentLabel = (id: string) =>
    agentStore.state.find((a) => a.id === id)?.name ?? id

  const toolLabel = (name: string) => toolMap[name]?.label ?? name

  return { agentLabel, toolLabel, skillMap }
}
