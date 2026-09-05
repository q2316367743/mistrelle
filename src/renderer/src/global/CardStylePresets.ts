import { AiCardStyle } from '@/entity'
import { normalizeCardStyleProps } from './card-style-props'

/**
 * 内置卡片风格预设（isSystem = true 不可编辑 / 删除）：
 * 代码常量维护、不落盘，样式键值对均为注册表合法值（normalizeCardStyleProps 补齐全部键），
 * 由 CardStyleStore 与用户自建风格合并展示。
 */
const preset = (
  id: string,
  name: string,
  description: string,
  tags: Array<string>,
  props: Record<string, string>
): AiCardStyle => ({
  id,
  name,
  description,
  tags,
  props: normalizeCardStyleProps(props),
  isSystem: true,
  createdAt: 0,
  updatedAt: 0
})

export const CARD_STYLE_PRESETS: Array<AiCardStyle> = [
  preset('preset-card-plain', '简约白', '白底黑字的通用清爽风，适合知识分享与清单', ['简约', '通用'], {
    'card.background': '#ffffff',
    'card.color': '#333333',
    'card.accent': '#111111',
    'title.color': '#111111',
    'title.weight': '800',
    'body.highlight': '#fff176'
  }),
  preset('preset-card-cream', '奶油便签', '奶油底色配暖棕文字，像一张手写便签', ['温暖', '手账'], {
    'card.background': '#fff9ec',
    'card.color': '#5c4a32',
    'card.radius': '20px',
    'card.accent': '#e8a33d',
    'title.color': '#4a3418',
    'title.font': 'Kaiti SC',
    'body.color': '#5c4a32',
    'body.highlight': '#ffe3a9',
    'quote.background': '#fdf1d8',
    'quote.barColor': '#e8a33d',
    'quote.color': '#8a6d3b'
  }),
  preset('preset-card-mint', '薄荷清新', '薄荷绿底的轻盈风格，适合打卡与记录', ['清新', '记录'], {
    'card.background': '#effaf3',
    'card.color': '#284b3a',
    'card.accent': '#2f9e63',
    'title.color': '#1e4d3b',
    'body.highlight': '#c9eed8',
    'quote.background': '#e0f3e7',
    'quote.barColor': '#2f9e63',
    'quote.color': '#3d6b52',
    'image.radius': '12px'
  }),
  preset('preset-card-peach', '蜜桃粉', '柔和的蜜桃色调，适合生活分享与美妆', ['柔和', '生活'], {
    'card.background': '#fff0ee',
    'card.color': '#5c3a36',
    'card.radius': '24px',
    'card.accent': '#f26d6d',
    'title.color': '#47201c',
    'title.align': 'center',
    'body.highlight': '#ffd9d2',
    'quote.background': '#ffe4df',
    'quote.barColor': '#f26d6d',
    'quote.color': '#8a5450'
  }),
  preset('preset-card-night', '暗夜霓虹', '深色底配高亮文字，夜间阅读舒适', ['深色', '科技'], {
    'card.background': '#1e2230',
    'card.color': '#c9cede',
    'card.accent': '#7c9bff',
    'title.color': '#eef1fa',
    'body.color': '#c9cede',
    'body.highlight': 'rgba(124,155,255,0.28)',
    'quote.background': '#2a3044',
    'quote.barColor': '#7c9bff',
    'quote.color': '#9aa5c4',
    'image.border': '#39415a'
  }),
  preset('preset-card-magazine', '杂志刊头', '衬线大标题的杂志质感，适合观点与书摘', ['杂志', '文艺'], {
    'card.background': '#faf9f6',
    'card.color': '#2b2b2b',
    'card.padding': '40px',
    'card.accent': '#111111',
    'title.color': '#111111',
    'title.font': 'Songti SC',
    'title.size': '30px',
    'title.align': 'center',
    'title.spacing': '20px',
    'quote.background': '#f0eee8',
    'quote.barColor': '#111111',
    'quote.color': '#555555'
  })
]
