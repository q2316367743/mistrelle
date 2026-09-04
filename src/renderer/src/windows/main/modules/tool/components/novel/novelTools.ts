import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/windows/main/modules/tool/toolPolicy'
import type { ChatTypeToolContext } from '@/windows/main/modules/chat/chatType'
import { NOVEL_FILES } from './novelTypes'
import { buildNovelRoot, getNovelStore } from './novelStore'
import type { NovelStatus, NovelUpdatePatch } from './novelTypes'

const STATUSES = new Set<string>(['draft', 'writing', 'done'])

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/**
 * 返回短篇小说场景工具实例（按 workspace / sandbox 定位项目根），供 WritingSceneConfig 场景级注入。
 * 项目根：{workspace}/novels/（有工作空间）或 {sandbox}/outputs/novels/（无工作空间）。
 * 设定文件（outline / setting / style）由 AI 用 file_write 直接写对应文件路径；
 * 角色卡为「## 角色名」分段结构，用 novel_character_upsert 结构化增改。
 */
export const createNovelTools = (ctx: ChatTypeToolContext): ToolFunction[] => {
  const store = () => getNovelStore(buildNovelRoot(ctx.getWorkspace(), ctx.getSandboxDir()))

  return [
    {
      name: 'novel_init',
      label: '初始化小说项目',
      description: '初始化短篇小说创作项目（创建 / 读取项目索引），可指定项目标题。通常首次进入短篇场景时调用',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '项目标题（可选，用于侧边栏辨识）' }
        }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { title } = params[0] as { title?: string }
        const project = await store().init(title)
        return { success: true, title: project.title, novelCount: project.novels.length }
      }
    },
    {
      name: 'novel_list',
      label: '列出小说',
      description: '列出项目内全部小说（标题 / 题材 / 状态 / 摘要），写作前先看现状',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => {
        await store().refresh()
        return { novels: store().listNovels() }
      }
    },
    {
      name: 'novel_create',
      label: '新建小说',
      description:
        '新建一部短篇小说：创建子目录（含 story / outline / characters / setting / style 五个骨架文件）并登记到项目索引，返回小说 id 与各文件路径。后续用 file_write 写入各文件、用 novel_character_upsert 增改角色、用 novel_update 更新状态',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '小说标题' },
          genre: { type: 'string', description: '题材（科幻 / 言情 / 悬疑 / 都市 / 奇幻等）' },
          summary: { type: 'string', description: '一句话创意 / 摘要（可选）' }
        },
        required: ['title', 'genre']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { title, genre, summary } = params[0] as {
          title?: string
          genre?: string
          summary?: string
        }
        if (!title || !genre) return { error: 'title 与 genre 不能为空' }
        const item = await store().createNovel({ title, genre, summary })
        return {
          id: item.id,
          dir: item.dir,
          files: Object.values(NOVEL_FILES).map((file) => `${item.dir}/${file}`)
        }
      }
    },
    {
      name: 'novel_update',
      label: '更新小说信息',
      description: '更新小说元信息（标题 / 题材 / 状态 / 摘要）。状态：draft（草稿）/ writing（写作中）/ done（已完稿）',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '小说 id（novel_list 获取）' },
          title: { type: 'string', description: '标题' },
          genre: { type: 'string', description: '题材' },
          status: { type: 'string', description: '状态：draft / writing / done' },
          summary: { type: 'string', description: '一句话创意 / 摘要' }
        },
        required: ['id']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, title, genre, status, summary } = params[0] as {
          id?: string
          title?: string
          genre?: string
          status?: string
          summary?: string
        }
        if (!id) return { error: 'id 不能为空' }
        const patch: NovelUpdatePatch = {}
        if (str(title)) patch.title = title
        if (str(genre)) patch.genre = genre
        if (status && STATUSES.has(status)) patch.status = status as NovelStatus
        if (str(summary)) patch.summary = summary
        if (Object.keys(patch).length === 0) return { error: '没有可更新的字段' }
        const item = await store().updateNovel(id, patch)
        return { id: item.id, updated: patch }
      }
    },
    {
      name: 'novel_read',
      label: '读取小说正文',
      description: '读取指定小说的完整 markdown 正文（story.md），供改写 / 续写 / 分析前查看',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '小说 id（novel_list 获取）' } },
        required: ['id']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { id } = params[0] as { id?: string }
        if (!id) return { error: 'id 不能为空' }
        try {
          const content = await store().readStory(id)
          return { content }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'novel_read_setting',
      label: '读取小说设定',
      description:
        '汇总读取指定小说的全部设定文件（角色 / 大纲 / 背景设定 / 文风），写作正文前务必调用以保证设定一致。返回每个文件的完整 markdown 内容',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '小说 id（novel_list 获取）' } },
        required: ['id']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { id } = params[0] as { id?: string }
        if (!id) return { error: 'id 不能为空' }
        try {
          return await store().readSetting(id)
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'novel_character_upsert',
      label: '新增 / 更新角色卡',
      description:
        '新增或更新一个角色卡：以「## 角色名」为段落写入 characters.md（已存在则整体替换该段，否则追加到末尾）。content 为角色卡正文（推荐：身份 / 外貌 / 性格 / 背景 / 与其他角色的关系 / 成长弧线）',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '小说 id（novel_list 获取）' },
          name: { type: 'string', description: '角色名（作为段落标题）' },
          content: { type: 'string', description: '角色卡正文（不需要重复角色名标题）' }
        },
        required: ['id', 'name', 'content']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, name, content } = params[0] as { id?: string; name?: string; content?: string }
        if (!id || !name) return { error: 'id 与 name 不能为空' }
        if (!content) return { error: 'content 不能为空' }
        try {
          const updated = await store().upsertCharacter(id, name, content)
          return { success: true, name, updatedCharacters: updated }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'novel_remove',
      label: '删除小说',
      description: '删除指定小说：移除项目登记并删除其整个子目录（正文与全部设定文件）',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '小说 id（novel_list 获取）' } },
        required: ['id']
      },
      internal: true,
      risk: 'dangerous',
      handler: async (...params: unknown[]) => {
        const { id } = params[0] as { id?: string }
        if (!id) return { error: 'id 不能为空' }
        try {
          await store().removeNovel(id)
          return { success: true }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    }
  ]
}

/** 小说工具完整清单（单一数据源：工具工厂与安全策略注册共用） */
export const NOVEL_TOOL_NAMES = [
  'novel_init',
  'novel_list',
  'novel_create',
  'novel_update',
  'novel_read',
  'novel_read_setting',
  'novel_character_upsert',
  'novel_remove'
] as const

/**
 * 小说工具安全策略：novel_* 只读写项目根（workspace/novels 或沙盒 outputs/novels）可信区，
 * 默认模式（mode=0）下直接放行，避免每次编辑都挂起等待审批。
 * 计划模式（mode=1）仍按模式策略 deny（写入类操作），行为保持一致。
 */
for (const name of NOVEL_TOOL_NAMES) {
  registerToolPolicy({ name, resolve: () => 'allow' })
}
