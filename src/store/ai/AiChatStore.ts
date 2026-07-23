import { AiChatDraft, AiChatItem } from '@/entity/ai'
import { defineStore } from 'pinia'
import { useLog } from '@/hooks/UseLog'
import {
  aiChatContentSet,
  aiChatIndexSave,
  aiChatList,
  aiChatRemove,
  buildChatChatPath,
  useChatName
} from '@/modules/chat'
import { useSnowflake } from '@/hooks'
import { TextContent, UserMessageContent } from '@/domain'

/**
 * 从 content 中提取首条消息预览文本
 */
const buildPreviewText = (content: UserMessageContent[]): string =>
  content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.data)
    .join('')

export const useAiChatStore = defineStore('ai-chat', () => {
  const logger = useLog({ name: 'store:ai-chat' })

  const state = ref<Array<AiChatItem>>([])

  const init = async () => {
    // 获取聊天列表
    state.value = await aiChatList()
  }

  init()
    .then(() => logger.debug('AI 聊天初始化成功'))
    .catch((e) => logger.error('AI 聊天初始化失败', e))

  const update = async (id: string, target: Partial<AiChatItem>) => {
    let index = state.value.findIndex((e) => e.id === id)
    if (index >= 0) {
      state.value[index] = {
        ...state.value[index],
        ...target,
        updatedAt: Date.now()
      }
      // 保存记录
      await aiChatIndexSave(state.value)
    }
  }

  const add = async (draft: AiChatDraft, systemPrompt: string) => {
    const id = useSnowflake().nextId()
    const now = Date.now()
    const preview = buildPreviewText(draft.content)
    const item: AiChatItem = {
      id,
      createdAt: now,
      updatedAt: now,
      name: preview.slice(0, 10),
      top: false,
      preview,
      previewModel: `${draft.provide}:${draft.model}`
    }
    state.value.push(item)
    // 保存索引
    await aiChatIndexSave(state.value)
    // 保存聊天内容（含草稿）
    await aiChatContentSet(buildChatChatPath(id), {
      updatedTime: now,
      systemPrompt,
      draft,
      messages: []
    })

    // 生成聊天消息
    logger.debug('AI 聊天消息生成')
    const newName = await useChatName(item.preview || '')
    await update(id, { name: newName })
    return id
  }

  const remove = async (id: string) => {
    let index = state.value.findIndex((e) => e.id === id)
    if (index >= 0) {
      state.value.splice(index, 1)
      await aiChatIndexSave(state.value)
      // 删除聊天记录
      await aiChatRemove(id)
    }
  }
  const rename = async (id: string, name: string) => {
    await update(id, { name: name })
  }

  return {
    state,

    add,
    rename,
    update,
    remove
  }
})
