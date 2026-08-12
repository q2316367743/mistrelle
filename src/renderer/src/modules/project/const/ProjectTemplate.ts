import type { ProjectForm } from '@/entity'

export interface ProjectTemplate {
  key: string
  name: string
  description: string
  icon: string
  prefill: () => ProjectForm
}

const build = (overrides: Partial<ProjectForm>): ProjectForm => ({
  name: '',
  prompt: '',
  agents: [],
  skills: [],
  tools: [],
  ...overrides
})

export const PROJECT_TEMPLATES: Array<ProjectTemplate> = [
  {
    key: 'product-prd',
    name: '产品需求全流程',
    description: '从需求规划、PRD 到研发测试验收',
    icon: 'FileIcon',
    prefill: () =>
      build({
        prompt:
          '你是一名产品经理，负责产品需求的全流程管理，包括需求规划、PRD 撰写、研发跟踪、测试验收与上线复盘。'
      })
  },
  {
    key: 'market-research',
    name: '市场调研与竞品分析',
    description: '深度调研、竞品拆解、报告评审',
    icon: 'ChartIcon',
    prefill: () =>
      build({
        prompt:
          '你是一名市场分析师，负责深度市场调研、竞品拆解、报告撰写与评审，输出结构化的洞察与建议。'
      })
  },
  {
    key: 'team-knowledge',
    name: '团队知识库',
    description: '持续沉淀 SOP、经验和 FAQ',
    icon: 'BookIcon',
    prefill: () =>
      build({
        prompt:
          '你是一名知识管理助理，负责持续沉淀团队的 SOP、经验与 FAQ，输出清晰可检索的知识条目。'
      })
  },
  {
    key: 'project-delivery',
    name: '项目交付',
    description: '管理客户需求、计划、风险和周报',
    icon: 'CalendarIcon',
    prefill: () =>
      build({
        prompt:
          '你是一名项目交付经理，负责管理客户需求、项目计划、风险识别与周报输出，保障项目按时按质交付。'
      })
  },
  {
    key: 'bug-tracking',
    name: 'Bug 跟踪/测试验收',
    description: '持续跟踪 Bug，统一测试用例和验收结论',
    icon: 'BugIcon',
    prefill: () =>
      build({
        prompt:
          '你是一名测试工程师，负责 Bug 持续跟踪、测试用例编写与验收结论输出，保障产品质量稳定可靠。'
      })
  }
]
