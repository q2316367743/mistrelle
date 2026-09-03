/**
 * sharp 桥（preload）：图像四操作（metadata/crop/去底/主色）的 IPC 薄封装（原 inject.ts 的 sharp 段）。
 * 实现位于 main（modules/sharp/image.ts + sharpIpc.ts）。
 */
import { ipcRenderer } from 'electron'
import {
  SharpChannels,
  type SharpRegion,
  type SharpColorMapResult
} from './sharpChannels'

export const sharpApi = {
  metadata: (input: string | Uint8Array): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke(SharpChannels.metadata, input),
  crop: (
    input: string,
    region: SharpRegion,
    output: string
  ): Promise<{ width?: number; height?: number }> =>
    ipcRenderer.invoke(SharpChannels.crop, input, region, output),
  removeBackground: (
    input: string,
    options: { color?: string | number[]; tolerance?: unknown } | undefined,
    output: string
  ): Promise<{ width: number; height: number; removedPixels: number }> =>
    ipcRenderer.invoke(SharpChannels.removeBackground, input, options, output),
  colorMap: (input: string, gridSize: number, top: number): Promise<SharpColorMapResult> =>
    ipcRenderer.invoke(SharpChannels.colorMap, input, gridSize, top)
}
