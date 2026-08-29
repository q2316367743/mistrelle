/**
 * 工作条条目搜索：启动时拉取一次条目列表（内置应用 + 系统应用），
 * 动态加载 pinyin-pro 构建全拼/首字母索引后本地过滤。
 * 匹配在渲染层完成：键入零延迟，整条链路仅 getItems / activate 两次 IPC。
 */
import { computed, ref } from 'vue'

/** 归一化：小写 + 去空白，索引字段与查询词统一走此变换 */
const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, '')

interface ItemIndexEntry extends ToolbarItem {
  /** 归一化条目名 */
  key: string
  /** 全拼（英文名原样转写），归一化 */
  full: string
  /** 拼音首字母，归一化 */
  initials: string
}

/** 结果展示上限，防超长列表撑爆 DOM */
const MAX_VISIBLE = 50

const items = ref<ItemIndexEntry[]>([])
const loading = ref(false)
const loadError = ref(false)
let indexReady = false

async function ensureItems(): Promise<void> {
  if (indexReady || loading.value) return
  loading.value = true
  loadError.value = false
  try {
    const list = await window.workbar.getItems()
    // 动态引入：拼音词典体积较大，不阻塞工作条首屏
    const { pinyin } = await import('pinyin-pro')
    items.value = list.map((item) => ({
      ...item,
      key: normalize(item.name),
      full: normalize(pinyin(item.name, { toneType: 'none', type: 'array' }).join('')),
      initials: normalize(
        pinyin(item.name, { pattern: 'first', toneType: 'none', type: 'array' }).join('')
      )
    }))
    indexReady = true
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

function searchItems(query: string): ItemIndexEntry[] {
  const q = normalize(query)
  if (!q) return items.value
  const starts: ItemIndexEntry[] = []
  const contains: ItemIndexEntry[] = []
  for (const item of items.value) {
    if (!item.key.includes(q) && !item.full.includes(q) && !item.initials.includes(q)) continue
    // 命中即排序：名称/全拼前缀优先，其余包含命中靠后
    if (item.key.startsWith(q) || item.full.startsWith(q)) starts.push(item)
    else contains.push(item)
  }
  return [...starts, ...contains]
}

/** 模块级单例：条目与索引全窗口共享，重复唤起不重建 */
export function useAppSearch() {
  const query = ref('')
  const results = computed(() => searchItems(query.value).slice(0, MAX_VISIBLE))
  return { query, results, loading, loadError, ensureItems }
}
