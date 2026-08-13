/**
 * PPT 经验指南注册表：供 ppt_guidelines 工具按需加载。
 * 内容为官方 POM 文档转写 + SlideNode JSON 结构速查，经 ?raw 打包进应用，
 * 避免把完整指南塞进固定 system 提示词（保持 prompt 前缀稳定可缓存）。
 */
import layoutGuide from './guidelines/layout.md?raw'
import nodesGuide from './guidelines/nodes.md?raw'
import stylingGuide from './guidelines/styling.md?raw'
import jsonGuide from './guidelines/json.md?raw'
import workflowGuide from './guidelines/workflow.md?raw'

export const PPT_GUIDELINE_TOPICS = ['layout', 'nodes', 'styling', 'json', 'workflow'] as const

export type PptGuidelineTopic = (typeof PPT_GUIDELINE_TOPICS)[number]

export const PPT_GUIDELINES: Record<PptGuidelineTopic, string> = {
  /** 布局系统：flexbox 规则 + 五种页面布局模式模板 */
  layout: layoutGuide,
  /** 节点参考：20 种节点属性速查 + 使用要点 */
  nodes: nodesGuide,
  /** 样式经验：配色 / 字体 / 边框阴影渐变 / 最佳实践 */
  styling: stylingGuide,
  /** SlideNode JSON 存储结构与导出速查 */
  json: jsonGuide,
  /** 端到端工作流 */
  workflow: workflowGuide
}
