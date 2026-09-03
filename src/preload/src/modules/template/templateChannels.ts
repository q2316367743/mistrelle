/**
 * HTML 模板域通道常量与载荷类型（preload 桥与 main handler 共用）。
 * 独立于 channels.ts（其已贴 500 行红线，新域通道独立成文件，同 dbChannels 先例）。
 * 模板文件位于 resources/templates/<name>.ejs，渲染实现在 main（service/templateRender.ts）。
 */
export const TemplateChannels = {
  render: 'template:render'
} as const

export interface TemplateRenderParams {
  /** 模板名（resources/templates/<name>.ejs，仅允许小写字母 / 数字 / 连字符） */
  name: string
  /** 模板数据（渲染侧预处理好的 view model，模板只做展示循环） */
  data: Record<string, unknown>
}
