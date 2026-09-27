import dayjs from 'dayjs'
import type { Component } from 'vue'
import type { ChatMessage } from '@/domain'
import { FileIcon, FileImageIcon, ImageIcon } from 'tdesign-icons-vue-next'
import { articleVersionTitle } from '@/windows/main/modules/tool/components/article/articleTypes'
import {
  buildArticleRoot,
  getArticleStore
} from '@/windows/main/modules/tool/components/article/articleStore'

/**
 * 「文件」tab 数据层：把本聊天落盘的三类产物汇总成一张列表（每条带定位所需的绝对路径）。
 * 零新增 IPC，两类来源各取所长：
 * - **导出图片 / 生图素材**：读本聊天的工具调用记录（`canvas_export` / `image_generate` 返回的
 *   path 就是真实落点）。**不能扫沙盒 outputs 猜**——AI 常按用户工作空间约定把成品写到
 *   `{workspace}/选题/<主题>/P01_封面.png` 这类显式路径，只有调用记录认得出。
 * - **正文文件**：扫文章库 `drafts/`（覆盖 AI `article_write` 与「正文」页自动落盘两条写入路径，
 *   且能借索引把文件名映射成「标题 · 类型 · 第N版」）。
 * 边界（有意收窄）：手动「下载图片 / PSD」（保存对话框自选路径）与 AI 用 `file_write` / `cli_run`
 * 写出的文件都不入列表——前者无法追踪，后者不属于这两类产物。
 */

export type XhsFileKind = 'export' | 'image' | 'article'

/** 列表条目：主行语义名 + 次行「位置 · 大小 · 时间」+ 格式标 */
export interface XhsFileItem {
  path: string
  label: string
  meta: string
  tag: string
  mtime: number
}

/** 分组展示配置：标题 / 空态引导 / 图标；数组顺序即分组顺序 */
const XHS_FILE_KINDS: Array<{
  kind: XhsFileKind
  title: string
  emptyHint: string
  icon: Component
}> = [
  {
    kind: 'export',
    title: '导出图片',
    emptyHint: '让 AI 导出画布（canvas_export），成品图会出现在这里',
    icon: FileImageIcon
  },
  {
    kind: 'image',
    title: '生图素材',
    emptyHint: '让 AI 生成素材（image_generate），图片会出现在这里',
    icon: ImageIcon
  },
  {
    kind: 'article',
    title: '正文文件',
    emptyHint: '让 AI 写发布文案，或直接在「正文」页起草，文件会出现在这里',
    icon: FileIcon
  }
]

/** 导出画布的工具名（产物 = 成品图） */
const EXPORT_TOOL_NAME = 'canvas_export'
/** 生图的工具名（产物 = 素材图，可一次多张） */
const IMAGE_TOOL_NAME = 'image_generate'

/** 一次工具调用产出的文件 */
interface ToolFileCall {
  path: string
  /** 调用时间：同组按此升序 = 页序 / 生成顺序 */
  time: number
}

/** 工具参数 / 结果都是 JSON 字符串，解析失败按无内容处理 */
const parseJson = (text?: string): Record<string, unknown> | null => {
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const readString = (value: unknown): string => (typeof value === 'string' ? value : '')

const readStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** 同一路径只留最后一次调用（重导覆盖），按调用时间升序 */
const dedupeCalls = (calls: ToolFileCall[]): ToolFileCall[] => {
  const latest = new Map<string, ToolFileCall>()
  for (const call of calls) latest.set(call.path, call)
  return [...latest.values()].sort((a, b) => a.time - b.time)
}

/**
 * 从消息流收集两类工具产出的文件路径：优先**结果**里的 path（工具解析后的真实落点，
 * 含缺省路径与显式路径两种情形），结果缺失时回落**参数**里的 path。
 */
const collectToolFileCalls = (
  messages: ChatMessage[]
): { export: ToolFileCall[]; image: ToolFileCall[] } => {
  const exports: ToolFileCall[] = []
  const images: ToolFileCall[] = []
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue
    for (const item of message.content) {
      if (item.type !== 'toolcall' || item.status !== 'complete') continue
      const { toolCallName, args, result } = item.data
      if (toolCallName !== EXPORT_TOOL_NAME && toolCallName !== IMAGE_TOOL_NAME) continue
      const inResult = parseJson(result)
      const inArgs = parseJson(args)
      if (toolCallName === EXPORT_TOOL_NAME) {
        const path = readString(inResult?.path) || readString(inArgs?.path)
        if (path) exports.push({ path, time: item.time })
        continue
      }
      // image_generate：一次可出多张，结果 paths 为全量；旧形状只有单张 path
      const paths = readStringList(inResult?.paths)
      const single = readString(inResult?.path) || readString(inArgs?.path)
      for (const path of paths.length ? paths : single ? [single] : []) {
        images.push({ path, time: item.time })
      }
    }
  }
  return { export: dedupeCalls(exports), image: dedupeCalls(images) }
}

