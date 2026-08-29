/**
 * zip 模块（preload）：原 src-utools/src/zip.js 的 TS 移植。
 * adm-zip 封装，无特权，留在 preload 侧。
 */
import AdmZip from 'adm-zip'
import { statSync, existsSync, mkdirSync } from 'node:fs'
import { basename } from 'node:path'

export const zipApi = {
  /**
   * 压缩：传入路径数组和 zip 路径，将路径的文件/文件夹压缩到指定路径
   * @param zipPath 压缩文件路径
   * @param paths 要压缩的文件/文件夹路径数组
   */
  compress(zipPath: string, paths: string[]): Promise<unknown> {
    const zip = new AdmZip()
    paths.forEach((item) => {
      const stats = statSync(item)
      if (stats.isDirectory()) {
        zip.addLocalFolder(item, basename(item))
      } else {
        zip.addLocalFile(item)
      }
    })
    return zip.writeZipPromise(zipPath)
  },

  /**
   * 解压：传入 zip 路径和解压目录，将 zip 的内容解压到指定目录下；目标目录不存在则自动创建
   * @param zipPath zip 文件路径
   * @param targetDir 解压目录
   */
  extract(zipPath: string, targetDir: string): Promise<void> {
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }
    const zip = new AdmZip(zipPath)
    return zip.extractAllToAsync(targetDir, true)
  }
}
