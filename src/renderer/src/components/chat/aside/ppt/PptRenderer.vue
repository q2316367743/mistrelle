<template>
  <div class="ppt-renderer">
    <div v-if="!currentDoc" class="ppt-renderer__empty">暂无 PPT，请先让 AI 创建</div>
    <div v-else class="ppt-renderer__body">
      <!-- 左侧：缩略图列表（仅全屏显示；非全屏窄侧边栏隐藏，避免挤占主内容） -->
      <div v-if="fullscreen" class="ppt-renderer__thumbs">
        <t-popup
          v-for="(slideNodes, index) in currentDoc.json.slide"
          :key="index"
          trigger="hover"
          placement="right"
          :overlay-style="{ padding: 0 }"
        >
          <template #content>
            <div class="ppt-renderer__thumb-pop">
              <div class="ppt-renderer__thumb-pop-scale">
                <ppt-slide-surface :slide="slideNodes" :theme="currentDoc.json.theme" />
              </div>
            </div>
          </template>
          <div
            :ref="(el) => (thumbRefs[index] = el as HTMLElement)"
            class="ppt-renderer__thumb"
            :class="{ 'ppt-renderer__thumb--active': page === index + 1 }"
            @click="goto(index + 1)"
          >
            <div class="ppt-renderer__thumb-scale">
              <ppt-slide-surface :slide="slideNodes" :theme="currentDoc.json.theme" />
            </div>
            <span class="ppt-renderer__thumb-num">{{ index + 1 }}</span>
          </div>
        </t-popup>
      </div>
      <!-- 右侧：主内容（页码拖拽条 + 当前页画布，滚轮缩放 + 拖拽平移 + 节点点选/双击引用） -->
      <ppt-slide-viewer
        v-model:page="page"
        :nodes="currentPageNodes"
        :theme="currentDoc.json.theme"
        :ppt-id="currentPptId"
        :total="total"
        :slider-max="sliderMax"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
/**
 * PPT 侧边栏主体：缩略图与主视图均直接渲染 vueRender 迷你/全尺寸 PptSlideSurface
 * （transform 等比缩放，响应式直驱、无 IPC 往返）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { getPptStore } from '@/modules/ppt'
import PptSlideSurface from '@/modules/ppt/vueRender/PptSlideSurface.vue'
import PptSlideViewer from './PptSlideViewer.vue'

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

const currentDoc = computed(() => store.value.current.value)

/** 当前定位页（与 ppt_select 工具共用同一状态：AI 跳页驱动 UI 联动） */
const page = computed({
  get: () => store.value.currentPage.value,
  set: (value) => {
    store.value.currentPage.value = value
    scrollThumb(value)
  }
})

const total = computed(() => currentDoc.value?.json.slide.length ?? 0)

/** 页码拖拽条上界（无页时仍可渲染，禁用交互） */
const sliderMax = computed(() => Math.max(1, total.value))

const thumbRefs = ref<HTMLElement[]>([])

/** 当前页 JSON 根节点数组（渲染与点选数据源） */
const currentPageNodes = computed(() => currentDoc.value?.json.slide[store.value.currentPage.value - 1])

/** 当前 PPT 文件标识（节点引用回填用） */
const currentPptId = computed(() => currentDoc.value?.id)

const goto = (value: number) => {
  page.value = value
}

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
    width: 88px;
    // 高度按宽度锁定 16:9（LESS 非括号除法不计算，原 88px * 720 / 1280 产物非法致高度回退内容高）
    aspect-ratio: 1280 / 720;
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

  &__thumb-scale {
    transform: scale((88 / 1280));
    transform-origin: top left;
    pointer-events: none;
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
    overflow: hidden;
    border-radius: var(--td-radius-small);
    box-shadow: var(--td-shadow-2);
    background: #fff;
  }

  &__thumb-pop-scale {
    width: 320px;
    aspect-ratio: 1280 / 720;
    overflow: hidden;

    > :deep(*) {
      transform: scale((320 / 1280));
      transform-origin: top left;
    }
  }
}
</style>
