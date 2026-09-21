import type { SceneDefinition } from '../types'
import { buildArticleScenePrompt } from '@/windows/main/modules/tool/components/article/articlePrompt'
import { createArticleTools } from '@/windows/main/modules/tool/components/article/articleTools'
import { createDesignDrawTool } from '@/windows/main/modules/tool/components/canvas/designDraw'
import { gzhStyleTools, gzhTrendTools } from '@/windows/main/modules/tool/components/gzh'
import { GZH_SKILLS } from './skills'
import GzhAside from '@/windows/main/components/aside/writing/gzh/GzhAside.vue'

/**
 * 公众号场景基础约定（与文章创作共享文章项目库，产出为 .md 文档）：
 * - 数据同库：公众号文章与「文章创作」互通（article_* 工具，按文章类型区分平台）
 * - 体裁红线浓缩在基础段，完整方法论走 gzh-* 内置 skill（按需 load_skill）
 * - 排版交给侧边栏本地渲染器（AI 不生成 HTML），提示词只约束内容结构
 */
const GZH_BASE_PROMPT = [
  '## 公众号写作模式',
  '你是一名专业的公众号内容创作助手。文章产出统一写入用户工作空间（workspace）或沙盒 outputs/ 下的文章项目（article_write），一篇公众号文章与文章创作场景同库管理。',
  '约定：',
  '- 成稿用 article_write 写入；告诉用户完整路径',
  '- 体裁硬约束：开头几句可独立成摘要；单段 ≤90 字；全文 >2000 字必须用二级标题分小节；结尾只给读者一个动作',
  '- AI 腔黑名单（出现即删）：本质上 / 说白了 / 换句话说 / 综上；「不是 X 而是 Y」全文限 1 次；不堆三段排比；不编造数据与案例',
  '- 排版由右侧侧边栏本地渲染器完成（你在「排版预览」引导用户选风格复制），**不要生成 HTML**，只维护好 Markdown 结构（标题层级 / 列表 / 引用块 / 图片独立成段）',
  '- 需要**精确排版 / 可控文案**的封面或配图时，用 design_draw(prompt, size) 直接绘制；封面须遵守 2.35:1 双裁切安全区（见 gzh-cover skill）',
  '- 涉及方法论细节（写作路由 / 短文 / 定位三件套 / 标题方法 / 爆款数据解读 / 排版结构 / 封面构图 / 配图）时，先加载对应 gzh-* skill 再动手'
].join('\n')

/**
 * 微信公众号场景：文章项目工具（同库）+ 排版风格管理 + 爆款数据 + design_draw 配图
 * + gzh-* 内置 skill 八件（长文 / 短文 / 定位 / 标题 / 爆款数据 / 排版 / 封面 / 配图）
 */
export const gzhScene: SceneDefinition = {
  prompt: () => [GZH_BASE_PROMPT, buildArticleScenePrompt()].filter(Boolean).join('\n\n'),
  skills: GZH_SKILLS,
  tools: (ctx) => [
    ...createArticleTools(ctx),
    ...gzhStyleTools,
    ...gzhTrendTools,
    createDesignDrawTool()
  ],
  subAgentAllow: ['research', 'image'],
  personalizeScope: 'writing',
  sandboxDirs: () => ['outputs/articles', 'outputs/articles/drafts', 'outputs/articles/assets'],
  autoExpandAside: true,
  aside: GzhAside,
  asideProps: (ctx) => ({
    sandbox: ctx.sandbox,
    workspace: ctx.workspace,
    fullscreen: ctx.fullscreen,
    // 质检等 aside 直呼能力按「最后一条 user 消息」解析当前对话模型
    messages: ctx.messages
  })
}
