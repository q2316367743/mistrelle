/**
 * design_draw 工具：以「设计创意画布 agent」为内核的绘图工具。
 *
 * 与 image_generate 的分工：image_generate 走扩散模型，画面有较强 AI 感；
 * 本工具内部驱动画布 agent 逐层构建（几何图形 + 真实素材 + 精确排版），
 * 产出接近人工在画板上操作的结果，适合海报 / 封面 / 卡片 / 图文等需要精确排版的场景。
 *
 * 结构：
 * - createDesignDrawTool：对外工具定义（handler 为占位，实际由 agentTools 拦截处理——
 *   启动内部 agent 需要 messages（取模型）、abortSignal（级联中止）、chatId，handler 签名拿不到）
 * - runDesignDraw：内部 runner，创建封闭工具面的画布 agent，跑完由自己导出 PNG
 *
 * 安全（四层纵深，见 docs/tool/14）：
 * 1. 工具面物理封闭（closedToolSurface）：只暴露画布 + 设计素材工具，模型看不到 file_* / cli_run 等
 * 2. 维持子 Agent 裁决（isSubAgent → denyOnAsk）：任何 ask 一律自动拒绝，安全中心黑名单继续生效
 * 3. 只对本聊天沙盒 / 工作空间定向放行（既有 canvas_* / 素材工具策略，零放宽）
 * 4. 外层 design_draw 自身注册路径感知策略，越界路径由主会话用户审批
 */
import type { ToolFunction } from '@/domain'
import type { ToolChat } from '@/windows/main/modules/chat/agent/AgentChat'
import { registerToolPolicy } from '@/windows/main/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'
import { MAX_SUB_AGENT_STEPS } from '@/global/Constant'
import { createCanvasTools } from './canvasTools'
import { createDesignTools } from '@/windows/main/modules/tool/components/design'

/** design_draw 工具名（agentTools 拦截分支据此识别） */
export const DESIGN_DRAW_TOOL_NAME = 'design_draw'

/**
 * 内部 agent 不注入的素材工具：
 * - image_generate：扩散生图，与本工具「无 AI 感」的定位相斥
 * - humanize_text：文案改写，与绘图无关
 * - font_pick：需弹出交互面板由用户选字，内部 agent 无交互通道，调用必然落空
 */
const EXCLUDED_DESIGN_TOOLS = new Set(['image_generate', 'humanize_text', 'font_pick'])

/**
 * 比例 → 标准尺寸映射（与设计创意提示词里的常用比例口径一致）。
 * 传 `WxH` 时原样采用；传比例时取这里的标准值。
 */
const RATIO_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '3:4': { width: 1080, height: 1440 },
  '4:3': { width: 1440, height: 1080 },
  '2:3': { width: 1000, height: 1500 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '2.35:1': { width: 900, height: 383 }
}

export interface DesignDrawSize {
  width: number
  height: number
}

/**
 * 解析 size 参数：`1024x1024` / `1024*1024` 原样；`16:9` 等比例查标准尺寸；
 * 非法或缺失时回退 1024×1024（方形通用配图）。
 */
export const resolveDesignDrawSize = (raw: unknown): DesignDrawSize => {
  const fallback = RATIO_SIZE_MAP['1:1']
  if (typeof raw !== 'string' || !raw.trim()) return fallback
  const value = raw.trim()
  // 显式宽高：1024x1024 / 1024X1024 / 1024*1024
  const explicit = /^(\d{2,5})\s*[xX*×]\s*(\d{2,5})$/.exec(value)
  if (explicit) {
    return { width: Number(explicit[1]), height: Number(explicit[2]) }
  }
  return RATIO_SIZE_MAP[value] ?? fallback
}

/**
 * 内部画布 agent 的专用系统提示词。
 * 不复用 buildDesignCanvasPrompt：后者含「未经用户要求禁止 canvas_export 导出」铁律，
 * 而本工具必须由 runner 导出交付；且需明确「不要向用户提问」（内部 agent 无交互通道）。
 */
