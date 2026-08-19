/**
 * 工具历史上下文紧凑化规则注册表（单一数据源）。
 *
 * 请求构建时（agentContextCompact）按消息时间顺序游走历史 toolcall，
 * 依据本表做两类优化，降低回传 token：
 * - 写类：args 中承载大内容的字段（如写入内容 / 批量操作树）整体删除，
 *   省略说明以注记形式附在配对的工具结果末尾；
 * - 读类：同资源的多次读取仅保留最新一份结果，更早的替换为「已过期」提示
 *   （写入也会使同资源更早的读取过期）。
 *
 * 规则按工具名注册、与 ChatType 无关：未注入该工具的模式规则自然空转，
 * 新增工具族只需在此加条目；需要跨调用状态的在 ContextWalkState 加字段并配 track。
 */
export interface ContextWalkState {
  /** 最近一次 canvas_open 打开的画布版本（canvas_get_nodes / canvas_batch_edit 无 version 参数，靠它定位资源） */
  canvasVersion?: number
}

export interface ToolContextRule {
  /**
   * 写类：args 中承载大内容的字段名，历史回传时整体删除（原值完整落盘不受影响）。
   * 必须删除而非替换为占位字符串——模型会模仿历史 tool_calls 的参数形态，
   * 类型不符的占位串会被原样复制进新调用（实测 canvas_batch_edit 反复撞墙 30+ 次）。
   * 省略说明由 agentContextCompact 在配对的工具结果末尾追加注记（result 侧为自由文本，无格式污染）。
   */
  stripArgs?: string[]
  /** 读类：从 args 推导资源键（如 `file:${path}`）；同键内容型结果仅保留最新 */
  resource?: (args: Record<string, unknown>, state: ContextWalkState) => string | undefined
  /** 写类：写入的资源键，使该资源更早的读取过期 */
  writeResource?: (args: Record<string, unknown>, state: ContextWalkState) => string | undefined
  /** 该调用发生后更新游走状态（在 resource / writeResource 之后执行） */
  track?: (args: Record<string, unknown>, state: ContextWalkState) => void
}

const fileKey = (path: unknown): string | undefined =>
  typeof path === 'string' && path ? `file:${path}` : undefined

const canvasArgKey = (version: unknown): string | undefined =>
  typeof version === 'number' ? `canvas:${version}` : undefined

const canvasStateKey = (state: ContextWalkState): string =>
  `canvas:${state.canvasVersion ?? '?'}`

const pptKey = (pptId: unknown, slideId: unknown): string | undefined =>
  typeof pptId === 'string' && pptId ? `ppt:${pptId}:${typeof slideId === 'number' ? slideId : '?'}` : undefined

const idKey = (prefix: string, id: unknown): string | undefined =>
  typeof id === 'string' && id ? `${prefix}:${id}` : undefined

export const toolContextRules: Record<string, ToolContextRule> = {
  // —— 文件族：读全文 / 写全文，同路径共享资源键（跨格式） ——
  file_read: { resource: (args) => fileKey(args.path) },
  file_read_docx: { resource: (args) => fileKey(args.path) },
  file_read_xlsx: { resource: (args) => fileKey(args.path) },
  file_read_pdf: { resource: (args) => fileKey(args.path) },
  file_write: {
    stripArgs: ['content'],
    writeResource: (args) => fileKey(args.path)
  },
  file_write_xlsx: {
    stripArgs: ['sheets'],
    writeResource: (args) => fileKey(args.path)
  },

  // —— 画布族：get_nodes / batch_edit 无 version 参数，经 canvas_open 的 track 定位当前画布 ——
  canvas_open: {
    resource: (args) => canvasArgKey(args.version),
    track: (args, state) => {
      if (typeof args.version === 'number') state.canvasVersion = args.version
    }
  },
  canvas_read: { resource: (args) => canvasArgKey(args.version) },
  canvas_get_nodes: { resource: (_args, state) => canvasStateKey(state) },
  canvas_batch_edit: {
    stripArgs: ['operations'],
    writeResource: (_args, state) => canvasStateKey(state)
  },

  // —— PPT 族：节点树按「文档 + 页」为资源粒度 ——
  ppt_get_nodes: { resource: (args) => pptKey(args.pptId, args.slideId) },
  ppt_batch_edit: {
    stripArgs: ['operations'],
    writeResource: (args) => pptKey(args.pptId, args.slideId)
  },

  // —— 写作族：正文读取与角色卡写入 ——
  article_read: { resource: (args) => idKey('article', args.id) },
  novel_read: { resource: (args) => idKey('novel', args.id) },
  novel_read_setting: { resource: (args) => idKey('novel-setting', args.id) },
  novel_character_upsert: {
    stripArgs: ['content'],
    writeResource: (args) => idKey('novel-setting', args.id)
  }
}
