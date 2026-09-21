/**
 * 公众号 aside 直呼 LLM 封装（非流式）：正文质检等侧边栏能力共用。
 * 模型口径同主链路「最后一条 user 消息的 provide:model」（当前聊天模型唯一真源），
 * 经 SettingAiStore.optionMap 解析请求参数后走 createChatCompletion。
 */
import { createChatCompletion } from '@/windows/main/modules/ai'
import { useSettingAiStore } from '@/windows/main/store/setting/SettingAiStore'
import type { ChatMessage } from '@/domain'

/** 当前对话模型引用（provide:model 复合键，解析失败时 model 为空串） */
export interface GzhModelRef {
  model: string
  provide: string
}

/** 从消息列表末尾向前取最后一条 user 消息的模型信息（与 agentTools.findLastUserModel 同口径） */
export const resolveGzhModel = (messages: ChatMessage[]): GzhModelRef => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role === 'user') return { model: msg.model, provide: msg.provide }
  }
  return { model: '', provide: '' }
}

/**
 * 公众号 aside 直呼补全（非流式），返回助手文本。
 * 模型未配置或已失效时抛错，由调用方提示用户。
 */
export const gzhComplete = async (params: {
  model: GzhModelRef
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<string> => {
  const store = useSettingAiStore()
  if (!store.ready) await store.initPromise
  const option = store.optionMap.get(`${params.model.provide}:${params.model.model}`)
  if (!option) throw new Error('当前对话模型不存在或未启用，请在 AI 设置中检查。')
  const result = await createChatCompletion({
    baseURL: option.baseUrl,
    apiKey: option.key,
    format: option.format ?? 'chat',
    model: option.model,
    builtin: option.builtin,
    messages: [{ role: 'system', content: params.system }, ...params.messages]
  })
  return result.content.trim()
}

/**
 * 从模型输出提取 JSON 对象：容忍 ```json 围栏与前后杂文，
 * 取首个 { 到末个 } 的片段解析；解析失败返回 undefined。
 */
export const extractGzhJson = <T>(text: string): T | undefined => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1)) as T
  } catch {
    return undefined
  }
}
