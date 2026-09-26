/**
 * xhs 桥（preload）：小红书热点取数。
 * 实现在 main（xhsHotNotes.ts，统一网络出口 appAxios），渲染层经此薄桥调用；
 * 鉴权 Key 由渲染层随请求传入（凭证唯一真源在设置里）。
 */
import { ipcRenderer } from 'electron'
import { XhsChannels } from './xhsChannels'
import type { XhsHotNotesRequest, XhsHotNotesResponse } from '@common/types/xhs'

export const xhsApi = {
  /** 小红书热门笔记：按关键词拉取近期高互动笔记（总数 / 相关搜索词 / 评分排序条目） */
  hotNotes: (req: XhsHotNotesRequest): Promise<XhsHotNotesResponse> =>
    ipcRenderer.invoke(XhsChannels.hotNotes, req)
}
