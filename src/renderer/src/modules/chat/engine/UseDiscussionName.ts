import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { createClient } from './ChatCommon'

const SYSTEM_PROMPT =
  '你是一个讨论主题命名器。根据用户抛出的议题或讨论内容，生成一个3-8个字的中文标题，概括讨论主题。直接输出标题，不要解释，不要标点，不要引号。'

/**
 * 讨论命名工具
 * > 参考 useChatName，依据讨论内容用 AI 生成讨论记录名称
 * @param content 讨论内容（议题或前几轮发言）
 * @return 讨论名称
 */
export const useDiscussionName = async (content: string): Promise<string> => {
  const { defaultQuickModel } = useSettingDefaultStore().state
  if (!defaultQuickModel) return content.substring(0, 24)
  const option = useSettingAiStore().optionMap.get(defaultQuickModel)
  if (!option) return content.substring(0, 24)

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
    return (title || content).substring(0, 24)
  } catch {
    return content.substring(0, 24)
  }
}
