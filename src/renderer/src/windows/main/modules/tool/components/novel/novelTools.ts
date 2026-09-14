import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/windows/main/modules/tool/toolPolicy'
import type { ChatTypeToolContext } from '@/windows/main/modules/chat/chatType'
import { NOVEL_FILES, NOVEL_SETTING_FILE_KEYS } from './novelTypes'
import type { NovelSettingFileKey, NovelUpdatePatch } from './novelTypes'
import { buildNovelRoot, getNovelStore } from './novelStore'

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

const FILE_DESC = `设定文件：${NOVEL_SETTING_FILE_KEYS.join(' / ')}（分别对应大纲 / 背景设定 / 文风；角色卡用 novel_character_upsert，正文用 novel_write）`

/**
 * 返回短篇小说场景工具实例（按 workspace / sandbox 定位项目根），供 WritingSceneConfig 场景级注入。
 * 项目根：{workspace}/novels/（有工作空间）或 {sandbox}/outputs/novels/（无工作空间）。
 *
 * 本场景是纯文本创作，file 类 / shell / 绘图 / 生图已从工具面剔除（见 ChatTypeConfig 的
 * NOVEL_EXCLUDED_TOOLS），一切读写收敛到本文件这组 novel_* 工具：
 * - 正文：novel_write（replace 覆盖 / append 追加）
 * - 设定：novel_write_setting（outline / setting / style）
 * - 角色：novel_character_upsert（## 段落增改）
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
      description: '列出项目内全部小说（标题 / 题材 / 摘要 / 字数），写作前先看现状',
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
        '新建一部短篇小说：创建子目录（含 story / outline / characters / setting / style 五个骨架文件）并登记到项目索引，返回小说 id 与各文件路径。后续用 novel_write 写正文、novel_write_setting 写设定、novel_character_upsert 增改角色',
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
      description: '更新小说元信息（标题 / 题材 / 摘要）。正文与设定内容的修改请用 novel_write / novel_write_setting',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '小说 id（novel_list 获取）' },
          title: { type: 'string', description: '标题' },
          genre: { type: 'string', description: '题材' },
          summary: { type: 'string', description: '一句话创意 / 摘要' }
        },
        required: ['id']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, title, genre, summary } = params[0] as {
          id?: string
          title?: string
          genre?: string
          summary?: string
        }
        if (!id) return { error: 'id 不能为空' }
        const patch: NovelUpdatePatch = {}
        if (str(title)) patch.title = title
        if (str(genre)) patch.genre = genre
        if (str(summary)) patch.summary = summary
        if (Object.keys(patch).length === 0) return { error: '没有可更新的字段' }
        try {
          const item = await store().updateNovel(id, patch)
          return { id: item.id, updated: patch }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'novel_write',
      label: '写入小说正文',
      description:
        '写入小说正文（story.md），返回写后字数。mode=replace（默认）整体覆盖全文——重写 / 大幅改写时用；mode=append 追加到正文末尾——续写 / 加一节时用，只需给新增内容，不要重复回写已有部分（几万字的正文每次重述既慢又容易丢内容）',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '小说 id（novel_list 获取）' },
          content: {
            type: 'string',
            description:
              '正文内容（完整 markdown）。mode=replace 时为全文；mode=append 时只写新增部分'
          },
          mode: {
            type: 'string',
            description: '写入方式：replace（默认，整体覆盖）/ append（追加到末尾）'
          }
        },
        required: ['id', 'content']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, content, mode } = params[0] as {
          id?: string
          content?: string
          mode?: string
        }
        if (!id) return { error: 'id 不能为空' }
        if (typeof content !== 'string' || !content.trim()) return { error: 'content 不能为空' }
        const writeMode = mode === 'append' ? 'append' : 'replace'
        try {
          const result = await store().writeStory(id, content, writeMode)
          return { success: true, mode: result.mode, words: result.words }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'novel_write_setting',
      label: '写入小说设定',
      description:
        '写入小说的设定文件（每次写入该文件的完整内容，覆盖原内容）：outline 故事大纲 / setting 背景设定 / style 写作风格。角色卡请用 novel_character_upsert，正文请用 novel_write',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '小说 id（novel_list 获取）' },
          file: { type: 'string', description: FILE_DESC },
          content: { type: 'string', description: '该文件的完整 markdown 内容' }
        },
        required: ['id', 'file', 'content']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, file, content } = params[0] as {
          id?: string
          file?: string
          content?: string
        }
        if (!id) return { error: 'id 不能为空' }
        if (!file || !(NOVEL_SETTING_FILE_KEYS as readonly string[]).includes(file)) {
          return { error: `file 必须是 ${NOVEL_SETTING_FILE_KEYS.join(' / ')} 之一` }
        }
        if (typeof content !== 'string' || !content.trim()) return { error: 'content 不能为空' }
        try {
          await store().writeNovelFile(id, NOVEL_FILES[file as NovelSettingFileKey], content)
          return { success: true, file }
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
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
        '读取指定小说的设定文件：不传 file 时汇总返回全部设定（角色 / 大纲 / 背景设定 / 文风），写作正文前务必调用以保证设定一致；只关心某一个文件时传 file 单选，避免全量读取占用上下文',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '小说 id（novel_list 获取）' },
          file: {
            type: 'string',
            description: `可选，只读某个设定文件：characters / ${NOVEL_SETTING_FILE_KEYS.join(' / ')}；不传则汇总读全部`
          }
        },
        required: ['id']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { id, file } = params[0] as { id?: string; file?: string }
        if (!id) return { error: 'id 不能为空' }
        try {
          if (file && Object.prototype.hasOwnProperty.call(NOVEL_FILES, file)) {
            const content = await store().readFile(id, file as keyof typeof NOVEL_FILES)
            return { file, content }
          }
          return await store().readSetting(id)
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) }
        }
      }
    },
    {
      name: 'novel_stats',
      label: '统计小说字数',
      description: '统计指定小说正文字数（去空白字符数）并回写登记，用于进度跟踪与完稿确认',
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
          const words = await store().countWords(id)
          return { id, words }
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
  'novel_write',
  'novel_write_setting',
  'novel_read',
  'novel_read_setting',
  'novel_stats',
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
