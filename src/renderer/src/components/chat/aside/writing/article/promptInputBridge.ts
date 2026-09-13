import type { InjectionKey } from 'vue'

export interface PromptInputOptions {
  /** 填入后是否立即发送（如「按风格重写」等需要直接执行的动作） */
  autoSend?: boolean
}

/**
 * 写作侧边栏快捷指令 → 聊天输入框（LChatSender）的桥接。
 * 由 useChatSession provide，写作侧边栏 inject；默认只注入不发送，用户可修改再发；
 * autoSend=true 时填入后立即发送（动作式指令）。
 * 与画布 / HTML 元素注入（CANVAS_NODE_PICK_KEY 等）同模式。
 */
export const PROMPT_INPUT_KEY: InjectionKey<(text: string, options?: PromptInputOptions) => void> =
  Symbol('promptInput')
