/**
 * sharp IPC handler（main 进程）：原 inject.sharp 的 Electron 替代。
 */
import { ipcMain } from 'electron'
import {
  sharpMetadata,
  sharpCrop,
  sharpRemoveBackground,
  sharpColorMap
} from '$/sharp/image'
import { SharpChannels, type SharpRegion } from '~/ipc/channels'

export function registerSharpIpc(): void {
  ipcMain.handle(SharpChannels.metadata, (_event, input: string | Uint8Array) =>
    sharpMetadata(input)
  )

  ipcMain.handle(
    SharpChannels.crop,
    (_event, input: string, region: SharpRegion, output: string) =>
      sharpCrop(input, region, output)
  )

  ipcMain.handle(
    SharpChannels.removeBackground,
    (_event, input: string, options: { color?: string | number[]; tolerance?: unknown }, output: string) =>
      sharpRemoveBackground(input, options, output)
  )

  ipcMain.handle(
    SharpChannels.colorMap,
    (_event, input: string, gridSize: number, top: number) =>
      sharpColorMap(input, gridSize, top)
  )
}
