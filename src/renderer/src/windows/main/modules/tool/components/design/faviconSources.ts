/**
 * 网站图标来源适配器 + 打分机制。
 *
 * 多个免费 favicon 服务返回格式不同（svg / ico / png），每个来源声明期望格式，
 * 落盘时用对应扩展名。来源会因网络 / 服务变动而失效，故引入打分机制：
 * 失败扣分、成功回分，按分数降序尝试，坏来源被持续降权，避免反复请求失败接口。
 */

export interface FaviconSource {
  /** 来源唯一 id（打分持久化 key） */
  id: string
  /** 展示名 */
  label: string
  /** 期望返回的图片格式（决定落盘文件扩展名） */
  format: 'svg' | 'ico' | 'png'
  /** 由域名构造来源 URL */
  buildUrl: (domain: string) => string
}

export const FAVICON_SOURCES: FaviconSource[] = [
  {
    id: 'favicon-im',
    label: 'a.favicon.im（SVG）',
    format: 'svg',
    buildUrl: (domain) => `https://a.favicon.im/${domain}`
  },
  {
    id: 'faviconsnap',
    label: 'faviconsnap.com',
    format: 'ico',
    buildUrl: (domain) => `https://faviconsnap.com/api/favicon?url=${domain}`
  },
  {
    id: 'google-s2',
    label: 'Google S2 favicons',
    format: 'png',
    buildUrl: (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  },
  {
    id: 'duckduckgo',
    label: 'DuckDuckGo favicon',
    format: 'ico',
    buildUrl: (domain) => `https://icons.duckduckgo.com/ip3/${domain}.ico`
  }
]

// ─── 打分机制 ──────────────────────────────────────────────

const SCORE_KEY = 'mistrelle:design:source-score'
const MAX_SCORE = 100
const MIN_SCORE = 0
const FAIL_PENALTY = 20
const SUCCESS_BONUS = 5

type ScoreMap = Record<string, number>

const loadScores = (): ScoreMap => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SCORE_KEY) : null
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') return parsed as ScoreMap
    }
  } catch {
    // 读取失败静默忽略，按默认分处理
  }
  return {}
}

let scores: ScoreMap = loadScores()

const persistScores = (): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SCORE_KEY, JSON.stringify(scores))
    }
  } catch {
    // 写入失败静默忽略（如隐私模式），本次会话内存分仍生效
  }
}

/** 来源当前分数（缺省按满分） */
export const sourceScore = (id: string): number => scores[id] ?? MAX_SCORE

/** 来源获取成功：小幅度回分，但不超过满分 */
export const reportSourceSuccess = (id: string): void => {
  scores[id] = Math.min(MAX_SCORE, (scores[id] ?? MAX_SCORE) + SUCCESS_BONUS)
  persistScores()
}

/** 来源获取失败：扣分，最低扣到 0（不彻底禁用，仅降权） */
export const reportSourceFailure = (id: string): void => {
  scores[id] = Math.max(MIN_SCORE, (scores[id] ?? MAX_SCORE) - FAIL_PENALTY)
  persistScores()
}

/** 按分数降序返回来源（稳定的坏来源靠后，减少无谓重试） */
export const orderedFaviconSources = (): FaviconSource[] =>
  [...FAVICON_SOURCES].sort((a, b) => sourceScore(b.id) - sourceScore(a.id))
