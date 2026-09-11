<template>
  <div class="ref-picker">
    <div v-for="(item, index) in files" :key="`${item.name}-${index}`" class="ref-thumb">
      <t-image :src="thumbOf(item)" fit="cover" class="ref-img" />
      <t-button
        shape="circle"
        size="small"
        theme="danger"
        class="ref-remove z-1"
        @click="removeAt(index)"
      >
        <template #icon><CloseIcon /></template>
      </t-button>
    </div>
    <t-upload
      v-model="files"
      theme="custom"
      multiple
      accept="image/*"
      :max="MAX_REFERENCES"
      :auto-upload="false"
      :allow-upload-duplicate-file="true"
    >
      <template #trigger="{ triggerUpload }">
        <t-button
          variant="outline"
          size="small"
          :disabled="files.length >= MAX_REFERENCES"
          @click="triggerUpload?.()"
        >
          <template #icon><AddIcon /></template>
          参考图
        </t-button>
      </template>
    </t-upload>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import type { UploadFile } from 'tdesign-vue-next'
import { AddIcon, CloseIcon } from 'tdesign-icons-vue-next'
import { pathToHref } from '../image-page-utils'

/** 参考图上限（与服务端上游约定一致：≤15 张） */
const MAX_REFERENCES = 15

/** 选中文件列表（本地不真正上传，仅取路径） */
const files = ref<UploadFile[]>([])
/** 对外只暴露本地绝对路径（main 归一化为 data URI 透传） */
const paths = defineModel<string[]>({ default: () => [] })

watch(
  files,
  (list) => {
    paths.value = list
      .map((file) => (file.raw ? window.preload.webUtils.getPathForFile(file.raw) : ''))
      .filter(Boolean)
  },
  { deep: true }
)

// 外部清空（如提交后）时同步清掉缩略图，避免 UI 残留
watch(paths, (value) => {
  if (value.length || !files.value.length) return
  files.value = []
})

const thumbOf = (file: UploadFile): string => {
  const path = file.raw ? window.preload.webUtils.getPathForFile(file.raw) : ''
  return path ? pathToHref(path) : ''
}

const removeAt = (index: number): void => {
  files.value.splice(index, 1)
}
</script>

<style scoped lang="less">
.ref-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ref-thumb {
  position: relative;
  width: 48px;
  height: 48px;
}

.ref-img {
  width: 100%;
  height: 100%;
  border-radius: 6px;
}

.ref-remove {
  position: absolute;
  top: -6px;
  right: -6px;
}
</style>
