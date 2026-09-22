/**
 * sharp 桥（preload）：图像处理的 IPC 薄封装（metadata/crop/去底/主色/遮盖）。
 * 实现位于 main（modules/sharp/image.ts + sharpIpc.ts）。
 */
import { ipcRenderer } from 'electron'
import {
  SharpChannels,
  type SharpRegion,
  type SharpColorMapResult,
  type SharpCoverOptions,
  type SharpMaskResult
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
    ipcRenderer.invoke(SharpChannels.colorMap, input, gridSize, top),
  /** 区域遮盖（马赛克 / 毛玻璃）：把区域内的像素替换为遮盖底图（原文件不变，产物写 output） */
  mask: (
    input: string,
    regions: SharpRegion[],
    output: string,
    cover?: SharpCoverOptions
  ): Promise<SharpMaskResult> =>
    ipcRenderer.invoke(SharpChannels.mask, input, regions, output, cover)
}
