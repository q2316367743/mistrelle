import { PERSONALIZE_FILE_CONFIG, type PersonalizeScope } from '@/entity'
import { getSoulDir, getSoulFilePath } from '@/global/Constant'

interface PersonalizeSection {
  title: string
  scope: PersonalizeScope
  content: string
}

/** 读取单个个性化设定文件；文件不存在或为空返回空串 */
export const readPersonalizeFile = async (file: string): Promise<string> => {
  const path = getSoulFilePath(file)
  if (!window.preload.fs.existsSync(path)) return ''
  try {
    return (await window.preload.fs.readTextFile(path)).trim()
  } catch {
    return ''
  }
}

/** 全量覆写单个个性化设定文件（清空时写入空文件，对应段落自动跳过注入） */
export const writePersonalizeFile = async (file: string, content: string): Promise<void> => {
  await window.preload.fs.mkdir(getSoulDir(), true)
  await window.preload.fs.writeTextFile(getSoulFilePath(file), content.trim())
  sectionsCache = undefined
}

const fileMtime = async (file: string): Promise<number> => {
  const path = getSoulFilePath(file)
  if (!window.preload.fs.existsSync(path)) return 0
  try {
    return (await window.preload.fs.stat(path)).mtime
  } catch {
    return 0
  }
}

let sectionsCache: { signature: string; sections: PersonalizeSection[] } | undefined

/**
 * 段落作用域与场景作用域匹配：all 恒可见；专属段落仅在场景声明了同名作用域时可见。
 * 场景未声明 personalizeScope（如 office）时只见 all 段落——按声明匹配，无隐式兜底。
 */
const matchScope = (scope: PersonalizeScope, sceneScope: PersonalizeScope | undefined): boolean =>
  scope === 'all' || scope === sceneScope

/**
 * 组装注入主 Agent 稳定 system 前缀的个性化设定段：
 * 五个 soul/*.md 按各自 scope 过滤（IDENTITY/AGENT/USER 全类型，DESIGN 仅 design，WRITE 仅 writing）。
 * 按全部文件 mtime 签名缓存（用户手编内容极少变化，不破坏前缀缓存）；全部为空时返回空串。
 */
export const buildPersonalizePrompt = async (
  sceneScope?: Exclude<PersonalizeScope, 'all'>
): Promise<string> => {
  const signature = (
    await Promise.all(PERSONALIZE_FILE_CONFIG.map((config) => fileMtime(config.file)))
  ).join('|')
  if (!sectionsCache || sectionsCache.signature !== signature) {
    const sections: PersonalizeSection[] = []
    for (const config of PERSONALIZE_FILE_CONFIG) {
      const content = await readPersonalizeFile(config.file)
      if (content) sections.push({ title: config.title, scope: config.scope, content })
    }
    sectionsCache = { signature, sections }
  }
  const scoped = sectionsCache.sections.filter((section) => matchScope(section.scope, sceneScope))
  if (scoped.length === 0) return ''
  return [
    '## 个性化设定',
    '以下是用户为助手设定的个性化指令，请严格遵循：',
    ...scoped.map((section) => `### ${section.title}\n${section.content}`)
  ].join('\n\n')
}
