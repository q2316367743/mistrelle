import { getAppData2CardStyle } from '@/global/Constant'
import { AiCardStyle, AiCardStyleItem } from '@/entity'

// ~/.mistrelle/card-style/index.json
export const buildCardStyleIndexPath = () =>
  window.preload.path.join(getAppData2CardStyle(), 'index.json')

// ~/.mistrelle/card-style/card-style-{id}.json
export const buildCardStylePath = (id: string) =>
  window.preload.path.join(getAppData2CardStyle(), `card-style-${id}.json`)

const ensureCardStyleDir = async () => {
  const folder = getAppData2CardStyle()
  if (!window.preload.fs.existsSync(folder)) {
    await window.preload.fs.mkdir(folder)
  }
}

/**
 * 读取风格索引（index.json），目录 / 文件不存在时自动初始化
 */
export const cardStyleList = async (): Promise<Array<AiCardStyleItem>> => {
  const indexPath = buildCardStyleIndexPath()
  if (!window.preload.fs.existsSync(indexPath)) {
    await ensureCardStyleDir()
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(indexPath))
}

export const cardStyleListSave = async (list: Array<AiCardStyleItem>) => {
  await ensureCardStyleDir()
  await window.preload.fs.writeTextFile(buildCardStyleIndexPath(), JSON.stringify(list))
}

/**
 * 读取单条完整风格（card-style-{id}.json）
 */
export const cardStyleGet = async (id: string): Promise<AiCardStyle | undefined> => {
  const path = buildCardStylePath(id)
  if (!window.preload.fs.existsSync(path)) return undefined
  return JSON.parse(await window.preload.fs.readTextFile(path))
}

export const cardStyleSave = async (style: AiCardStyle) => {
  await ensureCardStyleDir()
  await window.preload.fs.writeTextFile(buildCardStylePath(style.id), JSON.stringify(style))
}

export const cardStyleRemove = async (id: string) => {
  const path = buildCardStylePath(id)
  if (window.preload.fs.existsSync(path)) {
    await window.preload.fs.rm(path)
  }
}
