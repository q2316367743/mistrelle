import { getAppData2GzhStyle } from '@/global/Constant'
import type { GzhStyle, GzhStyleItem } from './gzhTypes'

// ~/.mistrelle/gzh-style/index.json
export const buildGzhStyleIndexPath = () =>
  window.preload.path.join(getAppData2GzhStyle(), 'index.json')

// ~/.mistrelle/gzh-style/gzh-style-{id}.json
export const buildGzhStylePath = (id: string) =>
  window.preload.path.join(getAppData2GzhStyle(), `gzh-style-${id}.json`)

const ensureGzhStyleDir = async () => {
  const folder = getAppData2GzhStyle()
  if (!window.preload.fs.existsSync(folder)) {
    await window.preload.fs.mkdir(folder, true)
  }
}

/** 读取风格索引（index.json），目录 / 文件不存在时自动初始化 */
export const gzhStyleList = async (): Promise<Array<GzhStyleItem>> => {
  const indexPath = buildGzhStyleIndexPath()
  if (!window.preload.fs.existsSync(indexPath)) {
    await ensureGzhStyleDir()
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(indexPath))
}

export const gzhStyleListSave = async (list: Array<GzhStyleItem>) => {
  await ensureGzhStyleDir()
  await window.preload.fs.writeTextFile(buildGzhStyleIndexPath(), JSON.stringify(list))
}

/** 读取单条完整风格（gzh-style-{id}.json） */
export const gzhStyleGet = async (id: string): Promise<GzhStyle | undefined> => {
  const path = buildGzhStylePath(id)
  if (!window.preload.fs.existsSync(path)) return undefined
  return JSON.parse(await window.preload.fs.readTextFile(path))
}

export const gzhStyleSave = async (style: GzhStyle) => {
  await ensureGzhStyleDir()
  await window.preload.fs.writeTextFile(buildGzhStylePath(style.id), JSON.stringify(style))
}

export const gzhStyleRemove = async (id: string) => {
  const path = buildGzhStylePath(id)
  if (window.preload.fs.existsSync(path)) {
    await window.preload.fs.rm(path)
  }
}
