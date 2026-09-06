<template>
  <iframe ref="frameRef" class="note-card-frame" :style="{ height: `${frameHeight}px` }"></iframe>
</template>

<script lang="ts" setup>
import { buildCardStyleCss } from '@/global/card-style-props'
import { normalizeCardStyleCss, normalizeCardStyleTemplate } from '@/global/card-style-template'
import { CARD_BASE_CSS, CARD_GAP, DEFAULT_CARD_TEMPLATE, renderCardTemplate } from './card-template'
import { escapeHtml } from './note-markdown'

/**
 * 笔记卡片渲染器（iframe 隔离，样式不污染主文档）：
 * - 卡片骨架由模板决定：风格自带 template（data-nc 插槽契约，@/components/card/card-template）
 *   或默认骨架；样式三层叠加：注册表 CSS（nc-style）→ 骨架基础 CSS（nc-base）→ 风格自由 CSS（nc-extra）
 * - 预览按容器宽度缩放（transform scale）；导出走屏幕外 iframe 以 1:1 逻辑尺寸逐张 snapdom
 * - 分页 = **实测装箱**：先在探针卡里渲染全部块、量取每块真实 offsetTop/offsetHeight
 *   （首页含卡头+标题占位、后续页仅页尾占位），再按真实高度切页——无估算偏差
 * - 图片异步加载完成后再触发一次重分页（图片有缓存，二次量取即准确）
 */
const props = withDefaults(
  defineProps<{
    /** 卡片样式键值对（键必须在注册表白名单内，已归一化） */
    styleProps: Record<string, string>
    /** HTML 模板（data-nc 插槽契约；空 = 默认骨架） */
    template?: string
    /** 风格自定义 CSS（注入在注册表与骨架样式之后，可覆盖） */
    extraCss?: string
    /** 卡片标题（可空，仅首页展示） */
    title?: string
    /** markdown 渲染出的 HTML 块数组（图片 src 已解析为可访问 URL） */
    blocks: Array<string>
    /** 作者名（可空，仅首页卡头展示） */
    author?: string
    /** 作者日期（可空，紧随作者名的小字，仅首页卡头展示） */
    date?: string
    /** 作者头像 URL（可空，由调用方把相对路径解析为 /file 资源面 URL） */
    avatarUrl?: string
    /** 页尾水印文字（可空，每张卡底部展示） */
    watermark?: string
    /** 整卡模式：不分页、内容溢出裁切（风格预览面用） */
    fixed?: boolean
  }>(),
  {
    template: '', extraCss: '', title: '', author: '', avatarUrl: '', watermark: '', date: '', fixed: false
  }
)

const emit = defineEmits<{ change: [pageCount: number] }>()

/** 卡片逻辑尺寸（3:4），导出按此尺寸 × pixelScale 输出 */
const CARD_W = 360
const CARD_H = 480

const frameRef = ref<HTMLIFrameElement | null>(null)
const frameReady = ref(false)
const containerWidth = ref(0)
const pages = ref<Array<Array<string>>>([[]])
const frameHeight = ref(0)
const pageCount = computed(() => pages.value.length)

const currentScale = computed(() => {
  if (containerWidth.value <= 0) return 1
  return Math.min(2, Math.max(0.25, containerWidth.value / CARD_W))
})

// ------------------------------ 卡片骨架 HTML ------------------------------

/** 注册表样式 CSS（键值对逐条生成）与风格自由 CSS（清洗兜底） */
const styleCss = () => buildCardStyleCss(props.styleProps)
const extraCssText = () => normalizeCardStyleCss(props.extraCss)

/** 生效模板（非法或缺 content 插槽时回退默认骨架） */
const templateHtml = () => normalizeCardStyleTemplate(props.template) || DEFAULT_CARD_TEMPLATE

/** 插槽内容（卡头 / 标题 / 页尾，空串的插槽在实例化时被移除） */
const headerInner = () => {
  if (!props.author && !props.avatarUrl) return ''
  const img = props.avatarUrl
    ? `<img class="nc-avatar" src="${escapeHtml(props.avatarUrl)}" />`
    : ''
  const name = props.author
    ? `<span class="nc-author">${escapeHtml(props.author)}${props.date ? `<em class="nc-date">${escapeHtml(props.date)}</em>` : ''}</span>`
    : ''
  return `${img}${name}`
}
const titleInner = () => (props.title ? escapeHtml(props.title) : '')
const footerInner = () => (props.watermark ? escapeHtml(props.watermark) : '')

/** 单页卡片内部 HTML（模板实例化 + 插槽填充） */
const cardInner = (blocks: Array<string>, withTop: boolean) =>
  renderCardTemplate(templateHtml(), {
    header: withTop ? headerInner() : '',
    title: withTop ? titleInner() : '',
    content: blocks.join(''),
    footer: footerInner()
  })

/** 单张卡片 HTML（外层槽位占缩放后尺寸，内层卡片按逻辑尺寸缩放） */
const cardHtml = (blocks: Array<string>, withTop: boolean, scale: number) =>
  `<section class="note-card" style="transform:scale(${scale})">${cardInner(blocks, withTop)}</section>`

const rootHtml = (scale: number) => {
  const w = Math.round(CARD_W * scale * 100) / 100
  const h = Math.round(CARD_H * scale * 100) / 100
  return pages.value
    .map(
      (blocks, index) =>
        `<div class="nc-slot" style="width:${w}px;height:${h}px">` +
        cardHtml(blocks, index === 0, scale) +
        `</div>`
    )
    .join('')
}

const fullHtml = (scale: number) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8">` +
  `<style id="nc-style">${styleCss()}</style>` +
  `<style id="nc-base">${CARD_BASE_CSS}</style>` +
  `<style id="nc-extra">${extraCssText()}</style></head>` +
  `<body><div id="nc-root">${rootHtml(scale)}</div></body></html>`

