/**
 * 子 Agent 能力类型：
 * - research：调研型（默认，只读调研 / 分析，返回结构化摘要）
 * - image：生图型（只做文生图，任务描述进来自行撰写生图提示词并落盘，无调研 / 设计能力）
 *
 * 各场景允许派发的能力矩阵见 chat/scenes 各叶子场景的 subAgentAllow（场景即上层建筑）。
 */
export type SubAgentType = 'research' | 'image'

/**
 * 是否为「仅场景工具」型子 Agent：这类子 Agent 的工作面就是一组固定的能力工具
 * （如生图型的 image_generate + 图片处理），不注入任何默认常驻能力
 * （记忆 / todo / ask / shell / 文件 / skill / 渐进式装载器），也不允许执行期从
 * 全局注册表兜底恢复未注入的工具——保证能力面完全封闭、行为可预期。
 */
export const isSceneToolsOnlyAgent = (type?: SubAgentType): boolean => type === 'image'

/** 子 Agent 运行选项（由 spawn_agent 工具解析后透传） */
export interface SubAgentOptions {
  /** 子 Agent ID（由调用方预生成并先行标记到主 Agent 消息） */
  subId: string
  /** 主 Agent 的聊天 ID（用于构建子 Agent 文件路径） */
  chatId: string
  /** 任务描述 */
  task: string
  /** 沙盒目录（继承自主 Agent） */
  sandboxDir: string
  /** 工作空间（继承自主 Agent） */
  workspace: string
  /** 模型 ID */
  model: string
  /** 模型提供商 */
  provide: string
  /** 是否启用思考模式 */
  thinking?: boolean
  /** 推理强度 */
  reasoningEffort?: 'low' | 'high' | 'max'
  /** 子 Agent 能力类型（缺省 research） */
  subAgentType?: SubAgentType
  /** 隐私聊天标记（继承主 Agent）：子 Agent 同样不注入记忆、不注册记忆工具 */
  privacy?: boolean
  /** 主 Agent 的 AbortSignal：主 Agent 终止时级联终止子 Agent */
  parentSignal?: AbortSignal
}

/** 子 Agent 执行结果 */
export interface SubAgentResult {
  subId: string
  summary: string
  status: 'completed' | 'error'
}

/** 类型解析结果：合法返回 { ok: true }，非法返回 { ok: false, message }（判别式联合，避免与 SubAgentType 字符串混淆） */
export type ResolveSubAgentTypeResult =
  | { ok: true; type: SubAgentType }
  | { ok: false; message: string }

/**
 * 解析 spawn_agent 的 type 参数并校验是否在允许列表内。
 * allowed 由调用方传入（主 Agent 走场景定义的 subAgentAllow 能力矩阵，见 chat/scenes）——
 * 本文件是叶子模块，不能反向依赖场景注册表，故不在此处自行查表。
 * 缺省 / 空值按 research 处理（向后兼容旧行为）。
 * 非法时返回 { ok: false, message }，由调用方直接回填工具结果，避免模型尝试被禁用的能力。
 */
export const resolveSubAgentType = (
  raw: unknown,
  allowed: ReadonlyArray<SubAgentType>
): ResolveSubAgentTypeResult => {
  const requested = raw === undefined || raw === null || raw === '' ? 'research' : raw
  if (typeof requested === 'string' && (allowed as readonly string[]).includes(requested)) {
    return { ok: true, type: requested as SubAgentType }
  }
  return {
    ok: false,
    message: `当前场景不支持「${String(requested)}」型子 Agent，可用：${allowed.join(' / ')}`
  }
}
