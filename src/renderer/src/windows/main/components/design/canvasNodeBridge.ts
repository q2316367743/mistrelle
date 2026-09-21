import type { InjectionKey } from 'vue'
import type { CanvasItem } from '@/domain'

/**
 * 画布侧边栏（CanvasRenderer）双击节点 → 聊天输入框（LChatSender）的桥接。
 * 由 LChatEngine provide，CanvasRenderer inject；携带版本号与节点 id，让 AI 能 canvas_open(version) 定位节点。
 */
export type CanvasNodeRef = CanvasItem

/** LChatEngine 提供的回调：将画布节点引用注入到聊天输入框 */
export const CANVAS_NODE_PICK_KEY: InjectionKey<(ref: CanvasNodeRef) => void> = Symbol('canvasNodePick')
