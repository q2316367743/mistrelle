import { getAppData2Design } from '@/global/Constant'
import { AiDesignStyle, AiDesignStyleItem } from '@/entity'

// ~/.mistrelle/design/index.json
export const buildDesignStyleIndexPath = () =>
  window.preload.path.join(getAppData2Design(), 'index.json')

// ~/.mistrelle/design/design-{id}.json
export const buildDesignStylePath = (id: string) =>
  window.preload.path.join(getAppData2Design(), `design-${id}.json`)

const ensureDesignDir = async () => {
  const folder = getAppData2Design()
  if (!(await window.preload.fs.existsSync(folder))) {
    await window.preload.fs.mkdir(folder)
  }
}

/**
 * 读取风格索引（index.json），目录 / 文件不存在时自动初始化
 */
export const designStyleList = async (): Promise<Array<AiDesignStyleItem>> => {
  const indexPath = buildDesignStyleIndexPath()
  if (!(await window.preload.fs.existsSync(indexPath))) {
    await ensureDesignDir()
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(indexPath))
}

export const designStyleListSave = async (list: Array<AiDesignStyleItem>) => {
  await ensureDesignDir()
  await window.preload.fs.writeTextFile(buildDesignStyleIndexPath(), JSON.stringify(list))
}

/**
 * 读取单条完整风格（design-{id}.json）
 */
export const designStyleGet = async (id: string): Promise<AiDesignStyle | undefined> => {
  const path = buildDesignStylePath(id)
  if (!(await window.preload.fs.existsSync(path))) return undefined
  return JSON.parse(await window.preload.fs.readTextFile(path))
}

export const designStyleSave = async (style: AiDesignStyle) => {
  await ensureDesignDir()
  await window.preload.fs.writeTextFile(buildDesignStylePath(style.id), JSON.stringify(style))
}

export const designStyleRemove = async (id: string) => {
  const path = buildDesignStylePath(id)
  if (await window.preload.fs.existsSync(path)) {
    await window.preload.fs.rm(path)
  }
}
