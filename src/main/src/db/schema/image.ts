/**
 * 文生图域 Drizzle schema（生成记录）。
 *
 * 约定：
 * - 一行 = 一次生成任务，状态机 pending → success / failed（渲染侧驱动）。
 * - path 为图片文件绝对路径（按月分桶 ~/.mistrelle/image/generate/{yyyy-MM}/{id}.png），
 *   pending 时即为预定路径；删除记录时由渲染侧联动删文件。
 * - model 为生成时的模型名快照（设置中的默认生图模型后期变化不影响历史记录展示）。
 * - style_name 为生成时的设计风格名快照（同 model，仅记录出处，风格后期改名 / 删除不影响历史）。
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { ImageGenerateStatus } from '~/modules/db/dbChannels'

export const imageGenerations = sqliteTable(
  'image_generate',
  {
    id: text('id').primaryKey(),
    prompt: text('prompt').notNull(),
    model: text('model'),
    /** 生成时的设计风格名快照；未选风格为空 */
    styleName: text('style_name'),
    size: text('size'),
    path: text('path'),
    width: integer('width'),
    height: integer('height'),
    /** 任务状态：pending / success / failed */
    status: text('status').$type<ImageGenerateStatus>().notNull(),
    /** 失败原因（status=failed 时存在） */
    error: text('error'),
    /**
     * 异步任务型（中转站返回 task_id 需轮询）的远端任务标识；
     * 同步模式 / 提交即失败为空。非空说明该失败可能可「续轮询」同一任务。
     */
    taskId: text('task_id'),
    /** 远端任务查询绝对截止时间（首次轮询起点 + 5 分钟窗口），续轮询判定窗口用 */
    pollMaxAt: integer('poll_max_at'),
    /**
     * 远端任务是否已确认终态（查询返回 failed / cancelled，或 completed 但缺图）；
     * true 时任务不可能再出图，UI 不再显示「重试」。null=非异步任务型或尚未确认。
     */
    taskTerminal: integer('task_terminal', { mode: 'boolean' }),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('idx_image_generate_created').on(t.createdAt)]
)
