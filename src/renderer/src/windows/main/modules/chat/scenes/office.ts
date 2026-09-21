import type { SceneDefinition } from './types'
import {
  createImageGenerateTool,
  hasImageGenerateAccess
} from '@/windows/main/modules/tool/components/design/imageGenerate'
import { createDesignDrawTool } from '@/windows/main/modules/tool/components/canvas/designDraw'
import OfficeAside from '@/windows/main/components/aside/OfficeAside.vue'

/**
 * 日常办公场景（默认家族，无子场景）：
 * 全能助手，无场景专属收窄；图片产出能力按登录态注入（design_draw 恒在 + 登录后 image_generate）。
 */
export const officeScene: SceneDefinition = {
  // 图片产出能力说明：design_draw（画布绘图，登录无关）恒在；image_generate（扩散生图，需登录）按登录态追加。
  // 门控动态组装，登录态稳定时前缀不变、可缓存
  prompt: () => {
    const lines = [
      '## 图片产出能力',
      '- 需要**精确排版 / 可控文案**的设计图（海报、封面、社交配图、知识卡片、图文排版）时，调用 design_draw(prompt, size?)——它以画布逐层绘制，画面干净、无明显 AI 感'
    ]
    if (hasImageGenerateAccess()) {
      lines.push('- 需要写实插画 / 照片质感的素材时，调用 image_generate(prompt)——扩散生图')
    }
    lines.push(
      '- 生成图片会直接展示在对话中；完成后简要说明结果并告知保存路径（path），失败如实告知，不反复重试'
    )
    return lines.join('\n')
  },
  tools: (ctx) =>
    hasImageGenerateAccess()
      ? [createImageGenerateTool(ctx), createDesignDrawTool()]
      : [createDesignDrawTool()],
  subAgentAllow: ['research'],
  aside: OfficeAside,
  asideProps: (ctx) => ({
    messages: ctx.messages,
    workspace: ctx.workspace,
    sandbox: ctx.sandbox,
    todos: ctx.todos,
    agentHistory: ctx.agentHistory,
    activeAgentId: ctx.activeAgentId
  })
}
