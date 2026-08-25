// ==========================================
//  可用性检测工具数据源：检测记录 SQLite 分页 + 检测流程编排（模块级单例）。
//  单例原因：检测是长异步流程，路由切换（页面组件销毁）不应中断或丢失状态——
//  状态存模块闭包，跨页面存活；每次挂载 init() 重新拉取列表即可看到最新进展。
//  约束（同 image 域状态机思路，见 docs/data/01）：
//  - 同一时刻仅允许一个检测任务（running 锁），运行中只能查看历史与进度；
//  - 逐项完成即整行 upsert 落库累积（items / logs JSON 增量），中断不丢已检项；
//  - init 时把孤儿 running 行（上次刷新 / 退出中断）收尾为 stopped 并重算结论；
//  - 数据库只存关键数据：审计报告 HTML 由数据动态生成（health-report.ts），导出时才落盘；
//  - API 密钥只用于当次请求，不写入记录。
// ==========================================
import dayjs from 'dayjs'
import { useSnowflake } from '@/hooks'
import { getModelHealthReportDir } from '@/global/Constant'
import {
  getHealthCheckItems,
  runHealthItem,
  type HealthCheckContext
} from './health-check-items'
import {
  HEALTH_CONCLUSION_LABELS,
  HEALTH_STATUS_LABELS,
  buildHealthConclusion,
  buildHealthReport
} from './health-report'

/** 历史列表每页条数 */
const PAGE_SIZE = 15

/** 发起检测的配置（表单产出） */
export interface HealthCheckConfig {
  apiUrl: string
  apiKey: string
  modelId: string
  format: HealthApiFormat
  mode: HealthCheckMode
  provideName: string | null
  modelName: string | null
}

/** 进行中 / 刚完成的任务实时视图（record 为落库行，items / logs 为解析后的实时数组） */
export interface HealthRun {
  record: HealthRecordInput
  items: HealthItemResult[]
  logs: HealthLogEntry[]
  /** 当前执行到第几项（1-based；0 = 尚未开始） */
  index: number
  total: number
  /** 已请求停止 */
  stopping: boolean
}

/** items JSON 列解析（落库数据容错，坏数据回退空数组） */
export const parseHealthItems = (text: string): HealthItemResult[] => {
  try {
    const parsed = JSON.parse(text) as unknown
    return Array.isArray(parsed) ? (parsed as HealthItemResult[]) : []
  } catch {
    return []
  }
}

/** logs JSON 列解析 */
export const parseHealthLogs = (text: string): HealthLogEntry[] => {
  try {
    const parsed = JSON.parse(text) as unknown
    return Array.isArray(parsed) ? (parsed as HealthLogEntry[]) : []
  } catch {
    return []
  }
}

