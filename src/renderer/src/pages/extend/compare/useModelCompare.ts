// ==========================================
//  模型对比检测数据源与流程编排（模块级单例）。
//  单例原因：对比是长异步流程，路由切换不应中断或丢失状态——状态存模块闭包跨页面存活。
//  约束（同 test 域 useHealthChecks / image 域状态机思路，见 docs/extend/01）：
//  - 同一时刻仅允许一个对比任务（running 锁）；停止经 AbortController 传到每个在途请求；
//  - 题库 / 对比记录存 SQLite（compare_question / model_compare 表）：记录防抖覆写（800ms 合并
//    每请求完成的写放大），阶段边界与收尾强制落盘；历史列表走 db 分页；
//  - init 时孤儿 running 记录收尾为 stopped 并补生成 md 报告；
//  - 无偏好持久化（config.json 已删）；速度轮 prompt 固定内置 DEFAULT_SPEED_PROMPT；
//  - API 密钥只用于当次请求（内存 targets），绝不写入 db / md。
// ==========================================
import dayjs from 'dayjs'
import { useSnowflake } from '@/hooks'
import { useSettingAiStore } from '@/store'
import {
  DEFAULT_SPEED_PROMPT,
  runConsistencyStage,
  runIdentityStage,
  runQuestionStage,
  runSpeedStage
} from './compare-runner'
import type { CompareRunnerContext } from './compare-runner'
import {
  DEFAULT_COMPARE_QUESTIONS,
  getConsistencyQuestions,
  getEnabledQuestions,
  loadQuestionBank
} from './compare-question-bank'
import { renderCompareReport } from './compare-report'
import { removeRecord, saveRecord, rowToRecord } from './compare-store'
import type {
  CompareExecMode,
  CompareLogEntry,
  CompareModelResult,
  CompareModelSnapshot,
  CompareModelStatus,
  CompareModelTarget,
  CompareRecord
} from './compare-types'
import { COMPARE_EXEC_MODE_LABELS } from './compare-types'

/** 历史列表每页条数 / 落盘防抖间隔（每请求完成都会触发 onUpdate，合并写放大） */
const PAGE_SIZE = 15
const PERSIST_DEBOUNCE_MS = 800

/** 参与对比的模型数量限制 */
export const COMPARE_MODEL_MIN = 2
export const COMPARE_MODEL_MAX = 6

/** 发起对比的配置（表单产出） */
export interface CompareStartConfig {
  /** 选中模型 key 列表（`${provideId}:${identifier}`） */
  modelKeys: string[]
  speedRuns: number
  execMode: CompareExecMode
  consistencyCount: number
}

/** 进行中 / 刚完成的任务实时视图 */
export interface CompareRun {
  record: CompareRecord
  stopping: boolean
  /** 预估总请求数（进度条分母；分子由 results 推导） */
  totalRequests: number
}

/** 从 results 推导已完成请求数（与 totalRequests 同口径） */
export const countDoneRequests = (record: CompareRecord): number =>
  record.results.reduce(
    (sum, it) =>
      sum +
      it.speedRuns.length +
      (it.identity ? 1 : 0) +
      it.questions.length +
      it.consistency.reduce((s, item) => s + (item.error ? 1 : item.answers.length), 0),
    0
  )