const buildDesignDrawPrompt = (size: DesignDrawSize, workspace: string): string => {
  const parts: string[] = [
    '你是一个「绘图型子 Agent」，被主 Agent 委托独立完成一张设计图。',
    '你用图层树画布（canvas_* 工具）创作：几何图形 + 真实素材 + 精确排版，产出接近人工设计而非扩散生图的效果。',
    '',
    '## 本次任务给定的画布尺寸',
    `必须以 ${size.width}×${size.height} 创建画布（canvas_create 传该 width / height），不要自行改尺寸。`,
    '',
    '## 工作流程',
    '1. canvas_create 创建画布：title 概括作品主题，width / height 用上面给定值，background 视设计需要',
    '2. 先按需 canvas_guidelines 加载规则：style-guide（风格手法）/ composition（构图）/ typography（字体层级），需要时再加载 poster / social-media 等题材规则',
    '3. canvas_set_palette 定义 3-5 个颜色 token（主色/辅色/中性色/强调色），之后 fill / stroke 一律用 $token名 引用',
    '4. 用 canvas_batch_edit 分层构建（先按区域分组铁律搭 group 骨架，再填子元素）：背景 → 主视觉 → 装饰 → 文字',
    '5. 用 canvas_inspect 核对关键元素的绝对位置与尺寸，发现重叠 / 越界合并进一次 batch_edit 修正，每区块最多修正 2 轮',
    '6. 结束前在最后一条消息汇报：作品主题、画面说明、颜色与字体选择要点',
    '',
    '## 铁律',
    '- **不要调用 canvas_export**：导出由外层负责，你只管把画面构建到位',
    '- **不要向用户提问、不要等待确认**：你没有交互通道，必须独立完成全部决策（平台 / 风格自行按任务描述判断）',
    '- 每张作品只有一个视觉焦点；留足负空间；同类元素严格对齐',
    '- 配色克制：≤1 个强调色，禁纯黑 #000000（用 off-black），禁「AI 紫蓝渐变」，全页只用一套色板',
    '- 字体先 font_list 查本机可用字体再选；层级靠字重 + 字号 + 颜色，不靠无脑放大',
    '- 避免俗套构图：禁「三张等宽卡片平铺」、禁无脑居中；用左右分屏 / 不对称 / 三分法 / Bento',
    '- 必须有主视觉（hero），禁止只靠文字排版 + 色块拼图冒充作品：优先真实素材（website_logo / image web 类型），否则用几何图形组合',
    '- 每个节点必须赋有意义的 name；text 节点必须设置 fill；所有颜色统一用 fill'
  ]
  if (workspace) {
    parts.push('', `## 用户工作空间`, `${workspace}`, '任务描述中引用的文件路径为绝对路径，可直接读取。')
  }
  return parts.join('\n')
}

export interface RunDesignDrawOptions {
  /** 绘图需求描述（来自 design_draw 的 prompt 参数） */
  prompt: string
  /** 画布尺寸（已由 resolveDesignDrawSize 解析） */
  size: DesignDrawSize
  /** PNG 输出目标绝对路径 */
  outputPath: string
  /** 沙盒目录 */
  sandboxDir: string
  /** 用户工作空间（可为空串） */
  workspace: string
  /** 使用的模型 / 提供方（继承主会话最近一条 user 消息） */
  model: string
  provide: string
  thinking?: boolean
  reasoningEffort?: 'low' | 'high' | 'max'
  /** 主 Agent 的 AbortSignal：主 Agent 终止时级联终止内部 agent */
  parentSignal?: AbortSignal
}

export interface RunDesignDrawResult {
  path: string
  width: number
  height: number
}

/** 等待内部 agent 循环结束：轮询 status 直到终态 */
const waitForCompletion = (chat: ToolChat): Promise<'completed' | 'error' | 'stop'> =>
  new Promise((resolve) => {
    const check = () => {
      const status = chat.status.value
      if (status === 'complete') return resolve('completed')
      if (status === 'error') return resolve('error')
      if (status === 'stop') return resolve('stop')
      setTimeout(check, 200)
    }
    check()
  })

/**
 * 启动内部画布 agent 完成绘制并导出 PNG。
 * 工具面封闭为「画布工具 + 设计素材工具」，不注册运行中注册表（过程不可见）。
 */
