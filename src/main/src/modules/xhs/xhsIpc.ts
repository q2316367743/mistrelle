/**
 * xhs 域 IPC handler（main 进程）：小红书热点取数。
 * 取数逻辑在同目录 xhsHotNotes.ts（统一网络出口 appAxios，集中在 main）。
 */
import { ipcMain } from 'electron'
import { XhsChannels } from '~/modules/xhs/xhsChannels'
import { fetchXhsHotNotes } from './xhsHotNotes'
import type { XhsHotNotesRequest } from '@common/types/xhs'

export function registerXhsIpc(): void {
  ipcMain.handle(XhsChannels.hotNotes, (_event, req: XhsHotNotesRequest) => fetchXhsHotNotes(req))
}
