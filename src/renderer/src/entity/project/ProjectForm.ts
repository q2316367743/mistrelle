import type { Project } from './Project'

export interface ProjectForm {
  name: string
  prompt: string
  agents: Array<string>
  skills: Array<string>
  tools: Array<string>
}

export const buildProjectForm = (): ProjectForm => ({
  name: '',
  prompt: '',
  agents: [],
  skills: [],
  tools: []
})

export const toProjectForm = (p: Project): ProjectForm => ({
  name: p.name,
  prompt: p.prompt,
  agents: p.agents,
  skills: p.skills,
  tools: p.tools
})
