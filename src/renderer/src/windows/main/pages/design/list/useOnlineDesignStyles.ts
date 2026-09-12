import { computed, ref, type Ref } from 'vue'
import {
  AiDesignStyleItem,
  buildAiDesignStyleTokens,
  buildAiDesignStyleTypography,
  normalizeDesignStyleCategory,
  normalizeDesignStyleItem,
  normalizeWhitespaceRatio,
  toAiDesignStyleForm,
  type AiDesignStyle
} from '@/entity'
import { useDesignStyleStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'

/** 将远端详情映射为本地 AiDesignStyle（下载 / 详情共用） */
export function mapRemoteToDesignStyle(d: AuthDesignStyleDetail): AiDesignStyle {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    category: normalizeDesignStyleCategory(d.category),
    tags: d.tags,
    visualPrompt: d.visualPrompt,
    negativePrompt: d.negativePrompt,
    colorPalette: d.colorPalette,
    typography: buildAiDesignStyleTypography(d.typography),
    layoutRules: d.layoutRules,
    tokens: buildAiDesignStyleTokens({
      ...d.tokens,
      border: {
        ...d.tokens.border,
        style: normalizeBorderStyle(d.tokens.border.style)
      }
    }),
    aliases: d.aliases,
    signature: d.signature,
    whitespaceRatio: normalizeWhitespaceRatio(d.whitespaceRatio),
    preferredFormats: d.preferredFormats,
    suitableFor: d.suitableFor,
    unsuitableFor: d.unsuitableFor,
    isSystem: false,
    /** 从在线风格库下载：标记市场来源，非会员时本地列表与选型中隐藏 */
    source: 'market',
    createdAt: Date.parse(d.createdAt) || Date.now(),
    updatedAt: Date.parse(d.updatedAt) || Date.now()
  }
}

function normalizeBorderStyle(value: string): 'solid' | 'dashed' | 'dotted' | 'none' {
  if (value === 'solid' || value === 'dashed' || value === 'dotted' || value === 'none') {
    return value
  }
  return 'solid'
}

/** 列表项投影 → AiDesignStyleItem */
function mapRemoteItem(item: AuthDesignStyleItem): AiDesignStyleItem {
  return normalizeDesignStyleItem({
    id: item.id,
    name: item.name,
    description: item.description,
    category: normalizeDesignStyleCategory(item.category),
    tags: item.tags,
    colorPalette: item.colorPalette,
    typography: buildAiDesignStyleTypography(item.typography),
    tokens: buildAiDesignStyleTokens({
      ...item.tokens,
      border: {
        ...item.tokens.border,
        style: normalizeBorderStyle(item.tokens.border.style)
      }
    }),
    whitespaceRatio: normalizeWhitespaceRatio(item.whitespaceRatio),
    createdAt: Date.parse(item.createdAt) || 0,
    updatedAt: Date.parse(item.updatedAt) || 0
  })
}

/**
 * 在线设计风格列表加载与下载落盘。
 * 会员口径：列表对所有登录用户开放（市场可见），仅下载受 features.extendedDesignStyles 限制。
 */
export function useOnlineDesignStyles(downloadLocked: Ref<boolean>) {
  const store = useDesignStyleStore()
  const onlineList = ref<AiDesignStyleItem[]>([])
  const onlineLoading = ref(false)
  const onlineError = ref('')
  const onlineLoaded = ref(false)

  const loadOnline = async () => {
    onlineLoading.value = true
    onlineError.value = ''
    try {
      const res = await window.preload.auth.listDesignStyles()
      if (!res.ok) {
        onlineError.value = res.msg
        onlineList.value = []
        return
      }
      onlineList.value = res.data.map(mapRemoteItem)
      onlineLoaded.value = true
    } catch (e) {
      onlineError.value = e instanceof Error ? e.message : '加载失败'
      onlineList.value = []
    } finally {
      onlineLoading.value = false
    }
  }

  /** 下载在线风格到本地（保留在线 id，标记市场来源） */
  const downloadToLocal = async (id: string): Promise<boolean> => {
    if (downloadLocked.value) {
      MessageUtil.warning('下载在线风格为会员功能，可在 设置 → 账户 开通')
      return false
    }
    if (store.hasLocal(id)) {
      MessageUtil.info('该风格已在本地')
      return false
    }
    try {
      const res = await window.preload.auth.getDesignStyle(id)
      if (!res.ok) {
        MessageUtil.error(res.msg)
        return false
      }
      const full = mapRemoteToDesignStyle(res.data)
      const savedId = await store.put(toAiDesignStyleForm(full), full.id, 'market')
      if (!savedId) {
        MessageUtil.error('下载失败')
        return false
      }
      MessageUtil.success(`已添加「${full.name}」到本地`)
      return true
    } catch (e) {
      MessageUtil.error('下载失败', e)
      return false
    }
  }

  const isDownloaded = (id: string) => store.hasLocal(id)

  const ensureLoaded = (active: boolean) => {
    if (active && !onlineLoaded.value) {
      void loadOnline()
    }
  }

  return {
    onlineList: computed(() => onlineList.value),
    onlineLoading,
    onlineError,
    onlineLoaded,
    loadOnline,
    downloadToLocal,
    ensureLoaded,
    isDownloaded
  }
}