const createModelCompare = () => {
  const aiStore = useSettingAiStore()
  /** 题库（DB compare_question 全量，orderIndex 升序；配置表单与题库抽屉共享） */
  const bank = ref<CompareQuestionInput[]>([])
  /** 当前已加载的历史记录（createdAt 倒序，结构化） */
  const list = ref<CompareRecord[]>([])
  /** 总条数（hasMore 判定 / 计数展示） */
  const total = ref(0)
  const initLoading = ref(false)
  const moreLoading = ref(false)
  /** 当前任务实时视图（运行中或刚完成；null = 无） */
  const current = ref<CompareRun | null>(null)
  const running = computed(() => current.value != null && current.value.record.status === 'running')
  const hasMore = computed(() => list.value.length < total.value)
  /** 陈旧请求丢弃标记 */
  let seq = 0
  /** 运行中任务的任务级停止控制器 */
  let taskController: AbortController | null = null
  let persistTimer: ReturnType<typeof setTimeout> | null = null

  const log = (target: CompareRun, level: CompareLogEntry['level'], message: string): void => {
    target.record.logs.push({ time: Date.now(), level, message })
  }

  /** 防抖覆写任务落库（收尾与阶段边界直接 saveRecord 保证不丢） */
  const scheduleSave = (record: CompareRecord): void => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      void saveRecord(record)
    }, PERSIST_DEBOUNCE_MS)
  }

  /** 写入 DB 并同步列表中的同 id 记录（列表项就地替换） */
  const upsertLocal = async (record: CompareRecord): Promise<void> => {
    await saveRecord(record)
    const idx = list.value.findIndex((it) => it.id === record.id)
    if (idx >= 0) list.value[idx] = record
  }

  const query = async (reset: boolean): Promise<void> => {
    const token = ++seq
    if (reset) initLoading.value = true
    else moreLoading.value = true
    try {
      const res = await window.preload.db.compare.record.list({
        limit: PAGE_SIZE,
        offset: reset ? 0 : list.value.length
      })
      if (token !== seq) return
      total.value = res.total
      const items = res.items.map(rowToRecord)
      if (reset) list.value = items
      else list.value = [...list.value, ...items]
    } finally {
      if (token === seq) {
        initLoading.value = false
        moreLoading.value = false
      }
    }
  }

  const refresh = (): Promise<void> => query(true)
  const loadMore = (): Promise<void> => query(false)

  /** 从设置 store 解析模型 key → 检测目标（不经过 optionMap：禁用的提供方 / 模型同样可选） */
  const resolveTarget = (key: string): CompareModelTarget | null => {
    const [provideId, ...rest] = key.split(':')
    const identifier = rest.join(':')
    const provide = aiStore.items.find((it) => it.id === provideId)
    const model = provide?.models.find((it) => it.identifier === identifier)
    if (!provide || !model) return null
    return {
      provideName: provide.name,
      apiUrl: provide.baseUrl,
      apiKey: provide.key,
      modelId: model.identifier,
      modelName: model.model,
      format: provide.format ?? 'chat'
    }
  }

  /**
   * 发起一次对比（单任务锁）。
   * 执行模式：serial 逐模型完整串行 / parallel 全模型并发完整管线 /
   * mixed（默认）速度轮逐模型串行（指标纯净）→ 其余阶段模型间并发。
   */
  const start = async (config: CompareStartConfig): Promise<void> => {
    if (running.value || bank.value.length === 0) return
    const questionBank = bank.value
    const targets = config.modelKeys
      .map(resolveTarget)
      .filter((it): it is CompareModelTarget => it != null)
    if (targets.length < COMPARE_MODEL_MIN) return

    const enabledQuestions = getEnabledQuestions(questionBank)
    const consistencyQuestions = getConsistencyQuestions(questionBank, config.consistencyCount)
    const totalRequests =
      targets.length *
      (config.speedRuns + 1 + enabledQuestions.length + consistencyQuestions.length * 3)

    taskController = new AbortController()
    const results: CompareModelResult[] = targets.map((target) => {
      const snapshot: CompareModelSnapshot = {
        provideName: target.provideName,
        apiUrl: target.apiUrl,
        modelId: target.modelId,
        modelName: target.modelName,
        format: target.format
      }
      return {
        target: snapshot,
        status: 'pending',
        stage: '等待中',
        speedRuns: [],
        speedMedian: null,
        identity: undefined,
        questions: [],
        questionPassed: 0,
        consistency: [],
        usage: { promptTokens: 0, completionTokens: 0 }
      }
    })
    const run: CompareRun = {
      record: {
        id: String(useSnowflake().nextId()),
        createdAt: Date.now(),
        status: 'running',
        config: {
          execMode: config.execMode,
          speedRuns: config.speedRuns,
          consistencyCount: consistencyQuestions.length,
          models: results.map((it) => it.target)
        },
        results,
        logs: [],
        durationMs: null
      },
      stopping: false,
      totalRequests
    }
    current.value = run
    // 经 ref 深层 reactive 代理读写，保证运行面板 / 模型卡片实时刷新
    const live = current.value
    const startedAt = performance.now()
    const modeLabel = COMPARE_EXEC_MODE_LABELS[config.execMode]
    log(live, 'info', `任务开始：${targets.length} 个模型 · ${modeLabel}模式 · 速度轮 ${config.speedRuns} 次 · 题集 ${enabledQuestions.length} 题 · 一致性 ${consistencyQuestions.length} 题`)

    const buildContext = (index: number): CompareRunnerContext => ({
      target: targets[index],
      taskSignal: taskController!.signal,
      log: (level, message) => log(live, level, message),
      onUpdate: () => scheduleSave(live.record)
    })
    const speedStage = (index: number): Promise<void> =>
      runSpeedStage({ ctx: buildContext(index), result: live.record.results[index] }, config.speedRuns, DEFAULT_SPEED_PROMPT)
    const identityStage = (index: number): Promise<void> =>
      runIdentityStage({ ctx: buildContext(index), result: live.record.results[index] })
    const questionStage = (index: number): Promise<void> =>
      runQuestionStage({ ctx: buildContext(index), result: live.record.results[index] }, enabledQuestions)
    const consistencyStage = (index: number): Promise<void> =>
      runConsistencyStage({ ctx: buildContext(index), result: live.record.results[index] }, consistencyQuestions)

    /** 单模型收尾：status 统一流转（阶段函数内部已消化单请求错误，这里只认停止信号） */
    const finalizeModel = (index: number): void => {
      const result = live.record.results[index]
      if (result.status !== 'running') return
      const stopped = taskController?.signal.aborted ?? false
      result.status = stopped ? 'stopped' : 'finished'
      result.stage = stopped ? '已停止' : '已完成'
    }
    /** 完整管线（速度 → 身份 → 题集 → 一致性，模型内串行） */
    const runPipeline = async (index: number): Promise<void> => {
      live.record.results[index].status = 'running'
      await speedStage(index)
      await identityStage(index)
      await questionStage(index)
      await consistencyStage(index)
      finalizeModel(index)
    }

    try {
      await upsertLocal(live.record)
      list.value.unshift(live.record)
      total.value += 1

      if (config.execMode === 'serial') {
        for (let i = 0; i < targets.length; i++) {
          if (taskController!.signal.aborted) break
          await runPipeline(i)
        }
      } else if (config.execMode === 'parallel') {
        await Promise.allSettled(targets.map((_, i) => runPipeline(i)))
      } else {
        // mixed：速度轮逐模型串行（指标纯净、水位恒 1）→ 其余阶段模型间并发
        for (let i = 0; i < targets.length; i++) {
          if (taskController!.signal.aborted) break
          live.record.results[i].status = 'running'
          await speedStage(i)
        }
        await Promise.allSettled(
          targets.map(async (_, i) => {
            await identityStage(i)
            await questionStage(i)
            await consistencyStage(i)
            finalizeModel(i)
          })
        )
      }

      const stopped = taskController?.signal.aborted ?? false
      live.record.status = stopped ? 'stopped' : 'finished'
      live.record.durationMs = Math.round(performance.now() - startedAt)
      log(
        live,
        stopped ? 'warn' : 'info',
        `任务${stopped ? '被停止' : '结束'}：完成请求 ${countDoneRequests(live.record)} / ${live.totalRequests}，总耗时 ${(live.record.durationMs / 1000).toFixed(1)}s`
      )
      await finalizeTask(live)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log(live, 'error', `任务异常终止：${message}`)
      live.record.status = 'stopped'
      live.record.durationMs = Math.round(performance.now() - startedAt)
      await finalizeTask(live)
    } finally {
      if (persistTimer) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
      taskController = null
    }
  }

  /** 任务收尾落盘：状态 / 耗时写库（md 报告不自动生成，由用户手动导出） */
  const finalizeTask = async (live: CompareRun): Promise<void> => {
    await upsertLocal(live.record)
  }

  /**
   * 导出 md 审计报告：渲染（主进程 EJS）→ dialog.save 让用户自选路径 → 写文件 → 文件管理器定位。
   * 用户取消返回 null；成功后返回文件绝对路径。
   */
  const exportReport = async (record: CompareRecord): Promise<string | null> => {
    const md = await renderCompareReport(record)
    const defaultName = `模型对比报告-${dayjs(record.createdAt).format('YYYYMMDD-HHmmss')}.md`
    const path = await window.preload.inject.dialog.save({
      title: '导出对比报告',
      defaultPath: defaultName,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (!path) return null
    await window.preload.fs.writeTextFile(path, md)
    window.preload.inject.shell.showItemInFolder(path)
    return path
  }

  /** 停止当前对比（在途请求 abort，进行中模型按 stopped 收尾，已完成阶段保留） */
  const stop = (): void => {
    if (!running.value || !taskController) return
    if (current.value) current.value.stopping = true
    taskController.abort()
  }

  /** 删除历史记录（运行中由 UI 禁止；删的是当前展示记录时清空展示；仅删 DB 行，用户导出的报告文件不连带删除） */
  const remove = async (id: string): Promise<void> => {
    const record = list.value.find((it) => it.id === id)
    if (!record) return
    await removeRecord(record)
    list.value = list.value.filter((it) => it.id !== id)
    total.value = Math.max(0, total.value - 1)
    if (current.value?.record.id === id) current.value = null
  }

  // ── 题库操作（题库抽屉 / 编辑弹窗调用） ─────────────────

  /** 刷新题库（DB 全量，orderIndex 升序） */
  const refreshBank = async (): Promise<void> => {
    bank.value = await loadQuestionBank()
  }

  /** 单题新增 / 编辑 / 启停（按 key upsert；成功后刷新题库） */
  const upsertQuestion = async (question: CompareQuestionInput): Promise<void> => {
    await window.preload.db.compare.question.upsert(question)
    await refreshBank()
  }

  /** 删除单题 */
  const deleteQuestion = async (key: string): Promise<void> => {
    await window.preload.db.compare.question.delete(key)
    await refreshBank()
  }

  /** 恢复内置默认题库（DB 全量替换） */
  const resetBank = async (): Promise<void> => {
    await window.preload.db.compare.question.replaceAll(DEFAULT_COMPARE_QUESTIONS)
    await refreshBank()
  }

  /**
   * 初始化：题库（空表写种子）+ 历史首屏；孤儿 running 收尾（stopped，补中断日志）。
   * 每次挂载调用，运行中任务不受影响。
   */
  const init = async (): Promise<void> => {
    initLoading.value = true
    try {
      const [loadedBank, res] = await Promise.all([
        loadQuestionBank(),
        window.preload.db.compare.record.list({ limit: 500, offset: 0 })
      ])
      bank.value = loadedBank
      const orphans = res.items
        .map(rowToRecord)
        .filter((it) => it.status === 'running' && it.id !== current.value?.record.id)
      for (const orphan of orphans) {
        orphan.status = 'stopped'
        orphan.logs = [
          ...orphan.logs,
          { time: Date.now(), level: 'warn', message: '对比中断：应用退出或页面刷新，已自动收尾' }
        ]
        await saveRecord(orphan)
      }
      await query(true)
    } finally {
      initLoading.value = false
    }
  }

  return {
    bank,
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
    remove,
    exportReport,
    upsertQuestion,
    deleteQuestion,
    resetBank,
    init
  }
}

let instance: ReturnType<typeof createModelCompare> | null = null

/** 模块级单例：对比任务 / 题库 / 列表状态跨路由切换存活 */
export const useModelCompare = (): ReturnType<typeof createModelCompare> => {
  if (!instance) instance = createModelCompare()
  return instance
}

/** 供 UI 复用的模型状态主题色映射 */
export const COMPARE_MODEL_STATUS_THEMES: Record<CompareModelStatus, 'primary' | 'success' | 'warning' | 'danger' | 'default'> = {
  pending: 'default',
  running: 'primary',
  finished: 'success',
  stopped: 'warning',
  error: 'danger'
}