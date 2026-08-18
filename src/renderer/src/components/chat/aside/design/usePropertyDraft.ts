import { computed, reactive, ref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { MessageUtil } from '@/utils/modal'
import type {
  CanvasFontWeight,
  CanvasLayoutSize,
  CanvasNode,
  CanvasPaint,
  CanvasStore,
  CanvasTextAlign,
  CanvasTextCase
} from '@/modules/canvas'

/** 属性面板可编辑字段的本地草稿（对齐 nodePatchSchemaT 白名单；x/y 不提供编辑） */
export interface PropertyDraft {
  width?: number | CanvasLayoutSize
  height?: number | CanvasLayoutSize
  opacity?: number
  fill?: CanvasPaint
  stroke?: CanvasPaint
  strokeWidth?: number
  cornerRadius?: number | number[]
  sides?: number
  corners?: number
  innerRadius?: number
  startAngle?: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: CanvasFontWeight
  italic?: boolean
  letterSpacing?: number
  lineHeight?: number | 'AUTO'
  textAlign?: CanvasTextAlign
  textCase?: CanvasTextCase
}

/** 画笔为渐变对象时只读展示（不提供编辑） */
export const isGradientPaint = (paint: CanvasPaint | undefined): boolean => typeof paint === 'object'

/**
 * 属性面板草稿状态：编辑只改本地 draft（不落盘），点「保存」才计算与节点的 diff，
 * 经 batchEdit update 写回（TypeBox 白名单校验 + 落盘 + 触发画布重渲染）。
 */
export const usePropertyDraft = (options: {
  node: ComputedRef<CanvasNode | null>
  nodeId: Ref<string | undefined>
  store: ComputedRef<CanvasStore>
}) => {
  const { node, nodeId, store } = options
  const draft = reactive<PropertyDraft>({})

  const snapshot = (n: CanvasNode): PropertyDraft => ({
    width: n.width,
    height: n.height,
    opacity: n.opacity,
    fill: n.fill,
    stroke: n.stroke,
    strokeWidth: n.strokeWidth,
    cornerRadius: n.cornerRadius,
    sides: n.sides,
    corners: n.corners,
    innerRadius: n.innerRadius,
    startAngle: n.startAngle,
    text: n.text,
    fontSize: n.fontSize,
    fontFamily: n.fontFamily,
    fontWeight: n.fontWeight,
    italic: n.italic,
    letterSpacing: n.letterSpacing,
    lineHeight: n.lineHeight,
    textAlign: n.textAlign,
    textCase: n.textCase
  })

  /** 与当前节点的字段差异（保存时作为 update patch 提交；undefined 值即删除该属性） */
  const diffPatch = computed<Record<string, unknown>>(() => {
    const n = node.value
    if (!n) return {}
    const patch: Record<string, unknown> = {}
    for (const key of Object.keys(draft) as Array<keyof PropertyDraft>) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(n[key])) patch[key] = draft[key]
    }
    return patch
  })

  const dirty = computed(() => Object.keys(diffPatch.value).length > 0)

  // 选中变化强制重建草稿；同节点外部更新（AI 编辑 / 画布拖拽）仅在没有未保存修改时跟随
  watch(
    node,
    (n, old) => {
      if (!n) return
      if (n.id !== old?.id || !dirty.value) Object.assign(draft, snapshot(n))
    },
    { immediate: true, deep: true }
  )

  const saving = ref(false)

  const handleSave = async () => {
    const id = nodeId.value
    const patch = { ...diffPatch.value }
    if (!id || !Object.keys(patch).length || saving.value) return
    saving.value = true
    try {
      const { results } = await store.value.batchEdit([{ op: 'update', path: id, patch }])
      const first = results[0]
      if (first && typeof first === 'object' && 'error' in first && typeof first.error === 'string') {
        MessageUtil.error('保存失败', first.error)
        return
      }
      MessageUtil.success('已保存')
    } finally {
      saving.value = false
    }
  }

  /** 画笔取色：纯色原样；$token 解析调色板（编辑后固化为纯色）；'none' 视为无色 */
  const paintColor = (paint: CanvasPaint | undefined): string | undefined => {
    if (typeof paint !== 'string' || paint === '' || paint === 'none') return undefined
    if (paint.startsWith('$')) return store.value.current.value?.palette?.[paint.slice(1)]
    return paint
  }

  /** 颜色选择器字段：取值解析画笔展示色，写值固化纯色（清除写 'none'，patch 无法删除字段） */
  const makeColorField = (key: 'fill' | 'stroke') =>
    computed({
      get: () => paintColor(draft[key]),
      set: (v: unknown) => {
        draft[key] = typeof v === 'string' && v !== '' ? v : 'none'
      }
    })

  return {
    draft,
    dirty,
    saving,
    handleSave,
    fillColor: makeColorField('fill'),
    strokeColor: makeColorField('stroke')
  }
}
