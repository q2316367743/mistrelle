import { defineStore } from 'pinia'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { AiTool } from '@/entity/ai'

export const useAiToolStore = defineStore('ai:tool', () => {
  const state = useUtoolsDbAsync<Array<AiTool>>(LocalNameEnum.LIST_AI_TOOL, [])

  return { state }
})
