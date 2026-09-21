/**
 * 公众号排版内置风格预设（isSystem 只读）：元素 → 内联 style 映射。
 * claude / openai / google 承接原 gzh-Skills/space-wechat-layout 三风格；
 * card 参考应用内笔记卡片系统（CardStylePresets）的图文卡片审美：
 * 白底大圆角卡片容器、柔和红强调（strong / a / hr）、灰底引用块、大号加粗标题。
 * 视觉硬约束：15-16px、line-height 1.8-1.95、677px 内容宽、段间距约 1em、首行不缩进、圆角 ≤8px（卡片容器除外）。
 */
import type { GzhStyle } from './gzhTypes'

/** 元素 → 内联 style 映射（渲染器按 tagName 匹配，`pre code` 为成对键） */
export type GzhLayoutTheme = Record<string, string>

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif"

const MONO = "SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace"

/** 暖白编辑风：#fbfaf7 暖白底 + 深炭字，衬线标题、编辑气质；适合叙事 / 观点文 */
const CLAUDE_STYLES: GzhLayoutTheme = {
  section: `font-family:${FONT};font-size:15px;line-height:1.9;color:#3a3a38;letter-spacing:0.3px;background:#fbfaf7;padding:16px 14px;border-radius:8px;`,
  h1: `font-family:Georgia,'Songti SC','SimSun',serif;font-size:22px;line-height:1.5;font-weight:700;color:#1f1f1e;margin:8px 0 22px;`,
  h2: `font-family:Georgia,'Songti SC','SimSun',serif;font-size:18px;line-height:1.6;font-weight:700;color:#1f1f1e;margin:30px 0 14px;padding-left:10px;border-left:3px solid #c96442;`,
  h3: `font-size:16px;line-height:1.6;font-weight:700;color:#2f2f2d;margin:24px 0 10px;`,
  p: `margin:0 0 16px;`,
  strong: `font-weight:700;color:#1f1f1e;`,
  em: `font-style:italic;color:#5c5a55;`,
  del: `text-decoration:line-through;color:#8f8d86;`,
  a: `color:#c96442;text-decoration:none;border-bottom:1px solid #e5c1b3;`,
  blockquote: `margin:18px 0;padding:10px 14px;border-left:3px solid #d9d5cc;background:#f3f1ea;color:#5c5a55;font-size:14px;`,
  ul: `margin:0 0 16px;padding-left:22px;`,
  ol: `margin:0 0 16px;padding-left:22px;`,
  li: `margin:0 0 6px;`,
  code: `font-family:${MONO};font-size:13px;background:#efece4;color:#8f4b2b;padding:2px 5px;border-radius:4px;`,
  pre: `margin:16px 0;padding:12px 14px;background:#2b2a27;color:#e8e6df;font-size:13px;line-height:1.7;border-radius:8px;overflow-x:auto;`,
  'pre code': `display:block;background:none;color:inherit;padding:0;font-size:13px;`,
  table: `width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;`,
  th: `border:1px solid #d9d5cc;background:#f3f1ea;padding:8px 10px;text-align:left;font-weight:700;`,
  td: `border:1px solid #d9d5cc;padding:8px 10px;`,
  img: `display:block;max-width:100%;border-radius:8px;margin:16px auto;`,
  hr: `border:none;border-top:1px solid #d9d5cc;margin:28px 0;`
}

/** 纯白文档风：黑灰层级（#0d0d0d / #6e6e6e），层级靠字号与留白，克制装饰；适合技术 / 教程 */
const OPENAI_STYLES: GzhLayoutTheme = {
  section: `font-family:${FONT};font-size:15px;line-height:1.85;color:#333333;`,
  h1: `font-size:22px;line-height:1.5;font-weight:700;color:#0d0d0d;margin:8px 0 20px;`,
  h2: `font-size:17px;line-height:1.6;font-weight:700;color:#0d0d0d;margin:32px 0 12px;padding-bottom:6px;border-bottom:1px solid #ececec;`,
  h3: `font-size:15px;line-height:1.6;font-weight:700;color:#0d0d0d;margin:24px 0 10px;`,
  p: `margin:0 0 15px;`,
  strong: `font-weight:700;color:#0d0d0d;`,
  em: `font-style:italic;color:#6e6e6e;`,
  del: `text-decoration:line-through;color:#9b9b9b;`,
  a: `color:#0d0d0d;text-decoration:none;border-bottom:1px solid #b9b9b9;`,
  blockquote: `margin:16px 0;padding:2px 0 2px 14px;border-left:2px solid #d0d0d0;color:#6e6e6e;`,
  ul: `margin:0 0 15px;padding-left:22px;`,
  ol: `margin:0 0 15px;padding-left:22px;`,
  li: `margin:0 0 6px;`,
  code: `font-family:${MONO};font-size:13px;background:#f5f5f5;color:#0d0d0d;padding:2px 5px;border-radius:4px;`,
  pre: `margin:16px 0;padding:12px 14px;background:#f7f7f7;border:1px solid #ececec;color:#0d0d0d;font-size:13px;line-height:1.7;border-radius:8px;overflow-x:auto;`,
  'pre code': `display:block;background:none;color:inherit;padding:0;font-size:13px;`,
  table: `width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;`,
  th: `border:1px solid #ececec;background:#fafafa;padding:8px 10px;text-align:left;font-weight:700;`,
  td: `border:1px solid #ececec;padding:8px 10px;`,
  img: `display:block;max-width:100%;margin:16px auto;`,
  hr: `border:none;border-top:1px solid #ececec;margin:28px 0;`
}

