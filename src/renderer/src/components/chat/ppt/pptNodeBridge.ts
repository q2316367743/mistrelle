import type { InjectionKey } from 'vue'

/**
 * PPT 侧边栏（PptSlideViewer）单击选中节点 + 按钮确认 → 聊天输入框（LChatSender）的桥接。
 * 由 LChatEngine provide，PptSlideViewer inject；携带 ppt 文件 id / 页码 / 节点 id，
 * 让 AI 能 ppt_open 打开后用 ppt_edit_element 精准编辑该节点。
 */
export interface PptNodeRef {
  /** PPT 文件标识（id，即文件名） */
  pptId: string
  /** 页码（1 起始） */
  slide: number
  /** 节点 id（SlideNode 顶层 id） */
  nodeId: string
  /** 节点摘要文本（Text 内容或空串），仅用于展示 */
  label?: string
}

/** LChatEngine 提供的回调：将 PPT 节点引用注入到聊天输入框 */
export const PPT_NODE_PICK_KEY: InjectionKey<(ref: PptNodeRef) => void> = Symbol('pptNodePick')