/** 全量写入文档（导出 iframe 每次重建，保证干净状态） */
const writeDoc = (doc: Document, scale: number) => {
  doc.open()
  doc.write(fullHtml(scale))
  doc.close()
}

/** 增量更新预览文档（避免 srcdoc 重载闪烁） */
const applyDoc = (scale: number) => {
  const doc = frameRef.value?.contentDocument
  if (!doc) return
  const styleEl = doc.getElementById('nc-style')
  const extraEl = doc.getElementById('nc-extra')
  const rootEl = doc.getElementById('nc-root')
  if (!styleEl || !extraEl || !rootEl) {
    writeDoc(doc, scale)
    return
  }
  styleEl.textContent = styleCss()
  extraEl.textContent = extraCssText()
  rootEl.innerHTML = rootHtml(scale)
}

// ------------------------------ 实测分页 ------------------------------

/**
 * 实测装箱：探针卡渲染全部块量真实高度。
 * 首页可用高度含卡头+标题占位，后续页仅页尾占位（transform scale 不影响布局量取）。
 */
const measurePages = (doc: Document): Array<Array<string>> => {
  const all = props.blocks
  if (all.length === 0) return [[]]
  const rootEl = doc.getElementById('nc-root')
  if (!rootEl) return [all]
  const probe = (withTop: boolean): HTMLElement => {
    rootEl.innerHTML =
      `<div class="nc-slot"><section class="note-card" style="transform:scale(${currentScale.value})">` +
      `${cardInner(all, withTop)}</section></div>`
    // 契约兜底：正常必有 content 插槽；异常模板（标记仅在注释中）回退测量画布本身，防空指针
    return (doc.querySelector('.note-card [data-nc="content"]') ??
      doc.querySelector('.note-card')) as HTMLElement
  }
  const contentA = probe(true)
  const limitFirst = contentA.clientHeight
  const boxes = [...contentA.children].map((el) => {
    const node = el as HTMLElement
    return { top: node.offsetTop, bottom: node.offsetTop + node.offsetHeight }
  })
  const limitRest = probe(false).clientHeight
  // 装箱：块 i 加入当前页后底边超出该页可用高度则换页（单块超页独占一页，渲染层裁切）
  const result: Array<Array<string>> = []
  let cur: Array<string> = []
  let startTop = 0
  for (let i = 0; i < all.length; i++) {
    const limit = result.length === 0 ? limitFirst : limitRest
    if (cur.length > 0 && boxes[i].bottom - startTop > limit) {
      result.push(cur)
      cur = []
      startTop = boxes[i].top
    }
    cur.push(all[i])
  }
  if (cur.length > 0) result.push(cur)
  return result.length > 0 ? result : [[]]
}

/** 更新预览（实测分页 → 渲染 → 高度同步） */
const refresh = () => {
  if (!frameReady.value) return
  const doc = frameRef.value?.contentDocument
  if (!doc) return
  pages.value = props.fixed ? [props.blocks] : measurePages(doc)
  applyDoc(currentScale.value)
  frameHeight.value =
    pages.value.length * CARD_H * currentScale.value +
    (pages.value.length - 1) * CARD_GAP +
    4
  emit('change', pages.value.length)
  scheduleImageRelayout(doc)
}

/** 图片异步加载完成后再量取一次（图片加载后高度才真实；二次进来已有缓存不再触发） */
const scheduleImageRelayout = (doc: Document) => {
  const pending = [...doc.querySelectorAll('img')].filter(
    (img) => !(img as HTMLImageElement).complete
  )
  if (pending.length === 0) return
  Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        })
    )
  ).then(() => refresh())
}

// ------------------------------ 生命周期与导出 ------------------------------

let resizeObserver: ResizeObserver | null = null
let exportFrame: HTMLIFrameElement | null = null

onMounted(() => {
  const frame = frameRef.value
  if (!frame) return
  resizeObserver = new ResizeObserver((entries) => {
    containerWidth.value = entries[0]?.contentRect.width ?? 0
  })
  resizeObserver.observe(frame)
  // about:blank 文档同步可写，无需 srcdoc
  frameReady.value = true
  refresh()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  exportFrame?.remove()
  exportFrame = null
})

watch(
  () => [
    props.blocks,
    props.title,
    props.author,
    props.date,
    props.avatarUrl,
    props.watermark,
    props.styleProps,
    props.template,
    props.extraCss
  ],
  () => refresh(),
  { deep: true }
)

watch(currentScale, () => refresh())

/**
 * 导出全部卡片为 PNG Blob（1:1 逻辑尺寸 × pixelScale，屏幕外 iframe 渲染不影响预览）。
 * 风格预览等整卡模式同样适用（单张输出）。
 */
const exportBlobs = async (pixelScale = 3): Promise<Array<Blob>> => {
  if (!exportFrame) {
    exportFrame = document.createElement('iframe')
    exportFrame.style.cssText = 'position:fixed;left:-10000px;top:0;width:360px;border:0'
    document.body.appendChild(exportFrame)
  }
  const doc = exportFrame.contentDocument
  if (!doc) return []
  writeDoc(doc, 1)
  // 等待图片与样式在导出文档中生效
  await new Promise((resolve) => setTimeout(resolve, 120))
  const { snapdom } = await import('@zumer/snapdom')
  const blobs: Array<Blob> = []
  for (const el of [...doc.querySelectorAll('.note-card')]) {
    const result = await snapdom(el, { scale: pixelScale })
    blobs.push(await result.toBlob({ type: 'png' }))
  }
  return blobs
}

defineExpose({ pageCount, exportBlobs })
</script>

<style scoped lang="less">
.note-card-frame {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
}
</style>
