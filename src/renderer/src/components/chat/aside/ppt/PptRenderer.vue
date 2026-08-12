<template>
  <div class="ppt-renderer">
    <t-alert
      v-if="store.renderState.value === 'error' && store.renderError.value"
      theme="error"
      class="ppt-renderer__alert"
      :message="store.renderError.value"
    />
    <div v-if="!store.current.value" class="ppt-renderer__empty">暂无 PPT，请先让 AI 创建</div>
    <template v-else>
      <div class="ppt-renderer__toolbar">
        <t-button variant="text" shape="square" :disabled="page <= 1" @click="page--">
          <template #icon><chevron-left-icon /></template>
        </t-button>
        <span class="ppt-renderer__page">{{ page }} / {{ total }}</span>
        <t-button
          variant="text"
          shape="square"
          :disabled="page >= total"
          @click="page++"
        >
          <template #icon><chevron-right-icon /></template>
        </t-button>
        <t-slider v-model="scale" :min="20" :max="200" class="ppt-renderer__scale" />
        <span class="ppt-renderer__scale-label">{{ scale }}%</span>
      </div>
      <div class="ppt-renderer__viewport">
        <div v-if="store.renderState.value === 'rendering'" class="ppt-renderer__loading">
          渲染中…
        </div>
        <img
          v-else-if="currentSvg"
          :src="currentSvg"
          class="ppt-renderer__img"
          :style="{ width: `${scale}%` }"
          alt="幻灯片"
        />
      </div>
      <div class="ppt-renderer__thumbs">
        <t-popup
          v-for="(svg, index) in store.svgs.value"
          :key="index"
          trigger="hover"
          placement="top"
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
    </template>
  </div>
</template>
<script lang="ts" setup>
import { getPptStore } from '@/modules/ppt'
import { ChevronLeftIcon, ChevronRightIcon } from 'tdesign-icons-vue-next'

const props = withDefaults(
  defineProps<{
    sandbox?: string
  }>(),
  {
    sandbox: ''
  }
)

const store = computed(() => getPptStore(props.sandbox ?? ''))

/** 当前定位页（与 ppt_select 工具共用同一状态：AI 跳页驱动 UI 联动） */
const page = computed({
  get: () => store.value.currentPage.value,
  set: (value) => {
    store.value.currentPage.value = value
    // 翻页后滚动缩略图导航到可视区
    nextTick(() => {
      thumbRefs.value[value - 1]?.scrollIntoView({ block: 'nearest' })
    })
  }
})

const total = computed(() => store.value.svgs.value.length)
const scale = ref(100)

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

// AI 经 ppt_select 变更 currentPage → 同步滚动缩略图导航
watch(
  () => store.value.currentPage.value,
  (value) => {
    if (value >= 1) {
      nextTick(() => thumbRefs.value[value - 1]?.scrollIntoView({ block: 'nearest' }))
    }
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

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  &__page {
    min-width: 52px;
    text-align: center;
    color: var(--td-text-color-secondary);
    font-size: var(--td-font-size-body-small);
    white-space: nowrap;
  }

  &__scale {
    flex: 1;
    min-width: 0;
    margin: 0 4px;
  }

  &__scale-label {
    width: 44px;
    color: var(--td-text-color-secondary);
    font-size: var(--td-font-size-body-small);
    white-space: nowrap;
  }

  &__viewport {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    align-items: flex-start;
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

  &__thumbs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    flex-shrink: 0;
  }

  &__thumb {
    position: relative;
    width: 64px;
    height: 40px;
    flex-shrink: 0;
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
}
</style>
