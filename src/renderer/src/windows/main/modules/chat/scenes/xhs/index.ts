import type { SceneDefinition } from '../types'
import { createArticleTools } from '@/windows/main/modules/tool/components/article/articleTools'
import { createCanvasTools } from '@/windows/main/modules/tool/components/canvas/canvasTools'
import { createDesignTools } from '@/windows/main/modules/tool/components/design'
import { hasImageGenerateAccess } from '@/windows/main/modules/tool/components/design/imageGenerate'
import { hasRedfoxAccess, xhsHotTools } from '@/windows/main/modules/tool/components/xhs/xhsHotTools'
import { XHS_SKILLS } from './skills'
import { buildXhsScenePrompt } from './prompt'
import XhsAside from '@/windows/main/components/aside/writing/xhs/XhsAside.vue'

/**
 * 小红书场景（写作家族第四叶子，与公众号并列）：
 * - 文：发布文案 / 选题复用文章工作台（article_*，一篇笔记一个单元，type 用「小红书」）
 * - 图：画布画板（canvas_*）承载封面与多页图文卡片，**一页一个画布文档**，不用 HTML 引擎
 * - 素材：设计素材工具（image_generate 登录后注入 / 图像处理 / 图表 / 字体）
 * - 数据：红狐热点取数（xhs_hot_notes 配了 Key 才注入，提示词与工具同源门控）
 * - 方法论：xhs-* 内置 skill 十件（?raw 打包），按需 load_skill
 * 侧栏为小红书专属：正文工作台（复用 article 四件套）+ 覆盖整栏的画板面板（复用 canvas 侧栏）。
 */
export const xhsScene: SceneDefinition = {
  prompt: () =>
    buildXhsScenePrompt({
      hasImageGenerate: hasImageGenerateAccess(),
      hasRedfox: hasRedfoxAccess()
    }),
  skills: XHS_SKILLS,
  tools: (ctx) => [
    ...createArticleTools(ctx),
    ...createCanvasTools(ctx),
    ...createDesignTools(ctx),
    ...(hasRedfoxAccess() ? xhsHotTools : [])
  ],
  subAgentAllow: ['research', 'image'],
  personalizeScope: 'writing',
  sandboxDirs: () => ['outputs/articles', 'outputs/articles/drafts', 'outputs/articles/assets'],
  autoExpandAside: true,
  aside: XhsAside,
  asideProps: (ctx) => ({
    sandbox: ctx.sandbox,
    workspace: ctx.workspace,
    fullscreen: ctx.fullscreen,
    status: ctx.status
  })
}
