<template>
  <div class="gallery">
    <div class="gallery-main" @click="emit('preview')">
      <t-image
        v-if="currentHref"
        :src="currentHref"
        fit="contain"
        class="gallery-image"
      />
      <div v-else class="gallery-fallback">
        <t-loading v-if="status === 'pending'" size="small" />
        <ErrorCircleFilledIcon v-else class="fallback-icon" />
        <span>{{ status === 'pending' ? '生成中…' : '生成失败，无图片' }}</span>
      </div>
    </div>
    <!-- 多图缩略条：点击切换主图，与全屏预览器共享下标 -->
    <div v-if="hrefs.length > 1" class="gallery-thumbs">
      <div
        v-for="(href, index) in hrefs"
        :key="href"
        class="thumb"
        :class="{ active: index === modelValue }"
        @click="emit('update:modelValue', index)"
      >
        <t-image :src="href" fit="cover" class="thumb-img" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ErrorCircleFilledIcon } from 'tdesign-icons-vue-next'
import { pathToHref } from '../image-page-utils'

const props = defineProps<{
  images: ImageItem[]
  status: ImageGenerateStatus
}>()

const emit = defineEmits<{
  'update:modelValue': [index: number]
  preview: []
}>()

/** 当前主图下标（父级持有：全屏预览器经 v-model:index 同步） */
const modelValue = defineModel<number>({ required: true })

const hrefs = computed(() => props.images.map((item) => pathToHref(item.path)))
const currentHref = computed(() => hrefs.value[modelValue.value] ?? hrefs.value[0] ?? '')
</script>

<style scoped lang="less">
.gallery {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gallery-main {
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--td-bg-color-component);
  cursor: zoom-in;

  .gallery-image {
    width: 100%;
    height: 100%;
  }
}

.gallery-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--td-text-color-placeholder);
}

.fallback-icon {
  font-size: 32px;
  color: var(--td-error-color);
}

.gallery-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.thumb {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  opacity: 0.7;
  transition:
    opacity 0.2s ease,
    border-color 0.2s ease;

  &.active {
    border-color: var(--td-brand-color);
    opacity: 1;
  }

  .thumb-img {
    width: 100%;
    height: 100%;
  }
}
</style>
