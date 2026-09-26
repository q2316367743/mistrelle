/**
 * 小红书域类型（window.preload.xhs）：热门笔记取数桥。
 * 契约与 main / preload 三方共用，集中在 @common/types/xhs。
 */
import type { XhsHotNotesRequest, XhsHotNotesResponse } from '@common/types/xhs'

declare interface XhsApi {
  /** 小红书热门笔记取数（红狐 API，鉴权 Key 由渲染层传入，实现位于 main） */
  hotNotes: (req: XhsHotNotesRequest) => Promise<XhsHotNotesResponse>
}