const createHealthChecks = () => {
  /** 当前已加载的历史记录（created_at 倒序） */
  const list = ref<HealthRecordInput[]>([])
  /** 总条数（hasMore 判定 / 计数展示） */
  const total = ref(0)
  const initLoading = ref(false)
  const moreLoading = ref(false)
  /** 当前任务实时视图（运行中或刚完成；null = 无） */
  const current = ref<HealthRun | null>(null)
  /** 单任务锁：current 存在且未收尾即运行中 */
  const running = computed(() => current.value != null && current.value.record.status === 'running')
  const hasMore = computed(() => list.value.length < total.value)
  /** 陈旧请求丢弃标记 */
  let seq = 0
  /** 运行中任务的任务级停止控制器 */
  let taskController: AbortController | null = null

  const query = async (reset: boolean): Promise<void> => {
    const token = ++seq
    if (reset) initLoading.value = true
    else moreLoading.value = true
    try {
      const res = await window.preload.db.health.list({
        limit: PAGE_SIZE,
        offset: reset ? 0 : list.value.length
      })
      if (token !== seq) return
      total.value = res.total
      if (reset) list.value = res.items
      else list.value = [...list.value, ...res.items]
    } finally {
      if (token === seq) {
        initLoading.value = false
        moreLoading.value = false
      }
    }
  }

  const refresh = (): Promise<void> => query(true)
  const loadMore = (): Promise<void> => query(false)

  /** 写入 DB 并同步列表中的同 id 记录（列表项就地替换） */
  const upsertLocal = async (record: HealthRecordInput): Promise<void> => {
    await window.preload.db.health.upsert(record)
    const idx = list.value.findIndex((it) => it.id === record.id)
    if (idx >= 0) list.value[idx] = record
  }

  /** 孤儿 running 行收尾：stopped + 追加中断日志 + 重算结论（报告动态生成，无需回填） */
  const finalizeOrphan = async (record: HealthRecordInput): Promise<void> => {
    const items = parseHealthItems(record.items)
    const logs = [...parseHealthLogs(record.logs)]
    logs.push({ time: Date.now(), level: 'warn', message: '检测中断：应用退出或页面刷新，已自动收尾' })
    await window.preload.db.health.upsert({
      ...record,
      status: 'stopped',
      conclusion: buildHealthConclusion(items),
      logs: JSON.stringify(logs)
    })
  }

  /**
   * 发起一次检测（单任务锁：运行中直接忽略）。
   * 逐项顺序执行：requiresConnect 项在连通性失败时跳过；每完成一项整行 upsert 落库；
   * 收尾（结束 / 停止 / 异常）统一计算结论、生成审计报告并写入 durationMs。
   */
  const start = async (config: HealthCheckConfig): Promise<void> => {
    if (running.value) return
    const items = getHealthCheckItems(config.mode)
    if (!items.length) return

    taskController = new AbortController()
    const record: HealthRecordInput = {
      id: useSnowflake().nextId(),
      provideName: config.provideName,
      apiUrl: config.apiUrl,
      modelId: config.modelId,
      modelName: config.modelName,
      format: config.format,
      mode: config.mode,
      status: 'running',
      conclusion: 'unknown',
      items: '[]',
      logs: '[]',
      durationMs: null,
      createdAt: Date.now()
    }
    current.value = {
      record,
      items: [],
      logs: [],
      index: 0,
      total: items.length,
      stopping: false
    }
    // 经 ref 深层 reactive 代理读写，保证运行面板 / 历史列表实时刷新
    const live = current.value
    const log = (level: HealthLogEntry['level'], message: string): void => {
      live.logs.push({ time: Date.now(), level, message })
    }

    const startedAt = performance.now()
    const ctx: HealthCheckContext = {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      modelId: config.modelId,
      format: config.format,
      taskSignal: taskController.signal,
      observed: {},
      log
    }
    const modeLabel = config.mode === 'basic' ? '基础检测' : '完整检测'
    log('info', `任务开始：目标 ${config.apiUrl} / 模型 ${config.modelId} / ${modeLabel}（共 ${items.length} 项）`)

    try {
      await upsertLocal({ ...live.record })
      list.value.unshift(live.record)
      total.value += 1

      for (let i = 0; i < items.length; i++) {
        if (taskController.signal.aborted) break
        const item = items[i]
        live.index = i + 1
        // 连通性失败级联：依赖 chat 连通的项直接跳过，避免逐项重复撞同一错误
        if (item.requiresConnect && ctx.observed.connect?.error) {
          live.items.push({
            key: item.key,
            name: item.name,
            dimension: item.dimension,
            status: 'skip',
            latencyMs: null,
            detail: '接口连通失败，跳过检测'
          })
          log('info', `${live.index}/${live.total} ${item.name}：跳过（接口连通失败）`)
        } else {
          const result = await runHealthItem(item, ctx)
          live.items.push(result)
          const level: HealthLogEntry['level'] =
            result.status === 'fail' ? 'error' : result.status === 'warn' ? 'warn' : 'info'
          log(
            level,
            `${live.index}/${live.total} ${result.name}：${HEALTH_STATUS_LABELS[result.status]}${result.detail ? `——${result.detail}` : ''}`
          )
        }
        live.record.items = JSON.stringify(live.items)
        live.record.logs = JSON.stringify(live.logs)
        await upsertLocal({ ...live.record })
      }

      const stopped = taskController.signal.aborted
      live.record.status = stopped ? 'stopped' : 'finished'
      live.record.durationMs = Math.round(performance.now() - startedAt)
      live.record.conclusion = buildHealthConclusion(live.items)
      const pass = live.items.filter((it) => it.status === 'pass').length
      const warn = live.items.filter((it) => it.status === 'warn').length
      const fail = live.items.filter((it) => it.status === 'fail').length
      log(
        stopped ? 'warn' : 'info',
        `任务${stopped ? '被停止' : '结束'}：结论 ${HEALTH_CONCLUSION_LABELS[live.record.conclusion]}（通过 ${pass} / 警告 ${warn} / 失败 ${fail}），总耗时 ${(live.record.durationMs / 1000).toFixed(1)}s`
      )
      live.record.logs = JSON.stringify(live.logs)
      await upsertLocal({ ...live.record })
    } catch (error) {
      // 兜底：编排层异常也收尾为 stopped，不让记录停留在 running
      const message = error instanceof Error ? error.message : String(error)
      log('error', `任务异常终止：${message}`)
      live.record.status = 'stopped'
      live.record.durationMs = Math.round(performance.now() - startedAt)
      live.record.conclusion = buildHealthConclusion(live.items)
      live.record.items = JSON.stringify(live.items)
      live.record.logs = JSON.stringify(live.logs)
      await upsertLocal({ ...live.record })
    } finally {
      taskController = null
    }
  }

  /** 停止当前检测（当前进行中的项收到 abort 后按 skip 收尾，已完成项保留） */
  const stop = (): void => {
    if (!running.value || !taskController) return
    if (current.value) current.value.stopping = true
    taskController.abort()
  }

  /**
   * 导出审计报告 HTML 文件：由记录数据动态生成（EJS 模板在主进程渲染）→
   * 落盘 ~/.mistrelle/health/report/，返回文件绝对路径（调用方负责在文件管理器定位）。
   */
  const exportReport = async (record: HealthRecordInput): Promise<string> => {
    const html = await buildHealthReport({
      ...record,
      items: parseHealthItems(record.items),
      logs: parseHealthLogs(record.logs)
    })
    const dir = getModelHealthReportDir()
    await window.preload.fs.mkdir(dir)
    const safeModel = record.modelId.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40)
    const path = window.preload.path.join(
      dir,
      `模型检测报告-${safeModel}-${dayjs(record.createdAt).format('yyyyMMdd-HHmmss')}.html`
    )
    await window.preload.fs.writeTextFile(path, html)
    return path
  }

  /** 删除历史记录（运行中的记录由 UI 层禁止删除；删的是当前展示记录时清空展示） */
  const remove = async (id: string): Promise<void> => {
    await window.preload.db.health.delete(id)
    list.value = list.value.filter((it) => it.id !== id)
    total.value = Math.max(0, total.value - 1)
    if (current.value?.record.id === id) current.value = null
  }

  /** 初始化：孤儿 running 收尾 + 首屏查询（每次挂载调用，运行中任务不受影响） */
  const init = async (): Promise<void> => {
    const res = await window.preload.db.health.list({ limit: 500, offset: 0 })
    const orphans = res.items.filter(
      (it) => it.status === 'running' && it.id !== current.value?.record.id
    )
    for (const orphan of orphans) await finalizeOrphan(orphan)
    await query(true)
  }

  return {
    list,
    total,
    initLoading,
    moreLoading,
    current,
    running,
    hasMore,
    refresh,
    loadMore,
    start,
    stop,
    exportReport,
    remove,
    init
  }
}

let instance: ReturnType<typeof createHealthChecks> | null = null

/** 模块级单例：检测任务与列表状态跨路由切换存活 */
export const useHealthChecks = (): ReturnType<typeof createHealthChecks> => {
  if (!instance) instance = createHealthChecks()
  return instance
}
