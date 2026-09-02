/**
 * SQLite 领域通道常量与载荷类型（preload 桥与 main handler 共用）。
 *
 * 设计约定（见 docs/data/01-sqlite-storage.md）：
 * - 所有 SQL 与 DAO 逻辑都在 main（ipc/dbIpc.ts + db/ 下），preload 只透传类型化领域参数。
 * - 用户输入（关键词 / 分类 / 时间）一律经 DAO 绑定参数，禁止拼 SQL。
 * - 独立于 channels.ts（其已贴 500 行红线），本文件只承载 db 域。
 */
export const DbChannels = {
  aihotList: 'db:aihot:list',
  aihotApplyBatch: 'db:aihot:applyBatch',
  aihotClear: 'db:aihot:clear',
  aihotGetMeta: 'db:aihot:getMeta',
  aihotMarkRead: 'db:aihot:markRead',
  chatList: 'db:chat:list',
  chatGetItem: 'db:chat:getItem',
  chatUpsertItem: 'db:chat:upsertItem',
  chatDeleteItem: 'db:chat:deleteItem',
  chatGetContent: 'db:chat:getContent',
  chatSetContent: 'db:chat:setContent',
  chatGetSub: 'db:chat:getSub',
  chatSetSub: 'db:chat:setSub',
  chatGetStamp: 'db:chat:getStamp',
  imageList: 'db:image:list',
  imageUpsert: 'db:image:upsert',
  imageDelete: 'db:image:delete',
  healthList: 'db:health:list',
  healthUpsert: 'db:health:upsert',
  healthDelete: 'db:health:delete',
  compareQuestionList: 'db:compare:questionList',
  compareQuestionUpsert: 'db:compare:questionUpsert',
  compareQuestionDelete: 'db:compare:questionDelete',
  compareQuestionReplaceAll: 'db:compare:questionReplaceAll',
  compareList: 'db:compare:list',
  compareUpsert: 'db:compare:upsert',
  compareDelete: 'db:compare:delete'
} as const

/** 排序 / 时间筛选基准 */
export type AihotListBy = 'timeline' | 'published'

/** 写入 aihot_item 的行载荷：data 为完整 AihotItem JSON，其余为提取的可筛选 / 排序标量 */
export interface AihotDbItemInput {
  id: string
  title: string | null
  category: string | null
  discoveredAt: string | null
  publishedAt: string | null
  searchText: string
  data: string
}

export interface AihotListFilter {
  /** 关键词（>=2 字符才参与匹配，对 search_text 子串） */
  keyword?: string
  /** 分类；空串 = 全部 */
  category?: string
  /** 时间窗下界（ISO 字符串）；null = 全部时间 */
  cutoffIso?: string | null
  by: AihotListBy
}

export interface AihotListParams {
  filter: AihotListFilter
  limit: number
  offset: number
}

export interface AihotListResult {
  /** data 为完整 AihotItem JSON（渲染侧 JSON.parse 还原），id 供 key 使用，read 为是否已读 */
  items: Array<{ id: string; data: string; read: boolean }>
  total: number
}

export interface AihotMeta {
  schemaVersion: number
  fields: 'default'
  /** 增量账本水位；null = 尚未引导 */
  cursor: string | null
  syncedAt: string | null
}

/** 一批应用（upsert + delete + meta）在一个事务内原子完成 */
export interface AihotBatch {
  upserts: AihotDbItemInput[]
  deletes: string[]
  meta: Partial<AihotMeta>
}

// ── 聊天域（列表 + 消息体 + 子代理消息体） ─────────────────

/** chat 表行载荷（侧栏列表项，类型化列；渲染侧 AiChatItem 与之一一映射） */
export interface ChatItemInput {
  id: string
  name: string
  top: boolean
  /** 隐私聊天标记：开启后不注入记忆 / 不注册记忆工具，会话不进入记忆提取 */
  privacy: boolean
  workspace: string
  projectId?: string
  taskId?: string
  type?: string
  createdAt: number
  updatedAt: number
}

/** chatGetContent 返回：data 为完整 AiChatContent JSON（渲染侧 parse），缺行为 null */
export interface ChatContentResult {
  data: string | null
  updatedTime: number | null
}

// ── 文生图域（生成记录） ─────────────────

/** 生成任务状态：pending=生成中，success=成功，failed=失败 */
export type ImageGenerateStatus = 'pending' | 'success' | 'failed'

/** image_generate 表行载荷（upsert 全量列 / list 行返回，两用） */
export interface ImageRecordInput {
  id: string
  prompt: string
  model: string | null
  /** 生成时的设计风格名快照；未选风格为空 */
  styleName: string | null
  size: string | null
  /** 图片文件绝对路径（pending 时即为预定路径） */
  path: string | null
  width: number | null
  height: number | null
  status: ImageGenerateStatus
  error: string | null
  /** 异步任务型（中转站返回 task_id 需轮询）的远端任务标识；同步模式 / 提交即失败为空 */
  taskId: string | null
  /** 远端任务查询绝对截止时间（首次轮询起点 + 5 分钟窗口），续轮询判定窗口用 */
  pollMaxAt: number | null
  /** 远端任务是否已确认终态（failed / cancelled / 完成但缺图）；true 时不可再续轮询 */
  taskTerminal: boolean | null
  createdAt: number
}

