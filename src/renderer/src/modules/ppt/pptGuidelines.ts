/**
 * POM XML 语法指南注册表：供 ppt_guidelines 工具按需加载。
 * 内容与 docs/ppt/02-pom-xml-guide.md 同步维护，经 ?raw 打包进应用，
 * 避免把完整指南塞进固定 system 提示词（保持 prompt 前缀稳定可缓存）。
 */
import pomXmlGuide from './guidelines/pom-xml-guide.md?raw'

export const PPT_GUIDELINE_TOPICS = ['pom-xml', 'workflow'] as const

export type PptGuidelineTopic = (typeof PPT_GUIDELINE_TOPICS)[number]

export const PPT_GUIDELINES: Record<PptGuidelineTopic, string> = {
  /** POM XML 语法速查（节点 / 布局 / 铁律 / batch_edit 规范） */
  'pom-xml': pomXmlGuide,
  /** 端到端工作流：创建 → 编辑 → 校验 → 导出 */
  workflow: [
    '## PPT 工作流',
    '1. ppt_create 创建新 PPT（自动生成标题页骨架，返回版本号）',
    '2. 用 ppt_batch_edit 按页编辑：先规划整体结构（封面 / 目录 / 内容页 / 结尾），再逐页添加',
    '3. 需要查看当前 XML 结构用 ppt_read；定位某页预览用 ppt_select',
    '4. 语法不确定时先 ppt_guidelines("pom-xml") 查询，再提交 batch_edit，避免整批回滚',
    '5. 中途可用 ppt_export_pptx / ppt_export_png 导出给用户确认',
    '6. 每次编辑都会生成新版本文件，全部版本在侧边栏可选择查看'
  ].join('\n')
}
