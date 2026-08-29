/**
 * 文生图域 Drizzle schema（生成记录）。
 *
 * 约定：
 * - 一行 = 一次生成任务，状态机 pending → success / failed（渲染侧驱动）。
 * - path 为图片文件绝对路径（按月分桶 ~/.mistrelle/image/generate/{yyyy-MM}/{id}.png），
 *   pending 时即为预定路径；删除记录时由渲染侧联动删文件。
 * - model 为生成时的模型名快照（设置中的默认生图模型后期变化不影响历史记录展示）。
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { ImageGenerateStatus } from '~/ipc/dbChannels'

export const imageGenerations = sqliteTable(
  'image_generate',
  {
    id: text('id').primaryKey(),
    prompt: text('prompt').notNull(),
    model: text('model'),
    size: text('size'),
    path: text('path'),
    width: integer('width'),
    height: integer('height'),
    /** 任务状态：pending / success / failed */
    status: text('status').$type<ImageGenerateStatus>().notNull(),
    /** 失败原因（status=failed 时存在） */
    error: text('error'),
    createdAt: integer('created_at').notNull()
  },
  (t) => [index('idx_image_generate_created').on(t.createdAt)]
)
