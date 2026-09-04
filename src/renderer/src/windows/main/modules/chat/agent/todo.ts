import type { Ref } from 'vue'
import type { ToolFunction, TodoItem, TodoStatus } from '@/domain'
import { nanoid } from 'nanoid'

/** 单条待办列表的最大条数，防止模型一次性灌入过多待办 */
const MAX_TODO_COUNT = 20

const TODO_STATUSES: TodoStatus[] = ['pending', 'in_progress', 'completed']

/**
 * 构造"更新待办"工具（每轮按全量替换语义维护当前对话的待办清单）。
 * handler 闭包绑定到所在对话的 todos ref，实现跨轮次的状态延续；
 * 新项分配 id 并保留已存在项的 id / createdAt，避免列表刷新时 key 抖动。
 */
export const createTodoTool = (todosRef: Ref<TodoItem[]>): ToolFunction => ({
  name: 'update_todo',
  label: '更新待办',
  description:
    '维护当前对话的待办清单（全量替换）：传入你想要保留的完整待办列表，系统会以它作为最新状态。多步骤任务应使用本工具拆解并跟踪执行进度：拆分阶段创建待办（pending），开始执行某项时标记为 in_progress，完成后标记为 completed。',
  parameters: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: '完整的待办列表（会整体替换当前待办），最大 ' + MAX_TODO_COUNT + ' 条',
        items: {
          type: 'object',
          description: '单条待办',
          properties: {
            content: { type: 'string', description: '待办内容，一句话描述一个可验证的小目标' },
            status: {
              type: 'string',
              description: '待办状态，仅限以下取值之一：pending（未开始）、in_progress（进行中）、completed（已完成）'
            },
            id: { type: 'string', description: '已有待办的 id；新建项可省略，由系统生成' }
          },
          required: ['content', 'status']
        }
      }
    },
    required: ['todos']
  },
  risk: 'safe',
  handler: async (...params: unknown[]) => {
    const { todos } = params[0] as { todos?: unknown }
    if (!Array.isArray(todos)) return { error: 'todos 必须是数组' }
    if (todos.length > MAX_TODO_COUNT) {
      return { error: `待办数量超过上限（${MAX_TODO_COUNT} 条），请精简后再提交` }
    }

    const now = Date.now()
    const current = todosRef.value
    const next: TodoItem[] = []
    for (const raw of todos) {
      if (!raw || typeof raw !== 'object') return { error: '待办项必须是对象' }
      const item = raw as { content?: unknown; status?: unknown; id?: unknown }
      const content = typeof item.content === 'string' ? item.content.trim() : ''
      if (!content) return { error: '待办内容（content）不能为空' }
      const status = item.status as TodoStatus
      if (!TODO_STATUSES.includes(status)) {
        return { error: `非法状态 ${String(item.status)}，仅支持 ${TODO_STATUSES.join(' / ')}` }
      }
      const existed = typeof item.id === 'string'
        ? current.find((e) => e.id === item.id)
        : current.find((e) => e.content === content)
      next.push({
        id: existed?.id ?? nanoid(),
        content,
        status,
        createdAt: existed?.createdAt ?? now,
        updatedAt: now
      })
    }
    todosRef.value = next
    return { todos: next, message: '待办清单已更新' }
  }
})

/** 组装待办指令提示词，追加到稳定 system 前缀，指导模型何时 / 如何使用待办 */
export const buildTodoPrompt = (): string =>
  '## 待办清单\n' +
  '对于多步骤任务，请使用 update_todo 工具维护一份待办清单来拆解与跟踪进度：\n' +
  '- 任务开始或拆解阶段先创建待办（pending），开始执行某项时标记 in_progress，完成后标记 completed。\n' +
  '- 每次调用传入完整的待办列表（全量替换），不要只传增量；同一项复用其 id。\n' +
  '- status 仅限 pending / in_progress / completed。\n' +
  '- 待办用于追踪进度，不必在最终总结中重复罗列全部明细。\n' +
  '- 计划模式下，请先用待办清单呈现执行计划（全部 pending 或按阶段拆分），供用户确认后再执行。'
