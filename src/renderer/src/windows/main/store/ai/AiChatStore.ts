import type { ChatRequestParams } from '@/windows/main/modules/chat'
import { AiChatItem } from '@/entity/ai'
import { defineStore } from 'pinia'
import { useLog } from '@/hooks/UseLog'
import {
  aiChatContentSet,
  aiChatList,
  aiChatRemove,
  aiChatSandbox,
  aiChatSandboxRemove,
  aiChatUpsertItem,
  buildChatMainKey,
  getSandboxDir,
  destroyChatSession,
  useChatName
} from '@/windows/main/modules/chat'
import { useSnowflake } from '@/hooks'
import { destroyCanvasStore } from '@/windows/main/modules/canvas'
import { destroyDesignHtmlStore } from '@/windows/main/modules/designHtml'
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
    const index = state.value.findIndex((e) => e.id === id)
    if (index >= 0) {
      state.value[index] = {
        ...state.value[index],
        ...target,
        updatedAt: Date.now()
      }
      // 保存记录（行级 upsert）
      await aiChatUpsertItem(state.value[index])
    }
  }

  const add = async (params: ChatRequestParams) => {
    const { message, workspace, agentId } = params
    const id = useSnowflake().nextId()
    const now = Date.now()
    const preview = buildPreviewText(message.content)
    const item: AiChatItem = {
      id,
      createdAt: now,
      updatedAt: now,
      name: preview.slice(0, 10),
      top: false,
      privacy: params.privacy ?? false,
      workspace: workspace || '',
      type: params.type
    }
    state.value.push(item)
    // 保存索引（行级 upsert）+ 创建沙盒目录（产物用）+ 保存聊天内容（含草稿，消息体在 DB）
    await aiChatUpsertItem(item)
    await aiChatSandbox(id, {
      type: params.type,
      writingScene: params.writingScene,
      designScene: params.designScene
    })
    await aiChatContentSet(buildChatMainKey(id), {
      updatedTime: now,
      draft: params,
      agentId: agentId || '',
      workspace: workspace || '',
      messages: [],
      mode: params.mode,
      type: params.type,
      writingScene: params.writingScene,
      designScene: params.designScene,
      designStyleId: params.designStyleId
    })

    // 生成聊天消息
    logger.debug('AI 聊天消息生成')
    useChatName(preview)
      .then((newName) => update(id, { name: newName }))
      .catch((e) => logger.error('AI 聊天消息生成失败', e))
      .finally(() => logger.debug('AI 聊天消息生成完成'))
    return id
  }

  const remove = async (id: string) => {
    let index = state.value.findIndex((e) => e.id === id)
    if (index >= 0) {
      state.value.splice(index, 1)
      // 销毁内存会话，避免后台请求与常驻持久化残留
      destroyChatSession(buildChatMainKey(id))
      // 删除聊天记录（DB 级联删列表行 + 消息体 + 子代理消息体）
      await aiChatRemove(id)
      // 删除沙盒目录
      await aiChatSandboxRemove(id)
      // 释放画布 / HTML 设计稿 store（沙盒目录已删除，避免残留内存与失效状态）
      destroyCanvasStore(getSandboxDir(id))
      destroyDesignHtmlStore(getSandboxDir(id))
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