/** 磁盘实况：文件已被移走 / 删除（或读取失败）返回 null，列表只列真实存在的文件 */
const statFile = async (path: string): Promise<FileStat | null> => {
  try {
    const entry = await window.preload.fs.stat(path)
    return entry.isFile ? entry : null
  } catch {
    return null
  }
}

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** 次行文案：位置 / 文件名（主行未用时）· 大小 · 修改时间（只取 size / mtime，readDir 与 stat 两种来源通吃） */
const buildMeta = (entry: { size: number; mtime: number }, extra?: string): string =>
  [extra, formatSize(entry.size), dayjs(entry.mtime).format('MM-DD HH:mm')]
    .filter(Boolean)
    .join(' · ')

/** 右侧格式标：取文件名后缀（png / psd / jpg / md …） */
const fileTag = (name: string): string => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toUpperCase() ?? '文件'

/** 工具产物 → 列表条目：主行文件名，次行带所在目录（成品可能落在工作空间任意目录） */
const buildToolItems = async (calls: ToolFileCall[]): Promise<XhsFileItem[]> => {
  const settled = await Promise.all(
    calls.map(async (call) => ({ call, entry: await statFile(call.path) }))
  )
  const list: XhsFileItem[] = []
  for (const { call, entry } of settled) {
    if (!entry) continue
    const name = window.preload.path.basename(call.path)
    list.push({
      path: call.path,
      label: name,
      meta: buildMeta(entry, window.preload.path.basename(window.preload.path.dirname(call.path))),
      tag: fileTag(name),
      mtime: entry.mtime
    })
  }
  return list
}

/** 目录不存在（产物目录按需创建）或读取失败一律按空列表处理 */
const readDirSafe = async (dir: string): Promise<FileItem[]> => {
  if (!dir || !window.preload.fs.existsSync(dir)) return []
  try {
    return (await window.preload.fs.readDir(dir)).filter((item) => item.isFile)
  } catch {
    return []
  }
}

/** 正文文件：articles/drafts/*.md，用索引反查「标题 · 类型 · 第N版」，索引缺失（外部直写）回落文件名 */
const buildArticleItems = async (root: string): Promise<XhsFileItem[]> => {
  const store = getArticleStore(root)
  await store.refresh()
  const names = new Map<string, string>()
  for (const article of store.project.value?.articles ?? []) {
    for (const entry of article.types) {
      for (const version of entry.versions ?? []) {
        names.set(
          version.file,
          `${article.title || article.id} · ${entry.type} · ${articleVersionTitle(version)}`
        )
      }
    }
  }
  const list: XhsFileItem[] = []
  for (const entry of await readDirSafe(window.preload.path.join(root, 'drafts'))) {
    if (!entry.name.toLowerCase().endsWith('.md')) continue
    const label = names.get(`drafts/${entry.name}`) ?? entry.name
    list.push({
      path: entry.path,
      label,
      meta: buildMeta(entry, label === entry.name ? undefined : entry.name),
      tag: 'MD',
      mtime: entry.mtime
    })
  }
  return list.sort((a, b) => b.mtime - a.mtime)
}

export interface XhsFilesSource {
  sandbox: string
  workspace: string
  /** 本聊天的消息流：图片两类产物的唯一来源 */
  messages: ChatMessage[]
  /** 本 tab 是否当前可见：切到本页时重扫（不做定时轮询） */
  active: boolean
}

export const useXhsFiles = (source: () => XhsFilesSource) => {
  const loading = ref(false)
  const items = ref<Record<XhsFileKind, XhsFileItem[]>>({ export: [], image: [], article: [] })

  const sections = computed(() =>
    XHS_FILE_KINDS.map((meta) => ({ ...meta, items: items.value[meta.kind] }))
  )

  const toolCalls = computed(() => collectToolFileCalls(source().messages))

  /** 文章根：优先工作空间（与「正文」页同源），正文文件可能落在沙盒之外 */
  const articleRoot = computed(() => buildArticleRoot(source().workspace, source().sandbox))

  /** 产物签名：AI 又导出 / 又生图时列表跟着长（本页可见才重扫） */
  const toolSignature = computed(() =>
    [...toolCalls.value.export, ...toolCalls.value.image]
      .map((call) => `${call.time}:${call.path}`)
      .join('|')
  )

  const refresh = async (): Promise<void> => {
    if (!source().sandbox) return
    loading.value = true
    try {
      const calls = toolCalls.value
      const [exported, images, articles] = await Promise.all([
        buildToolItems(calls.export),
        buildToolItems(calls.image),
        buildArticleItems(articleRoot.value)
      ])
      items.value = { export: exported, image: images, article: articles }
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    if (source().active) void refresh()
  })

  // lazy 挂载后常驻，故切回本页要重扫：产物写在磁盘上，切页 / AI 新导出后刷新即够，不做定时轮询
  watch(
    () => source().active,
    (value) => {
      if (value) void refresh()
    }
  )

  watch(toolSignature, () => {
    if (source().active) void refresh()
  })

  // 切换聊天 / 工作空间（沙盒、文章根变化）时，当前可见才重扫
  watch(articleRoot, () => {
    if (source().active) void refresh()
  })

  return { loading, sections, refresh }
}