export const runDesignDraw = async (
  options: RunDesignDrawOptions
): Promise<RunDesignDrawResult> => {
  const { prompt, size, outputPath, sandboxDir, workspace } = options

  // 动态 import 断环：ChatTypeConfig → designDraw → AgentChat → agentFunctions → ChatTypeConfig
  const { ToolChat } = await import('@/windows/main/modules/chat/agent/AgentChat')

  const toolCtx = { getSandboxDir: () => sandboxDir }
  const canvasTools = createCanvasTools(toolCtx)
  const materialTools = createDesignTools(toolCtx).filter(
    (tool) => !EXCLUDED_DESIGN_TOOLS.has(tool.name)
  )

  const chat = new ToolChat({
    sandboxDir,
    workspace,
    mode: 0,
    // 内部 agent 不需要 skill 体系（工具面已封闭）
    enableSkill: false,
    systemPrompt: buildDesignDrawPrompt(size, workspace),
    // 只暴露显式传入的工具面：不并入默认常驻 / 用户勾选，关闭渐进装载与注册表兜底
    functions: [...canvasTools, ...materialTools],
    closedToolSurface: true,
    chatId: '',
    isSubAgent: true, // 禁用 spawn_agent + 不注入子 Agent 指导；策略上下文据此 denyOnAsk
    maxSteps: MAX_SUB_AGENT_STEPS,
    finalizeOnMaxSteps: true
  })

  // 无交互通道：需审批的操作一律自动拒绝（安全中心黑名单继续生效）
  chat.interactive.setEnabled(false)

  // 主 Agent 终止时级联终止内部 agent
  const onParentAbort = () => {
    void chat.abortChat()
  }
  options.parentSignal?.addEventListener('abort', onParentAbort)

  try {
    await chat.sendUserMessage({
      message: {
        content: [{ type: 'text' as const, data: prompt, time: Date.now() }],
        model: options.model,
        provide: options.provide,
        thinking: options.thinking,
        reasoning_effort: options.reasoningEffort
      },
      mode: 0,
      workspace
    })
    const status = await waitForCompletion(chat)
    if (status !== 'completed') {
      throw new Error(status === 'stop' ? '绘图已中止' : '绘图过程出错')
    }
    // 由 runner 显式导出：复用 canvas_export 的 handler（沙盒内目标路径天然落在可信区）
    const exportTool = canvasTools.find((tool) => tool.name === 'canvas_export')
    if (!exportTool) throw new Error('canvas_export 工具不可用')
    const raw = (await exportTool.handler({ path: outputPath })) as {
      success?: boolean
      path?: string
      width?: number
      height?: number
      error?: string
    }
    if (raw?.error || !raw?.path) {
      throw new Error(raw?.error ?? '画布导出失败')
    }
    return {
      path: raw.path,
      width: raw.width ?? size.width,
      height: raw.height ?? size.height
    }
  } finally {
    options.parentSignal?.removeEventListener('abort', onParentAbort)
    chat.destroy()
  }
}

/**
 * design_draw 工具定义。
 * handler 为占位：实际执行由 agentTools.runSingleTool 拦截处理（见文件头说明）。
 */
export const createDesignDrawTool = (): ToolFunction => ({
  name: DESIGN_DRAW_TOOL_NAME,
  label: '绘制设计图',
  description:
    '用画布绘制一张设计图并保存为 PNG，返回图片绝对路径（path），生成的图片会直接展示在对话中。' +
    '内部以「模拟设计师在画板上逐层绘制」的方式产出（几何图形 + 真实素材 + 精确排版），' +
    '画面干净、可精确控制文案与版式，**没有扩散生图的 AI 感**。' +
    '适合：海报、封面（公众号 / 书籍 / 专辑）、社交配图、知识卡片、图文排版等需要精确控制文字与布局的设计图。' +
    '若需要写实插画 / 照片质感的素材，用 image_generate（扩散生图）更合适。' +
    '参数 size 可传宽高（如 1024x1024）或比例（如 16:9 / 1:1 / 3:4 / 2.35:1）。' +
    '注意：绘制需要若干步工具调用，耗时较长。',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description:
          '绘图需求描述：作品用途与主题、需要出现的文案（标题 / 副标题 / 正文要点）、风格倾向、配色偏好等。描述越具体产出越贴合，中文即可'
      },
      path: {
        type: 'string',
        description: '输出 PNG 保存路径（缺省保存到沙盒 outputs/images/ 下自动命名；父目录不存在会自动创建）'
      },
      size: {
        type: 'string',
        description:
          '输出尺寸：宽x高（如 1024x1024）或比例（如 16:9 / 1:1 / 3:4 / 2:3 / 9:16 / 2.35:1）；缺省方形 1024×1024'
      }
    },
    required: ['prompt']
  },
  risk: 'sensitive',
  handler: async () => {
    return { error: 'design_draw 应由引擎拦截处理，不应直接调用 handler' }
  }
})

/**
 * design_draw 写入策略：path 缺省写沙盒 outputs/images/（可信区），显式 path 位于
 * 沙盒 / 工作空间内自动放行，其余需用户审批（与 canvas_export / image_generate 一致）。
 */
registerToolPolicy({
  name: DESIGN_DRAW_TOOL_NAME,
  resolve(_tool, args, ctx) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'allow'
    return isPathUnder(path, ctx.sandboxDir) || isPathUnder(path, ctx.workspace)
      ? 'allow'
      : 'ask'
  }
})
