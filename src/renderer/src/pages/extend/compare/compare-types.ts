// ==========================================
//  模型对比检测：类型定义与展示标签。
//  - 存储为文件（~/.mistrelle/compare/{id}.json + {id}.md），不建 SQLite 表；
//    apiKey 仅存内存（CompareModelTarget），落盘前的 target 均已剥离密钥。
//  - 枚举联合一律独立命名 type（项目约定，方便后期拓展）。
// ==========================================
import type { AiProvideFormat } from '@/entity'

/** 执行模式：全并发 / 混合（速度轮串行+其余并发，默认）/ 全串行 */
export type CompareExecMode = 'parallel' | 'mixed' | 'serial'

/** 任务状态 */
export type CompareTaskStatus = 'running' | 'finished' | 'stopped'

/** 单模型管线状态 */
export type CompareModelStatus = 'pending' | 'running' | 'finished' | 'stopped' | 'error'

/** completion tokens 来源：服务端 usage 精确值 / 字符数估算 */
export type CompareTokenSource = 'usage' | 'estimate'

/** 执行模式中文标签 */
export const COMPARE_EXEC_MODE_LABELS: Record<CompareExecMode, string> = {
  parallel: '全并发',
  mixed: '混合',
  serial: '全串行'
}

/** 执行模式说明（配置表单 radio 描述） */
export const COMPARE_EXEC_MODE_NOTES: Record<CompareExecMode, string> = {
  parallel: '所有模型同时跑完整管线，最快；速度指标受共享带宽 / 限流影响（报告标注并发水位）',
  mixed: '速度轮逐模型串行（指标纯净），身份 / 题集 / 一致性轮模型间并发',
  serial: '逐模型完整串行，最慢但所有指标最纯净'
}

/** 任务状态中文标签 */
export const COMPARE_TASK_STATUS_LABELS: Record<CompareTaskStatus, string> = {
  running: '对比中',
  finished: '已完成',
  stopped: '已停止'
}

/** 单模型状态中文标签 */
export const COMPARE_MODEL_STATUS_LABELS: Record<CompareModelStatus, string> = {
  pending: '等待中',
  running: '检测中',
  finished: '已完成',
  stopped: '已停止',
  error: '异常'
}

/** 检测目标（apiKey 仅内存使用，绝不写入 json / md） */
export interface CompareModelTarget {
  provideName: string
  apiUrl: string
  apiKey: string
  modelId: string
  modelName: string
  format: AiProvideFormat
}

/** 落盘目标（剥离密钥） */
export type CompareModelSnapshot = Omit<CompareModelTarget, 'apiKey'>

/** 单次速度测试结果 */
export interface CompareSpeedRun {
  /** 首个内容块时延（ms） */
  ttftMs: number | null
  /** 首个思考块出现时延（ms）；无思考流为 null */
  thinkMs: number | null
  /** 生成阶段时长（首块 → 末块，ms） */
  genMs: number | null
  /** 整次请求总耗时（ms） */
  totalMs: number | null
  /** 是否输出思考流（reasoning_content） */
  isThinking: boolean
  contentChars: number
  completionTokens: number | null
  tokenSource: CompareTokenSource
  tokPerSec: number | null
  /** 末帧结束原因（length = 触达输出上限被截断） */
  finishReason: string | null
  /** 发起请求时的全局并发水位（评估并发对速度指标的影响） */
  inFlight: number
  error?: string
}

/** 单题测试结果 */
export interface CompareQuestionResult {
  key: string
  tag: string
  question: string
  answer: string
  reference: string
  /** true=关键词判分通过 / false=未通过 / null=请求失败无法判定（需人工复核） */
  pass: boolean | null
  answerChars: number
  truncated: boolean
  error?: string
}

/** 一致性轮单题结果（同题多次重复回答） */
export interface CompareConsistencyResult {
  key: string
  tag: string
  question: string
  answers: string[]
  allSame: boolean
  error?: string
}

/** 身份自述结果 */
export interface CompareIdentityResult {
  content: string
  latencyMs: number
  error?: string
}

/** 单模型完整检测结果 */
export interface CompareModelResult {
  target: CompareModelSnapshot
  status: CompareModelStatus
  /** 当前阶段描述（运行卡片实时展示，如「速度轮 2/3」） */
  stage: string
  speedRuns: CompareSpeedRun[]
  speedMedian: { ttftMs: number | null; tokPerSec: number | null } | null
  identity?: CompareIdentityResult
  questions: CompareQuestionResult[]
  questionPassed: number
  consistency: CompareConsistencyResult[]
  /** 全程累计用量（usage 上报可得时） */
  usage: { promptTokens: number; completionTokens: number }
  error?: string
}

/** 执行日志条目 */
export interface CompareLogEntry {
  time: number
  level: 'info' | 'warn' | 'error'
  message: string
}

/** 任务落盘配置（实际生效参数快照） */
export interface CompareTaskConfig {
  execMode: CompareExecMode
  speedRuns: number
  consistencyCount: number
  models: CompareModelSnapshot[]
}

/** 对比任务完整记录（model_compare 表行 + JSON 列解析后的结构化视图） */
export interface CompareRecord {
  id: string
  createdAt: number
  status: CompareTaskStatus
  config: CompareTaskConfig
  results: CompareModelResult[]
  logs: CompareLogEntry[]
  durationMs: number | null
}