/** 卡片模块风：白底 + 圆角卡片分组，小节四色轮换标记（渲染器特判 id=google）；适合数据 / 对比文 */
const GOOGLE_STYLES: GzhLayoutTheme = {
  section: `font-family:${FONT};font-size:15px;line-height:1.85;color:#202124;`,
  h1: `font-size:22px;line-height:1.5;font-weight:700;color:#202124;margin:8px 0 20px;`,
  h2: `font-size:17px;line-height:1.6;font-weight:700;color:#1a73e8;margin:32px 0 12px;padding:8px 12px;background:#f1f6fd;border-radius:8px;`,
  h3: `font-size:15px;line-height:1.6;font-weight:700;color:#202124;margin:24px 0 10px;`,
  p: `margin:0 0 15px;`,
  strong: `font-weight:700;color:#202124;`,
  em: `font-style:italic;color:#5f6368;`,
  del: `text-decoration:line-through;color:#9aa0a6;`,
  a: `color:#1a73e8;text-decoration:none;`,
  blockquote: `margin:16px 0;padding:12px 14px;background:#f8f9fa;border-radius:8px;color:#5f6368;`,
  ul: `margin:0 0 15px;padding-left:22px;`,
  ol: `margin:0 0 15px;padding-left:22px;`,
  li: `margin:0 0 6px;`,
  code: `font-family:${MONO};font-size:13px;background:#f1f3f4;color:#202124;padding:2px 5px;border-radius:4px;`,
  pre: `margin:16px 0;padding:12px 14px;background:#f8f9fa;border:1px solid #dadce0;color:#202124;font-size:13px;line-height:1.7;border-radius:8px;overflow-x:auto;`,
  'pre code': `display:block;background:none;color:inherit;padding:0;font-size:13px;`,
  table: `width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;`,
  th: `border:1px solid #dadce0;background:#f8f9fa;padding:8px 10px;text-align:left;font-weight:700;`,
  td: `border:1px solid #dadce0;padding:8px 10px;`,
  img: `display:block;max-width:100%;border-radius:8px;margin:16px auto;`,
  hr: `border:none;border-top:1px solid #dadce0;margin:28px 0;`
}

/** 图文卡片风：白底 16px 圆角卡片容器、柔和红强调（strong / a / hr）、灰底引用块、大号加粗标题；参考笔记卡片系统审美 */
const CARD_STYLES: GzhLayoutTheme = {
  section: `font-family:${FONT};font-size:15px;line-height:1.75;color:#3a3a3a;background:#ffffff;border-radius:16px;padding:24px 22px;`,
  h1: `font-size:22px;line-height:1.4;font-weight:700;color:#1f1f1f;margin:8px 0 18px;`,
  h2: `font-size:18px;line-height:1.5;font-weight:700;color:#1f1f1f;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #ff5c5c;`,
  h3: `font-size:16px;line-height:1.5;font-weight:700;color:#1f1f1f;margin:22px 0 10px;`,
  p: `margin:0 0 14px;`,
  strong: `font-weight:700;color:#ff5c5c;`,
  em: `font-style:italic;color:#666666;`,
  del: `text-decoration:line-through;color:#b5b5b5;`,
  a: `color:#ff5c5c;text-decoration:none;border-bottom:1px solid #ffd2d2;`,
  blockquote: `margin:14px 0;padding:10px 12px;background:#f6f6f6;border-left:3px solid #d0d0d0;border-radius:4px;color:#666666;font-size:14px;`,
  ul: `margin:0 0 14px;padding-left:22px;`,
  ol: `margin:0 0 14px;padding-left:22px;`,
  li: `margin:0 0 6px;`,
  code: `font-family:${MONO};font-size:13px;background:rgba(128,128,128,.12);color:#333333;padding:2px 5px;border-radius:4px;`,
  pre: `margin:14px 0;padding:12px;background:rgba(128,128,128,.12);color:#333333;font-size:13px;line-height:1.7;border-radius:8px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;`,
  'pre code': `display:block;background:none;color:inherit;padding:0;font-size:13px;`,
  table: `width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;`,
  th: `border:1px solid #eeeeee;background:#fafafa;padding:8px 10px;text-align:left;font-weight:700;color:#1f1f1f;`,
  td: `border:1px solid #eeeeee;padding:8px 10px;`,
  img: `display:block;max-width:100%;border-radius:8px;margin:14px auto;`,
  hr: `border:none;height:2px;width:40%;background:#ff5c5c;margin:24px auto;`
}

/** 内置预设（id 固定；isSystem 只读，用户与 AI 均不可改删） */
export const GZH_LAYOUT_PRESETS: ReadonlyArray<GzhStyle> = [
  {
    id: 'claude',
    name: '暖白编辑风',
    description: '暖白底衬线标题，编辑气质；适合叙事 / 观点文',
    isSystem: true,
    styles: CLAUDE_STYLES,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'openai',
    name: '纯白文档风',
    description: '黑灰层级克制装饰，文档气质；适合技术 / 教程',
    isSystem: true,
    styles: OPENAI_STYLES,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'google',
    name: '卡片模块风',
    description: '小节四色卡片标记；适合数据 / 对比文',
    isSystem: true,
    styles: GOOGLE_STYLES,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'card',
    name: '图文卡片风',
    description: '白底圆角卡片 + 柔和红强调，参考笔记卡片审美；适合种草 / 清单体',
    isSystem: true,
    styles: CARD_STYLES,
    createdAt: 0,
    updatedAt: 0
  }
]
