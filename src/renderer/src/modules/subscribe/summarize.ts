import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { createClient } from '@/modules/chat'

const SUMMARY_SYSTEM_PROMPT =
  '你是一个内容总结助手。请用简洁清晰的中文，对用户提供的文本进行总结，输出结构化要点：核心观点、关键信息、结论。避免无关细节和重复。'

/**
 * 调用 AI 聊天对文本进行总结（非流式）。
 * 优先使用「默认总结模型」，未配置时兜底「默认快速模型」。
 */
export const summarizeText = async (text: string): Promise<string> => {
  const { defaultSummaryModel, defaultQuickModel } = useSettingDefaultStore().state
  const modelKey = defaultSummaryModel || defaultQuickModel
  if (!modelKey) {
    throw new Error('未配置默认总结模型，请在「设置-默认设置」中配置')
  }
  const option = useSettingAiStore().optionMap.get(modelKey)
  if (!option) {
    throw new Error('默认总结模型已失效，请重新在「设置-默认设置」中配置')
  }

  const client = createClient(option.baseUrl, option.key)
  const response = await client.chat.completions.create({
    model: option.model,
    messages: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: text }
    ],
    stream: false
  })
  const content = response.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('总结失败：模型未返回内容')
  }
  return content
}
