/**
 * 内置设计参考注册表：供 canvas_guidelines 工具按需加载。
 * 内容改编自 docs/canvas/ardot-design-generator（平面设计方向），经 ?raw 打包进应用，
 * 避免把完整指南塞进固定 system 提示词（保持 prompt 前缀稳定可缓存）。
 */
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
  'poster',
  'book-cover',
  'album-cover',
  'social-media',
  'knowledge-card'
] as const

export type CanvasGuidelineTopic = (typeof CANVAS_GUIDELINE_TOPICS)[number]

export const CANVAS_GUIDELINES: Record<CanvasGuidelineTopic, string> = {
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
