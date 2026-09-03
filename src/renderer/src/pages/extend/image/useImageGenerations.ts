// ==========================================
//  文生图页数据源：生成记录分页视图态 + 主进程 ImageService 的指令薄代理。
//  任务编排与运行态（提交 / 轮询 / 落盘 / 收尾）全在 main 的 ImageService 单例——
//  生成进展经 image:recordChanged 广播就地替换列表项，跨路由、跨刷新均不丢状态；
//  本侧只持有分页 / 关键词等视图状态，未来新增生图页面可直接消费同一服务。
//  设计风格解析留在渲染层（拼好最终 prompt + styleName 快照传主进程，主进程保持 design 无关）。
// ==========================================
import { useDesignStyleStore, useSettingDefaultStore } from '@/store'
import { buildDesignStylePrompt } from '@/modules/design'
import { MessageUtil } from '@/utils/modal'
import { canResumePoll } from './image-page-utils'

/** 每页条数 */
const PAGE_SIZE = 24

const createImageGenerations = () => {
  /** 当前已加载的多页记录（created_at 倒序） */
  const list = ref<ImageRecordInput[]>([])
  /** 匹配筛选的总条数（hasMore 判定 / 计数展示） */
  const total = ref(0)
  /** 搜索关键词（对外部 watchDebounced 驱动 refresh） */
  const keyword = ref('')
  const initLoading = ref(false)
  const moreLoading = ref(false)
  /** 陈旧请求丢弃标记：防快速切换关键词导致乱序覆盖 */
  let seq = 0

  const hasMore = computed(() => list.value.length < total.value)

  const query = async (reset: boolean): Promise<void> => {
    const token = ++seq
    if (reset) initLoading.value = true
    else moreLoading.value = true
    try {
      const res = await window.preload.image.list({
        filter: { keyword: keyword.value },
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

  // 订阅主进程广播：生成生命周期推进就地替换列表项（含本页发起 / 其他窗口发起的任务）
  window.preload.image.onRecordChanged((record) => {
    const idx = list.value.findIndex((it) => it.id === record.id)
    if (idx >= 0) list.value[idx] = record
  })

  /**
   * 发起一次生成：主进程建 pending 记录（经广播/返回值上屏），后续状态由广播推进。
   * model 为服务端生图档位 code，缺省回退默认生图模型；styleId 选中时把风格名快照
   * 随参数落库（styleName），风格提示词拼进实际请求（记录保留用户原始 prompt）。
   * 同一时刻可并行多个任务（主进程独立推进，互不阻塞）。
   */
  const generate = async (
    promptText: string,
    size?: string,
    model?: string,
    styleId?: string
  ): Promise<void> => {
    const prompt = promptText.trim()
    if (!prompt) return

    const modelKey = model?.trim() || useSettingDefaultStore().state.defaultImageModel
    if (!modelKey) {
      MessageUtil.warning('请先选择生图模型')
      return
    }

    // 设计风格解析前置：name 快照随记录落库（记录出处），提示词只拼进实际请求
    let requestPrompt = prompt
    let styleName: string | null = null
    const styleKey = styleId?.trim()
    if (styleKey) {
      try {
        const style = await useDesignStyleStore().getDetail(styleKey)
        if (style) {
          styleName = style.name
          requestPrompt = `${prompt}\n\n${buildDesignStylePrompt(style)}`
        }
      } catch {
        // 风格详情读取失败按无风格生成，不阻断任务
      }
    }

    const res = await window.preload.image.generate({
      prompt: requestPrompt,
      model: modelKey,
      size,
      styleName,
      record: true
    })
    if (res.phase === 'started') {
      list.value.unshift(res.record)
      total.value += 1
    }
  }

  /**
   * 续轮询一个异步任务型失败记录：主进程对同一远端 task_id 按剩余窗口继续查询
   * （不重新提交任务、不重复扣费），记录原地改回 pending，后续状态经广播推进。
   * 非可续失败（已确认终态 / 已超窗口）直接提示不可重试。
   */
  const resumeRetry = async (record: ImageRecordInput): Promise<void> => {
    if (record.status !== 'failed' || !record.taskId) return
    if (!canResumePoll(record)) {
      MessageUtil.warning('该任务已超过可查询窗口或已结束：无法续轮询，请重新生成')
      return
    }
    await window.preload.image.resume(record.id)
  }

  /** 删除记录（主进程联动取消 pending 任务与删除落盘文件），本侧同步列表视图 */
  const remove = async (id: string): Promise<void> => {
    await window.preload.image.remove(id)
    if (list.value.some((it) => it.id === id)) {
      list.value = list.value.filter((it) => it.id !== id)
      total.value = Math.max(0, total.value - 1)
    }
  }

  /** 初始化：首屏查询（遗留 pending 的收尾由主进程启动时完成，运行中任务跨刷新存活） */
  const init = async (): Promise<void> => {
    await query(true)
  }

  return {
    list,
    total,
    keyword,
    initLoading,
    moreLoading,
    hasMore,
    refresh,
    loadMore,
    generate,
    remove,
    resumeRetry,
    init
  }
}

let instance: ReturnType<typeof createImageGenerations> | null = null

/** 模块级单例：视图状态跨路由切换存活（任务运行态在主进程，不受刷新影响） */
export const useImageGenerations = (): ReturnType<typeof createImageGenerations> => {
  if (!instance) instance = createImageGenerations()
  return instance
}