export interface ImageListFilter {
  /** 关键词（>=2 字符才参与匹配，对 prompt 子串） */
  keyword?: string
  /** 状态筛选；空 = 全部 */
  status?: ImageGenerateStatus
}

export interface ImageListParams {
  filter: ImageListFilter
  limit: number
  offset: number
}

export interface ImageListResult {
  items: ImageRecordInput[]
  total: number
}

// ── 模型健康检测域（可用性检测工具） ─────────────────

/** 检测套餐：basic=基础检测（4 项），full=完整检测（12 项） */
export type HealthCheckMode = 'basic' | 'full'

/** 任务状态：running=检测中，finished=正常结束，stopped=被停止或应用中断 */
export type HealthTaskStatus = 'running' | 'finished' | 'stopped'

/** 单项结果：pass=通过，warn=警告，fail=失败，skip=跳过（该项不适用） */
export type HealthItemStatus = 'pass' | 'warn' | 'fail' | 'skip'

/** 任务级风险结论：healthy=健康，risky=有风险，danger=高风险，unknown=未定（检测中/无有效项） */
export type HealthConclusion = 'healthy' | 'risky' | 'danger' | 'unknown'

/** 接口协议格式（与渲染层 AiProvideFormat 同构；本侧不 import 渲染层 entity） */
export type HealthApiFormat = 'chat' | 'anthropic' | 'responses'

/** 单个检测项结果（items JSON 列的元素） */
export interface HealthItemResult {
  key: string
  name: string
  /** 所属维度（连通与速度 / 模型真实性 / 计费合规 / 能力基线 / 功能特性） */
  dimension: string
  status: HealthItemStatus
  /** 本项耗时 ms（含共享请求复用的场景） */
  latencyMs: number | null
  /** 结果说明 / 响应摘录 / 错误信息 */
  detail: string | null
}

/** 执行日志条目（logs JSON 列的元素） */
export interface HealthLogEntry {
  time: number
  level: 'info' | 'warn' | 'error'
  message: string
}

/**
 * model_health 表行载荷（upsert 全量列 / list 行返回，两用）。
 * 只存关键数据：审计报告（HTML）由 items / logs + 标量动态生成，导出时才落盘，不进库。
 * API 密钥只用于当次检测请求，不落库（本域无 key 字段）。
 */
export interface HealthRecordInput {
  id: string
  /** 提供方名称快照（手动填写的检测为 null） */
  provideName: string | null
  apiUrl: string
  modelId: string
  modelName: string | null
  format: HealthApiFormat
  mode: HealthCheckMode
  status: HealthTaskStatus
  conclusion: HealthConclusion
  /** 检测项结果数组（HealthItemResult[]）的 JSON 文本 */
  items: string
  /** 执行日志数组（HealthLogEntry[]）的 JSON 文本 */
  logs: string
  durationMs: number | null
  createdAt: number
}

export interface HealthListParams {
  limit: number
  offset: number
}

export interface HealthListResult {
  items: HealthRecordInput[]
  total: number
}

// ── 模型对比检测域（题库 + 对比任务记录） ─────────────────

/** 执行模式：parallel=全并发，mixed=混合（速度轮串行+其余并发），serial=全串行 */
export type CompareExecMode = 'parallel' | 'mixed' | 'serial'

/** 任务状态：running=对比中，finished=正常结束，stopped=被停止或应用中断 */
export type CompareTaskStatus = 'running' | 'finished' | 'stopped'

/** 题库行载荷（upsert 全量列 / list 行返回，两用） */
export interface CompareQuestionInput {
  /** 稳定标识（种子固定 key / custom-{ts}；题集矩阵按 key 对齐） */
  key: string
  tag: string
  /** 排序（order 为 SQL 保留字，列名用 order_index；list 按此升序） */
  orderIndex: number
  enable: boolean
  question: string
  reference: string
  /** 判分关键词数组（DAO 内 JSON 序列化入 answer_keys 列） */
  answerKeys: string[]
  /** 可选正则（额外校验，如 JSON 格式题） */
  pattern: string | null
  note: string | null
}

/**
 * model_compare 表行载荷（upsert 全量列 / list 行返回，两用）。
 * models / results / logs 为数组 JSON 文本（渲染侧 parse 还原）；逐阶段完成时整行 upsert 增量累积。
 * 密钥不落库；md 报告是用户手动导出产物（dialog.save 自选路径），表内 report_path 列保留但不再写入。
 */
export interface CompareRecordInput {
  id: string
  status: CompareTaskStatus
  execMode: CompareExecMode
  speedRuns: number
  consistencyCount: number
  /** 参与模型快照数组（CompareModelSnapshot[]）的 JSON 文本 */
  models: string
  /** 各模型检测结果数组（CompareModelResult[]）的 JSON 文本 */
  results: string
  /** 执行日志数组（CompareLogEntry[]）的 JSON 文本 */
  logs: string
  durationMs: number | null
  /** 历史遗留列（不再写入；用户手动导出的报告由用户管理） */
  reportPath: string | null
  createdAt: number
}

export interface CompareListParams {
  limit: number
  offset: number
}

export interface CompareListResult {
  items: CompareRecordInput[]
  total: number
}
