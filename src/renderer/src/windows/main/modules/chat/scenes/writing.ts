import type { SceneDefinition } from './types'
import { buildArticleScenePrompt } from '@/windows/main/modules/tool/components/article/articlePrompt'
import { createArticleTools } from '@/windows/main/modules/tool/components/article/articleTools'
import { NOVEL_SCENE_PROMPT } from '@/windows/main/modules/tool/components/novel/novelPrompt'
import { createNovelTools } from '@/windows/main/modules/tool/components/novel/novelTools'
import { createDesignDrawTool } from '@/windows/main/modules/tool/components/canvas/designDraw'
import {
  createHumanizeTool,
  hasHumanizeAccess
} from '@/windows/main/modules/tool/components/design/humanize'
import ArticleAside from '@/windows/main/components/chat/aside/writing/article/ArticleAside.vue'
import NovelAside from '@/windows/main/components/chat/aside/writing/novelShort/NovelAside.vue'

/**
 * 写作通用约定（原 CHAT_TYPE_CONFIG.writing.prompt 按子场景分流的两段文本，摊平为各自叶子的基础段）：
 * - 文章场景产出为独立 .md 文档，可用 design_draw 配图
 * - 小说场景一切写入走 novel_* 专用通道（file 类 / design_draw 已从工具面剔除，
 *   提示词若仍提到它们会诱导模型调用不存在的工具）
 */
const ARTICLE_BASE_PROMPT = [
  '## 写作模式',
  '你是一名专业写作助手。你的文档产出统一写入用户工作空间（workspace）或沙盒 outputs/ 目录下的 .md 文件。',
  '约定：',
  '- 使用 file_write 创建 / 更新 .md 文档，路径建议放在 outputs/ 下，便于侧边栏文档树展示与预览',
  '- 每次写作完成后，告知用户文档的完整路径',
  '- 文档结构清晰：使用标题层级、列表、引用组织内容',
  '- 需要**精确排版 / 可控文案**的设计图（封面、图文卡片、社交配图）时，可用 design_draw(prompt, size?) 直接在画布上绘制'
].join('\n')

const NOVEL_BASE_PROMPT = [
  '## 写作模式',
  '你是一名专业写作助手，当前在短篇小说创作场景。',
  '约定：',
  '- 分步骤推进，每步完成一件明确的事，产出直接写入小说项目（由 novel_* 工具管理），不要自行拼装文件路径',
  '- 每次写作完成后，简要说明本次产出（改了哪个文件、字数变化）',
  '- 文档结构清晰：使用标题层级、列表组织内容'
].join('\n')

/**
 * 短篇小说场景剔除的常驻工具名（getDefaultTools / 渐进装载器 / 场景追加工具的子集）。
 * 用字面量而非导入工具数组：fileParse 会拉入 mammoth / xlsx / pdf-parse，
 * 导入会把重依赖带进场景定义的模块图（agentFunctions / agentPrompts 都吃这份配置）。
 *
 * 为什么整族剔除：
 * - file_*：写作只用 novel_* 写入，file 类让模型有两个都能写文件的入口，显著拉低工具选择准确率
 * - cli_run：策略上可信区内免审批，重定向 / heredoc 可绕过 file 类的全部限制——只剔 file 类等于白做
 * - load_tool_collection：会给模型一份 date / clipboard / browser / doc 的可装载目录，全是写作无关噪音
 * - http_download / design_draw / image_read：小说为纯文本体裁，下载与图片类能力用不上
 */
const NOVEL_EXCLUDED_TOOLS: ReadonlyArray<string> = [
  'file_list',
  'file_read',
  'file_write',
  'file_delete',
  'file_mkdir',
  'file_stat',
  'file_glob',
  'file_grep',
  'file_read_docx',
  'file_read_xlsx',
  'file_read_pdf',
  'file_write_xlsx',
  'cli_run',
  'load_tool_collection',
  'http_download',
  'design_draw',
  'image_read'
]

/** 文章创作场景：文章项目（article_* 管理工具）+ design_draw 配图 + 生图型子 Agent */
export const articleScene: SceneDefinition = {
  prompt: () => [ARTICLE_BASE_PROMPT, buildArticleScenePrompt()].filter(Boolean).join('\n\n'),
  tools: (ctx) => [...createArticleTools(ctx), createDesignDrawTool()],
  subAgentAllow: ['research', 'image'],
  personalizeScope: 'writing',
  sandboxDirs: () => ['outputs/articles', 'outputs/articles/drafts', 'outputs/articles/assets'],
  autoExpandAside: true,
  aside: ArticleAside,
  asideProps: (ctx) => ({
    sandbox: ctx.sandbox,
    workspace: ctx.workspace,
    fullscreen: ctx.fullscreen
  })
}

/**
 * 短篇小说场景：novel_* 专用通道 + 去 AI 味（登录后注入，与 design 场景同源）；
 * 封面 / 插图改由侧边栏直呼生图接口，写作会话内不再提供生图型子 Agent
 */
export const novelShortScene: SceneDefinition = {
  prompt: () => [NOVEL_BASE_PROMPT, NOVEL_SCENE_PROMPT].filter(Boolean).join('\n\n'),
  tools: (ctx) => [
    ...createNovelTools(ctx),
    ...(hasHumanizeAccess() ? [createHumanizeTool()] : [])
  ],
  excludedTools: NOVEL_EXCLUDED_TOOLS,
  subAgentAllow: ['research'],
  personalizeScope: 'writing',
  sandboxDirs: () => ['outputs/novels'],
  autoExpandAside: true,
  aside: NovelAside,
  asideProps: (ctx) => ({
    sandbox: ctx.sandbox,
    workspace: ctx.workspace,
    fullscreen: ctx.fullscreen
  })
}
