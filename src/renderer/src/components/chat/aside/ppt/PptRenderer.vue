<template>
  <div class="ppt-renderer">
    <t-alert
      v-if="store.renderState.value === 'error' && store.renderError.value"
      theme="error"
      class="ppt-renderer__alert"
      :message="store.renderError.value"
    />
    <div v-if="!store.current.value" class="ppt-renderer__empty">暂无 PPT，请先让 AI 创建</div>
    <div v-else class="ppt-renderer__body">
      <!-- 左侧：缩略图列表（仅全屏显示；非全屏窄侧边栏隐藏，避免挤占主内容） -->
      <div v-if="fullscreen" class="ppt-renderer__thumbs">
        <t-popup
          v-for="(svg, index) in store.svgs.value"
          :key="index"
          trigger="hover"
          placement="right"
          :overlay-style="{ padding: 0 }"
        >
          <template #content>
            <img :src="toDataUrl(svg)" class="ppt-renderer__thumb-pop" alt="预览" />
          </template>
          <div
            :ref="(el) => (thumbRefs[index] = el as HTMLElement)"
            class="ppt-renderer__thumb"
            :class="{ 'ppt-renderer__thumb--active': page === index + 1 }"
            @click="goto(index + 1)"
          >
            <img :src="toDataUrl(svg)" class="ppt-renderer__thumb-img" alt="缩略图" />
            <span class="ppt-renderer__thumb-num">{{ index + 1 }}</span>
          </div>
        </t-popup>
      </div>
      <!-- 右侧：主内容（页码拖拽条 + 当前页大图） -->
      <div class="ppt-renderer__main">
        <div class="ppt-renderer__toolbar">
          <span class="ppt-renderer__page">{{ page }} / {{ total }}</span>
          <t-slider
            v-model="page"
            :min="1"
            :max="sliderMax"
            :step="1"
            class="ppt-renderer__slider"
            :disabled="total < 1"
          />
        </div>
        <div class="ppt-renderer__viewport">
          <div v-if="store.renderState.value === 'rendering'" class="ppt-renderer__loading">
            渲染中…
          </div>
          <img
            v-else-if="currentSvg"
            :src="currentSvg"
            class="ppt-renderer__img"
            alt="幻灯片"
          />
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { getPptStore } from '@/modules/ppt'

const props = withDefaults(
  defineProps<{
    sandbox?: string
    /** 全屏：显示左侧缩略图栏（WPS 左右结构）；非全屏窄侧边栏隐藏 */
    fullscreen?: boolean
  }>(),
  {
    sandbox: '',
    fullscreen: false
  }
)

const store = computed(() => getPptStore(props.sandbox ?? ''))

/** 当前定位页（与 ppt_select 工具共用同一状态：AI 跳页驱动 UI 联动） */
const page = computed({
  get: () => store.value.currentPage.value,
  set: (value) => {
    store.value.currentPage.value = value
    scrollThumb(value)
  }
})

const total = computed(() => store.value.svgs.value.length)

/** 页码拖拽条上界（无页时仍可渲染，禁用交互） */
const sliderMax = computed(() => Math.max(1, total.value))

const thumbRefs = ref<HTMLElement[]>([])

/** 当前页 SVG（data URI，经 <img> 渲染，杜绝 v-html 脚本注入） */
const currentSvg = computed(() => {
  const svgs = store.value.svgs.value
  const index = store.value.currentPage.value - 1
  return svgs[index] ? toDataUrl(svgs[index]) : undefined
})

const goto = (value: number) => {
  page.value = value
}

const toDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** 左侧缩略图导航滚动定位到当前页 */
const scrollThumb = (value: number) => {
  nextTick(() => {
    thumbRefs.value[value - 1]?.scrollIntoView({ block: 'nearest' })
  })
}

// AI 经 ppt_select 变更 currentPage → 同步滚动缩略图导航
watch(
  () => store.value.currentPage.value,
  (value) => {
    if (value >= 1) scrollThumb(value)
  }
)
</script>
<style scoped lang="less">
.ppt-renderer {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;

  &__alert {
    flex-shrink: 0;
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }

  &__body {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 8px;
  }

  &__thumbs {
    width: 96px;
    flex-shrink: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-right: 2px;
  }

  &__thumb {
    position: relative;
    flex-shrink: 0;
    aspect-ratio: 16 / 9;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-small);
    overflow: hidden;
    cursor: pointer;
    background: #fff;

    &--active {
      border-color: var(--td-brand-color);
      box-shadow: 0 0 0 1px var(--td-brand-color);
    }
  }

  &__thumb-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &__thumb-num {
    position: absolute;
    right: 2px;
    bottom: 0;
    padding: 0 3px;
    font-size: 10px;
    line-height: 14px;
    color: #fff;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 2px;
  }

  &__thumb-pop {
    display: block;
    width: 320px;
    border-radius: var(--td-radius-small);
    box-shadow: var(--td-shadow-2);
  }

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-right: 8px;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  &__page {
    min-width: 52px;
    text-align: center;
    color: var(--td-text-color-secondary);
    font-size: var(--td-font-size-body-small);
    white-space: nowrap;
  }

  &__slider {
    flex: 1;
    min-width: 0;
  }

  &__viewport {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--td-bg-color-component);
    border-radius: var(--td-radius-medium);
    position: relative;
  }

  &__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }

  &__img {
    display: block;
    max-width: 100%;
    box-shadow: var(--td-shadow-2);
    border-radius: var(--td-radius-small);
    background: #fff;
  }
}
</style>
