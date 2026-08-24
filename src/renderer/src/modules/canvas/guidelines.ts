/**
 * 内置设计参考注册表：供 canvas_guidelines 工具按需加载。
 * 内容改编自 docs/canvas/ardot-design-generator（平面设计方向），经 ?raw 打包进应用，
 * 避免把完整指南塞进固定 system 提示词（保持 prompt 前缀稳定可缓存）。
 * styles 目录由 DESIGN_STYLE_PRESETS 运行时生成，不维护第二份 markdown 风格库。
 */
import { getDesignStyleCategoryLabel } from '@/entity'
import { DESIGN_STYLE_PRESETS } from '@/global/DesignStylePresets'
import styleGuide from './guidelines/style-guide.md?raw'
import composition from './guidelines/composition.md?raw'
import typography from './guidelines/typography.md?raw'
import operations from './guidelines/operations.md?raw'
import workflow from './guidelines/workflow.md?raw'
import poster from './guidelines/poster.md?raw'
import bookCover from './guidelines/book-cover.md?raw'
import albumCover from './guidelines/album-cover.md?raw'
import socialMedia from './guidelines/social-media.md?raw'
import knowledgeCard from './guidelines/knowledge-card.md?raw'
import imageGeneration from './guidelines/image-generation.md?raw'

export const CANVAS_GUIDELINE_TOPICS = [
  'style-guide',
  'composition',
  'typography',
  'operations',
  'workflow',
  'image-generation',
  'styles',
  'poster',
  'book-cover',
  'album-cover',
  'social-media',
  'knowledge-card'
] as const

export type CanvasGuidelineTopic = (typeof CANVAS_GUIDELINE_TOPICS)[number]

const STATIC_GUIDELINES: Record<Exclude<CanvasGuidelineTopic, 'styles'>, string> = {
  'style-guide': styleGuide,
  composition,
  typography,
  operations,
  workflow,
  'image-generation': imageGeneration,
  poster,
  'book-cover': bookCover,
  'album-cover': albumCover,
  'social-media': socialMedia,
  'knowledge-card': knowledgeCard
}

/** 从内置预设生成精简风格目录（签名手法级，不含全文 CSS） */
export const buildDesignStylesCatalog = (): string => {
  const lines: string[] = [
    '# 设计风格目录（内置预设）',
    '',
    '> 数据源：`DESIGN_STYLE_PRESETS`（产品 UI 6 套 + 平面配方 32 套）。',
    '> 用法：用户未指定风格时按内容气质挑 3~4 个报出；指定后必须落地该条 **签名手法**，只换色板不算。',
    '> 会话若已锁定 designStyleId，以注入的「设计风格」段落为准，本目录作对照。',
    '',
    '| id | 名称 | 别名 | 签名手法 | 分类 | 常用画幅 | 适合 |',
    '|----|------|------|----------|------|----------|------|'
  ]
  for (const s of DESIGN_STYLE_PRESETS) {
    const aliases = (s.aliases ?? []).join(' / ') || '—'
    const formats = (s.preferredFormats ?? []).join(' / ') || '—'
    const signature = (s.signature ?? '').replace(/\|/g, '\\|')
    const suitable = (s.suitableFor ?? '—').replace(/\|/g, '\\|')
    lines.push(
      `| ${s.id} | ${s.name} | ${aliases} | ${signature} | ${getDesignStyleCategoryLabel(s.category)} | ${formats} | ${suitable} |`
    )
  }
  lines.push(
    '',
    '## 推荐话术（未指定风格时）',
    '- **技术 / 开发者**：工程蓝图 / 终端 CLI / 瑞士国际主义 / 粗野主义',
    '- **生活方式 / 阅读**：日式侘寂 / 杂志编辑部 / 档案手稿 / 中式水墨',
    '- **活动 / 青年**：双色印刷 Riso / 孟菲斯 / 街头海报 / 美漫波普',
    '- **产品 / SaaS**：极简产品 / 玻璃拟态 / 极光 / Apple 苹果',
    '- **高端 / 仪式**：奢侈品黑金 / 装饰艺术 / 电影海报 / 国潮',
    '',
    '库外风格用四步法：取 4 色 → 定字体反差 → 找签名手法 → 定留白 35/55/70。'
  )
  return lines.join('\n')
}

/** 兼容旧引用：静态 topic 映射（不含动态 styles） */
export const CANVAS_GUIDELINES: Record<Exclude<CanvasGuidelineTopic, 'styles'>, string> =
  STATIC_GUIDELINES

/** 按 topic 取指南正文；styles 为运行时生成 */
export const getCanvasGuidelineContent = (topic: string): string | undefined => {
  if (topic === 'styles') return buildDesignStylesCatalog()
  if (topic in STATIC_GUIDELINES) {
    return STATIC_GUIDELINES[topic as Exclude<CanvasGuidelineTopic, 'styles'>]
  }
  return undefined
}
