import type { InjectionKey } from 'vue'

/**
 * 写作侧边栏快捷指令 → 聊天输入框（LChatSender）的桥接。
 * 由 useChatSession provide，写作侧边栏 inject；注入后不自动发送，用户可修改再发。
 * 与画布 / HTML 元素注入（CANVAS_NODE_PICK_KEY 等）同模式。
 */
export const PROMPT_INPUT_KEY: InjectionKey<(text: string) => void> = Symbol('promptInput')
