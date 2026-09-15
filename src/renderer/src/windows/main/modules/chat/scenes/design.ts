import type { SceneDefinition, SceneAsideContext } from './types'
import { buildDesignCanvasPrompt } from '@/windows/main/modules/canvas'
import { createCanvasTools } from '@/windows/main/modules/tool/components/canvas/canvasTools'
import { buildDesignHtmlPrompt } from '@/windows/main/modules/designHtml'
import { createDesignHtmlTools } from '@/windows/main/modules/tool/components/designHtml/designHtmlTools'
import { createDesignTools } from '@/windows/main/modules/tool/components/design'
import { hasImageGenerateAccess } from '@/windows/main/modules/tool/components/design/imageGenerate'
import { hasHumanizeAccess } from '@/windows/main/modules/tool/components/design/humanize'
import DesignAside from '@/windows/main/components/chat/aside/design/DesignAside.vue'
import HtmlDesignAside from '@/windows/main/components/chat/aside/design/HtmlDesignAside.vue'

/**
 * 设计创意场景（双渲染引擎叶子，创建时锁定）：
 * canvas = leafer 图层树画布；html = 自包含 HTML 设计稿（iframe 预览 + snapdom 导出）。
 * 两引擎提示词独立成文，设计素材工具共用（createDesignTools）。
 * 设计风格提示词（designStylePrompt）由会话水合注入 ctx，附加在引擎提示词之后。
 */

/** 与 createDesignTools 同源判断：登录后提示词注入 image_generate 生图增强规则 + humanize_text 去 AI 味规则 */
const designPromptOptions = () => ({
  hasImageGenerate: hasImageGenerateAccess(),
  hasHumanize: hasHumanizeAccess()
})

/** design 场景 aside 公共 props（DesignAside / HtmlDesignAside 同构） */
const designAsideProps = (ctx: SceneAsideContext) => ({
  sandbox: ctx.sandbox,
  workspace: ctx.workspace,
  fullscreen: ctx.fullscreen,
  status: ctx.status
})

export const canvasScene: SceneDefinition = {
  prompt: (ctx) =>
    [buildDesignCanvasPrompt(designPromptOptions()), ctx.designStylePrompt]
      .filter(Boolean)
      .join('\n\n'),
  tools: (ctx) => [...createCanvasTools(ctx), ...createDesignTools(ctx)],
  subAgentAllow: ['research'],
  personalizeScope: 'design',
  autoExpandAside: true,
  aside: DesignAside,
  asideProps: designAsideProps
}

export const htmlScene: SceneDefinition = {
  prompt: (ctx) =>
    [buildDesignHtmlPrompt(designPromptOptions()), ctx.designStylePrompt]
      .filter(Boolean)
      .join('\n\n'),
  tools: (ctx) => [...createDesignHtmlTools(ctx), ...createDesignTools(ctx)],
  subAgentAllow: ['research'],
  personalizeScope: 'design',
  autoExpandAside: true,
  aside: HtmlDesignAside,
  asideProps: designAsideProps
}
