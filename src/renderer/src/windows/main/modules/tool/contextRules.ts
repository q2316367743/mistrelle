/**
 * 工具历史上下文紧凑化规则注册表（单一数据源）。
 *
 * 请求构建时（agentContextCompact）按消息时间顺序游走历史 toolcall，
 * 依据本表做两类优化，降低回传 token：
 * - 写类：同资源的多次写入仅保留最后一次成功调用的完整原文（作为正确参数形态的
 *   参照样本），更早的及全部失败写整对剔除（tool_calls 与配对 tool result 均不回传）；
 * - 读类：同资源的多次读取仅保留最新一份结果，更早的替换为「已过期」提示
 *   （写入也会使同资源的更早读取过期）。
 *
 * 写类必须整对处理而非改写 args：模型会模仿历史 tool_calls 的参数形态，
 * 占位串、删字段后的空 `{}` 都会被原样复制进新调用（两轮实测撞墙，见 docs/chat/12 §5）。
 *
 * 规则按工具名注册、与 ChatType 无关：未注入该工具的模式规则自然空转，
 * 新增工具族只需在此加条目；需要跨调用状态的在 ContextWalkState 加字段并配 track。
 */
export interface ContextWalkState {
  /** 最近一次 canvas_open 打开的画布版本（canvas_get_nodes / canvas_batch_edit 无 version 参数，靠它定位资源） */
  canvasVersion?: number
  /** 最近一次 html_open / html_create 打开的 HTML 设计稿版本（html_write 无 version 参数，靠它定位资源） */
  htmlVersion?: number
}

export interface ToolContextRule {
  /** 读类：从 args 推导资源键（如 `file:${path}`）；同键内容型结果仅保留最新 */
  resource?: (args: Record<string, unknown>, state: ContextWalkState) => string | undefined
  /** 写类：写入的资源键，使该资源更早的读取过期；同键仅保留最后一次成功写的完整原文 */
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

const htmlArgKey = (version: unknown): string | undefined =>
  typeof version === 'number' ? `html:${version}` : undefined

/** 当前 HTML 设计稿资源键：open 后按版本号定位，否则用 current 占位（create / write 流） */
const htmlStateKey = (state: ContextWalkState): string =>
  state.htmlVersion != null ? `html:${state.htmlVersion}` : 'html:current'


const idKey = (prefix: string, id: unknown): string | undefined =>
  typeof id === 'string' && id ? `${prefix}:${id}` : undefined

export const toolContextRules: Record<string, ToolContextRule> = {
  // —— 文件族：读全文 / 写全文，同路径共享资源键（跨格式） ——
  file_read: { resource: (args) => fileKey(args.path) },
  file_read_docx: { resource: (args) => fileKey(args.path) },
  file_read_xlsx: { resource: (args) => fileKey(args.path) },
  file_read_pdf: { resource: (args) => fileKey(args.path) },
  file_write: {
    writeResource: (args) => fileKey(args.path)
  },
  file_write_xlsx: {
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
    writeResource: (_args, state) => canvasStateKey(state)
  },

  // —— HTML 设计稿族：create / write 均携带全量源码，共享当前稿资源键（仅留最后一次成功写）；
  // 未 open 过时用 current 占位键，open 后按版本号定位并使旧读取过期 ——
  html_open: {
    resource: (args) => htmlArgKey(args.version),
    track: (args, state) => {
      if (typeof args.version === 'number') state.htmlVersion = args.version
    }
  },
  html_create: {
    writeResource: () => htmlStateKey({}),
    track: (_args, state) => {
      state.htmlVersion = undefined
    }
  },
  html_read: {
    resource: (args, state) => htmlArgKey(args.version) ?? htmlStateKey(state)
  },
  html_write: {
    writeResource: (_args, state) => htmlStateKey(state)
  },

  // —— 写作族：正文读取与角色卡写入 ——
  article_read: { resource: (args) => idKey('article', args.id) },
  novel_read: { resource: (args) => idKey('novel', args.id) },
  novel_read_setting: { resource: (args) => idKey('novel-setting', args.id) },
  novel_character_upsert: {
    writeResource: (args) => idKey('novel-setting', args.id)
  }
}
