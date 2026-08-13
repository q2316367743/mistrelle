/**
 * PPT 文件层：输出目录 / 文件命名 / JSON 解析（PptStore 与侧边栏共用）。
 * 存储契约：一个 PPT = 一个文件 `outputs/{name}.ppt.json`，内容为 PptJsonDoc
 * （name / createdAt / updatedAt / theme / slide 页面数组）。
 */
import type { PptJsonDoc } from './pptTypes'

const PPT_FILE_REGEX = /^(.+)\.ppt\.json$/

/** 从文件名解析 PPT 标识（id = 去扩展名的 name），非 PPT 文件返回 null */
export const parsePptFile = (name: string): string | null => {
  const match = PPT_FILE_REGEX.exec(name)
  return match ? match[1] : null
}

export const buildPptFileName = (name: string): string => `${name}.ppt.json`

/** 输出目录：~/.mistrelle/workspace/{chatId}/outputs */
export const buildPptOutputsDir = (sandboxDir: string): string =>
  window.preload.path.join(sandboxDir, 'outputs')

export const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * 解析文件文本为 PptJsonDoc（JSON.parse + 轻量结构校验）。
 * slide 每页必须是元素数组（空数组 = 空白页）；深层节点结构由 TypeBox 校验保证。
 */
export const parseDoc = (text: string): { error: string } | { doc: PptJsonDoc } => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { error: `PPT JSON 解析失败：${errorText(err)}` }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'PPT JSON 结构非法：根节点应为对象' }
  }
  const doc = parsed as { name?: unknown; slide?: unknown }
  if (typeof doc.name !== 'string') return { error: 'PPT JSON 结构非法：缺少 name 字段' }
  if (!Array.isArray(doc.slide) || doc.slide.some((page) => !Array.isArray(page))) {
    return { error: 'PPT JSON 结构非法：slide 应为数组，且每页为元素数组' }
  }
  return { doc: parsed as PptJsonDoc }
}
