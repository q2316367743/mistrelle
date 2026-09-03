/**
 * PNG 落盘（主进程）：渲染进程 canvas 绘制的 PNG dataURL → 解码写文件。
 * 单页 targetPath 为文件路径；多页为目录（每页 page-{n}.png，n 取 pages 对应页码）。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export const writePngFiles = async (
  images: string[],
  targetPath: string,
  pages: number[]
): Promise<string[]> => {
  const files: string[] = []
  for (let i = 0; i < images.length; i += 1) {
    const dataUrl = images[i]
    const page = pages[i] ?? i + 1
    const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
    const file =
      images.length === 1 ? targetPath : join(targetPath, `page-${page}.png`)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, Buffer.from(base64, 'base64'))
    files.push(file)
  }
  return files
}
