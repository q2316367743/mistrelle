import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { createClient } from './ChatCommon'

const SYSTEM_PROMPT = '你是一个聊天标题生成器。根据用户的第一条消息，生成一个3-8个字的中文标题，概括对话主题。直接输出标题，不要解释，不要标点，不要引号。'

/**
 * 聊天命名工具
 * > 根据用户的问题，生成聊天的命名
 * @param content 用户的问题
 * @return 聊天的命名
 */
export const useChatName = async (content: string): Promise<string> => {
  const { defaultQuickModel } = useSettingDefaultStore().state
  if (!defaultQuickModel) return content.substring(0, 10)
  const option = useSettingAiStore().optionMap.get(defaultQuickModel)
  if (!option) return content.substring(0, 10)

  try {
    const client = createClient(option.baseUrl, option.key)
    const response = await client.chat.completions.create({
      model: option.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content }
      ],
      stream: false
    })
    const title = response.choices?.[0]?.message?.content?.trim()
    return (title || content).substring(0, 10)
  } catch {
    return content.substring(0, 10)
  }
}
