import { buildProjectDirPath } from './ProjectService'
import { aiChatContentSet } from '@/modules/chat'
import { AiChatContent } from '@/entity/ai'
import { ProjectChat } from '@/entity/project'
import { ChatRequestParams } from '@/modules/chat'
import { useSnowflake } from '@/hooks'
import { TextContent, UserMessageContent } from '@/domain'

// --------------------------------- 路径构建 ---------------------------------

// ~/.mistrelle/project/{pid}/tasks
export const buildProjectTaskDirPath = (projectId: string) =>
  window.preload.path.join(buildProjectDirPath(projectId), 'tasks')

// ~/.mistrelle/project/{pid}/tasks/index.json
export const buildProjectTaskIndexPath = (projectId: string) =>
  window.preload.path.join(buildProjectTaskDirPath(projectId), 'index.json')

// ~/.mistrelle/project/{pid}/tasks/{taskId}
export const buildProjectTaskPath = (projectId: string, taskId: string) =>
  window.preload.path.join(buildProjectTaskDirPath(projectId), taskId)

// ~/.mistrelle/project/{pid}/tasks/{taskId}/index.json（任务内容）
export const buildProjectTaskContentPath = (projectId: string, taskId: string) =>
  window.preload.path.join(buildProjectTaskPath(projectId, taskId), 'index.json')

// ~/.mistrelle/project/{pid}/tasks/{taskId}/files（沙盒根目录）
export const buildProjectTaskSandboxPath = (projectId: string, taskId: string) =>
  window.preload.path.join(buildProjectTaskPath(projectId, taskId), 'files')

// --------------------------------- CRUD ---------------------------------

/**
 * 读取项目任务索引
 */
export const projectTaskList = async (projectId: string): Promise<Array<ProjectChat>> => {
  const dir = buildProjectTaskDirPath(projectId)
  const indexPath = buildProjectTaskIndexPath(projectId)
  if (!window.preload.fs.existsSync(dir)) {
    await window.preload.fs.mkdir(dir, true)
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  if (!window.preload.fs.existsSync(indexPath)) {
    await window.preload.fs.writeTextFile(indexPath, JSON.stringify([]))
    return []
  }
  return JSON.parse(await window.preload.fs.readTextFile(indexPath))
}

export const projectTaskIndexSave = async (projectId: string, list: Array<ProjectChat>) => {
  await window.preload.fs.writeTextFile(buildProjectTaskIndexPath(projectId), JSON.stringify(list))
}

/**
 * 从 content 中提取首条消息预览文本
 */
const buildPreviewText = (content: UserMessageContent[]): string =>
  content
    .filter((c): c is TextContent => c.type === 'text')
    .map((c) => c.data)
    .join('')

/**
 * 创建项目任务：建立目录骨架 + 写入内容 + 追加索引
 * 返回 taskId
 */
export const projectTaskCreate = async (
  projectId: string,
  params: ChatRequestParams
): Promise<string> => {
  const taskId = useSnowflake().nextId()
  const now = Date.now()
  const taskDir = buildProjectTaskPath(projectId, taskId)
  const sandboxDir = buildProjectTaskSandboxPath(projectId, taskId)

  // 建立目录骨架：files/inputs、files/outputs、files/tmp
  await window.preload.fs.mkdir(taskDir, true)
  await Promise.all([
    window.preload.fs.mkdir(window.preload.path.join(sandboxDir, 'inputs'), true),
    window.preload.fs.mkdir(window.preload.path.join(sandboxDir, 'outputs'), true),
    window.preload.fs.mkdir(window.preload.path.join(sandboxDir, 'tmp'), true)
  ])

  // 写入任务内容（AiChatContent 结构）
  const content: AiChatContent = {
    updatedTime: now,
    draft: params,
    agentId: params.agentId || '',
    workspace: params.workspace || '',
    messages: [],
    mode: params.mode
  }
  await aiChatContentSet(buildProjectTaskContentPath(projectId, taskId), content)

  // 追加索引
  const preview = buildPreviewText(params.message.content)
  const item: ProjectChat = {
    id: taskId,
    createdAt: now,
    updatedAt: now,
    name: preview.slice(0, 10),
    preview,
    previewModel: `${params.message.provide}:${params.message.model}`
  }
  const list = await projectTaskList(projectId)
  list.push(item)
  await projectTaskIndexSave(projectId, list)

  return taskId
}
