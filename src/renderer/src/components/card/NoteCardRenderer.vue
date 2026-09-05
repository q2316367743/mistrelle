<template>
  <iframe ref="frameRef" class="note-card-frame" :style="{ height: `${frameHeight}px` }"></iframe>
</template>

<script lang="ts" setup>
import { buildCardStyleCss } from '@/global/card-style-props'
import { escapeHtml } from './note-markdown'

/**
 * 笔记卡片渲染器（iframe 隔离，样式不污染主文档）：
 * - 卡片骨架固定：卡头（作者头像+名字，仅首页）+ 标题（仅首页）+ 正文 + 页尾水印（每张卡），
 *   样式 CSS 由注册表键值对生成注入
 * - 预览按容器宽度缩放（transform scale）；导出走屏幕外 iframe 以 1:1 逻辑尺寸逐张 snapdom
 * - 分页 = **实测装箱**：先在探针卡里渲染全部块、量取每个块的真实 offsetTop/offsetHeight
 *   （首条款包括作者+标题占位、后续款仅页尾占位），再按真实高度切页——无估算偏差
 * - 图片异步加载完成后再触发一次重分页（图片有缓存，二次量取即准确）
 */
const props = withDefaults(
  defineProps<{
    /** 卡片样式键值对（键必须在注册表白名单内，已归一化） */
    styleProps: Record<string, string>
    /** 卡片标题（可空，仅首页展示） */
    title?: string
    /** markdown 渲染出的 HTML 块数组（图片 src 已解析为可访问 URL） */
    blocks: Array<string>
    /** 作者名（可空，仅首页卡头展示） */
    author?: string
    /** 作者头像 URL（可空，由调用方把相对路径解析为 /file 资源面 URL） */
    avatarUrl?: string
    /** 页尾水印文字（可空，每张卡底部展示） */
    watermark?: string
    /** 整卡模式：不分页、内容溢出裁切（风格预览面用） */
    fixed?: boolean
  }>(),
  { title: '', author: '', avatarUrl: '', watermark: '', fixed: false }
)

const emit = defineEmits<{ change: [pageCount: number] }>()

/** 卡片逻辑尺寸（3:4），导出按此尺寸 × pixelScale 输出 */
const CARD_W = 360
const CARD_H = 480
const CARD_GAP = 16

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

/** 卡片样式 CSS（注册表生成） */
const styleCss = () => buildCardStyleCss(props.styleProps)

/** 模板自有基础 CSS（骨架布局；.nc-content 需 position:relative 供分页量取 offsetTop） */
const baseCss = () => `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
body{-webkit-font-smoothing:antialiased}
#nc-root{display:flex;flex-direction:column;gap:${CARD_GAP}px}
.nc-slot{overflow:hidden}
.note-card{width:${CARD_W}px;height:${CARD_H}px;transform-origin:top left;overflow:hidden;display:flex;flex-direction:column}
.nc-header{flex:none;display:flex;align-items:center;gap:8px;margin-bottom:14px}
.nc-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover}
.nc-author{line-height:1.2}
.nc-title{flex:none}
.nc-content{flex:1;min-height:0;position:relative;overflow:hidden}
.nc-footer{flex:none;margin-top:12px;text-align:center}
.nc-content p{margin:0 0 .8em}
.nc-content p:last-child{margin-bottom:0}
.nc-content ul,.nc-content ol{margin:0 0 .8em;padding-left:1.4em}
.nc-content h1,.nc-content h2,.nc-content h3,.nc-content h4,.nc-content h5,.nc-content h6{margin:0 0 .6em;line-height:1.35}
.nc-content h1{font-size:1.5em}.nc-content h2{font-size:1.3em}.nc-content h3{font-size:1.2em}
.nc-content h4,.nc-content h5,.nc-content h6{font-size:1.1em}
.nc-content img{max-width:100%;display:block;margin:8px auto}
.nc-content blockquote{margin:0 0 .8em;padding:10px 12px;border-left:3px solid;border-radius:4px}
.nc-content blockquote p{margin:0}
.nc-content blockquote p:last-child{margin-bottom:0}
.nc-content hr{border:none;height:2px;width:40%;margin:1.2em auto}
.nc-content pre{padding:12px;border-radius:8px;background:rgba(128,128,128,.12);white-space:pre-wrap;word-break:break-all;margin:0 0 .8em}
.nc-content code{font-family:Menlo,Consolas,monospace;font-size:.9em}
`

const headerHtml = () => {
  if (!props.author && !props.avatarUrl) return ''
  const img = props.avatarUrl
    ? `<img class="nc-avatar" src="${escapeHtml(props.avatarUrl)}" />`
    : ''
  const name = props.author ? `<span class="nc-author">${escapeHtml(props.author)}</span>` : ''
  return `<div class="nc-header">${img}${name}</div>`
}

const titleHtml = () => (props.title ? `<h1 class="nc-title">${escapeHtml(props.title)}</h1>` : '')

const footerHtml = () =>
  props.watermark ? `<div class="nc-footer">${escapeHtml(props.watermark)}</div>` : ''

/** 首页卡头（作者 + 标题，仅首页出现） */
const topHtml = () => `${headerHtml()}${titleHtml()}`

/** 单张卡片 HTML（外层槽位占缩放后尺寸，内层卡片按逻辑尺寸缩放） */
const cardHtml = (blocks: string[], withTop: boolean, scale: number) =>
  `<section class="note-card" style="transform:scale(${scale})">` +
  `${withTop ? topHtml() : ''}` +
  `<div class="nc-content">${blocks.join('')}</div>` +
  `${footerHtml()}` +
  `</section>`

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
  `<style id="nc-base">${baseCss()}</style></head>` +
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
  const rootEl = doc.getElementById('nc-root')
  if (!styleEl || !rootEl) {
    writeDoc(doc, scale)
    return
  }
  styleEl.textContent = styleCss()
  rootEl.innerHTML = rootHtml(scale)
}

// ------------------------------ 实测分页 ------------------------------

/**
 * 实测装箱：探针卡渲染全部块量真实高度。
 * 首页可用高度含作者+标题占位，后续页仅页尾占位（transform scale 不影响布局量取）。
 */
const measurePages = (doc: Document): Array<Array<string>> => {
  const all = props.blocks
  if (all.length === 0) return [[]]
  const rootEl = doc.getElementById('nc-root')
  if (!rootEl) return [all]
  const probe = (withTop: boolean): HTMLElement => {
    rootEl.innerHTML =
      `<div class="nc-slot"><section class="note-card" style="transform:scale(${currentScale.value})">` +
      `${withTop ? topHtml() : ''}` +
      `<div class="nc-content">${all.join('')}</div>` +
      `${footerHtml()}` +
      `</section></div>`
    return doc.querySelector('.nc-content') as HTMLElement
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
    pages.value.length * CARD_H * currentScale.value + (pages.value.length - 1) * CARD_GAP + 4
  emit('change', pages.value.length)
  scheduleImageRelayout(doc)
}

/** 图片异步加载完成后再量取一次（图片加载后高度才真实；二次进来已有缓存不再触发） */
const scheduleImageRelayout = (doc: Document) => {
  const pending = [...doc.querySelectorAll('img')].filter((img) => !(img as HTMLImageElement).complete)
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
  () => [props.blocks, props.title, props.author, props.avatarUrl, props.watermark, props.styleProps],
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
