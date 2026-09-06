import type { InjectionKey } from 'vue'
import type { HtmlElementItem } from '@/domain'

/**
 * HTML 设计稿侧边栏（HtmlDesignPreview）双击元素 → 聊天输入框（LChatSender）的桥接。
 * 由 useChatSession provide，HtmlDesignAside inject；携带设计稿版本号与元素描述链，
 * 让 AI 能按特征在源码中定位元素后用 html_write 整页重写修改。
 */
export type HtmlElementRef = HtmlElementItem

/** 元素树节点（Preview 从 iframe 渲染后的 body 构建，HtmlElementTree 消费） */
export interface HtmlTreeNode {
  /** body 相对索引路径（'0;1;2'），即选中定位的唯一标识 */
  id: string
  /** 单段标签：tag#id.class（树节点展示用） */
  label: string
  /** 完整描述链（注入聊天用）：祖先链 + 自身文本摘要 */
  chain: string
  children: HtmlTreeNode[]
}

/** useChatSession 提供的回调：将设计稿元素引用注入到聊天输入框 */
export const HTML_ELEMENT_PICK_KEY: InjectionKey<(ref: HtmlElementRef) => void> = Symbol('htmlElementPick')
