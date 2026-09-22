/**
 * sharp IPC handler（main 进程）：原 inject.sharp 的 Electron 替代。
 */
import { ipcMain } from 'electron'
import {
  sharpMetadata,
  sharpCrop,
  sharpRemoveBackground,
  sharpColorMap,
  sharpMask
} from './image'
import { SharpChannels, type SharpCoverOptions, type SharpRegion } from '~/modules/sharp/sharpChannels'

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

  ipcMain.handle(
    SharpChannels.mask,
    (_event, input: string, regions: SharpRegion[], output: string, cover?: SharpCoverOptions) =>
      sharpMask(input, regions, output, cover)
  )
}
