/**
 * window.preload.db 契约：SQLite 领域仓储桥。
 * 与 main 的 dbIpc.ts / db/ 仓储层对应；所有 SQL 逻辑在 main，本侧只传类型化领域参数。
 */

/** 排序 / 时间筛选基准 */
declare type AihotListBy = 'timeline' | 'published'

/** 写入 aihot_item 的行载荷：data 为完整 AihotItem JSON，其余为提取的可筛选 / 排序标量 */
declare interface AihotDbItemInput {
  id: string
  title: string | null
  category: string | null
  discoveredAt: string | null
  publishedAt: string | null
  searchText: string
  data: string
}

declare interface AihotListFilter {
  keyword?: string
  category?: string
  cutoffIso?: string | null
  by: AihotListBy
}

declare interface AihotListParams {
  filter: AihotListFilter
  limit: number
  offset: number
}

declare interface AihotListResult {
  items: Array<{ id: string; data: string; read: boolean }>
  total: number
}

declare interface AihotMeta {
  schemaVersion: number
  fields: 'default'
  cursor: string | null
  syncedAt: string | null
}

declare interface AihotBatch {
  upserts: AihotDbItemInput[]
  deletes: string[]
  meta: Partial<AihotMeta>
}

declare interface AihotDbApi {
  list: (params: AihotListParams) => Promise<AihotListResult>
  applyBatch: (batch: AihotBatch) => Promise<void>
  clear: () => Promise<void>
  getMeta: () => Promise<AihotMeta>
  markRead: (id: string) => Promise<void>
}

/** chat 表行载荷（侧栏列表项） */
declare interface ChatItemInput {
  id: string
  name: string
  top: boolean
  workspace: string
  projectId?: string
  taskId?: string
  type?: string
  createdAt: number
  updatedAt: number
}

/** 列表行（top 为 0/1 整数，渲染侧转 boolean） */
declare interface ChatItemRow {
  id: string
  name: string
  top: number
  workspace: string
  projectId: string | null
  taskId: string | null
  type: string | null
  createdAt: number
  updatedAt: number
}

declare interface ChatContentResult {
  data: string | null
  updatedTime: number | null
}

declare interface ChatDbApi {
  list: () => Promise<ChatItemRow[]>
  upsertItem: (item: ChatItemInput) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  getContent: (chatId: string) => Promise<ChatContentResult>
  setContent: (chatId: string, data: string, updatedTime: number) => Promise<void>
  getSub: (chatId: string, subId: string) => Promise<string | null>
  setSub: (chatId: string, subId: string, data: string) => Promise<void>
  getStamp: (chatId: string) => Promise<number | null>
}

/** 生成任务状态：pending=生成中，success=成功，failed=失败 */
declare type ImageGenerateStatus = 'pending' | 'success' | 'failed'

/** image_generate 表行载荷（upsert 全量列 / list 行返回，两用） */
declare interface ImageRecordInput {
  id: string
  prompt: string
  model: string | null
  size: string | null
  /** 图片文件绝对路径（pending 时即为预定路径） */
  path: string | null
  width: number | null
  height: number | null
  status: ImageGenerateStatus
  error: string | null
  createdAt: number
}

declare interface ImageListFilter {
  /** 关键词（>=2 字符才参与匹配，对 prompt 子串） */
  keyword?: string
  /** 状态筛选；空 = 全部 */
  status?: ImageGenerateStatus
}

declare interface ImageListParams {
  filter: ImageListFilter
  limit: number
  offset: number
}

declare interface ImageListResult {
  items: ImageRecordInput[]
  total: number
}

declare interface ImageDbApi {
  list: (params: ImageListParams) => Promise<ImageListResult>
  upsert: (record: ImageRecordInput) => Promise<void>
  delete: (id: string) => Promise<void>
}

// ── 模型健康检测域（可用性检测工具） ─────────────────

/** 检测套餐：basic=基础检测（4 项），full=完整检测（12 项） */
declare type HealthCheckMode = 'basic' | 'full'

/** 任务状态：running=检测中，finished=正常结束，stopped=被停止或应用中断 */
declare type HealthTaskStatus = 'running' | 'finished' | 'stopped'

/** 单项结果：pass=通过，warn=警告，fail=失败，skip=跳过（该项不适用） */
declare type HealthItemStatus = 'pass' | 'warn' | 'fail' | 'skip'

/** 任务级风险结论：healthy=健康，risky=有风险，danger=高风险，unknown=未定（检测中/无有效项） */
declare type HealthConclusion = 'healthy' | 'risky' | 'danger' | 'unknown'

/** 接口协议格式（与 AiProvideFormat 同构） */
declare type HealthApiFormat = 'chat' | 'anthropic' | 'responses'

/** 单个检测项结果（items JSON 列的元素） */
declare interface HealthItemResult {
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
declare interface HealthLogEntry {
  time: number
  level: 'info' | 'warn' | 'error'
  message: string
}

/** model_health 表行载荷（upsert 全量列 / list 行返回，两用；API 密钥不落库；报告动态生成不进库） */
declare interface HealthRecordInput {
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

declare interface HealthListParams {
  limit: number
  offset: number
}

declare interface HealthListResult {
  items: HealthRecordInput[]
  total: number
}

declare interface HealthDbApi {
  list: (params: HealthListParams) => Promise<HealthListResult>
  upsert: (record: HealthRecordInput) => Promise<void>
  delete: (id: string) => Promise<void>
}

declare interface DbApi {
  aihot: AihotDbApi
  chat: ChatDbApi
  image: ImageDbApi
  health: HealthDbApi
}
