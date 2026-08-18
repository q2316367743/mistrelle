import { AiAgent } from '@/entity/ai'
import { getAgentPath } from '@/global/Constant'

// AI Agent 配置文件：~/.mistrelle/agent.json

/**
 * 读取全部用户自建 Agent；文件不存在时返回空数组
 */
export const agentList = async (): Promise<Array<AiAgent>> => {
  const path = getAgentPath()
  if (!window.preload.fs.existsSync(path)) return []
  return JSON.parse(await window.preload.fs.readTextFile(path))
}

/**
 * 全量写入用户自建 Agent 列表
 */
export const agentSave = async (list: Array<AiAgent>) => {
  await window.preload.fs.writeTextFile(getAgentPath(), JSON.stringify(list))
}
