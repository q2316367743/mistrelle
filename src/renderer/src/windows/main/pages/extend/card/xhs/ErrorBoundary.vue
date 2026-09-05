<template>
  <div
    v-if="hasError"
    class="flex flex-col items-center justify-center gap-3 p-10 bg-[#FFF5F6] rounded-2xl text-sm text-[#888]"
  >
    <p>预览渲染出错了：{{ message }}</p>
    <p>内容没有丢失，可以尝试删减部分图片，或</p>
    <button
      class="px-4 py-2 bg-[#FF2442] text-white rounded-full text-xs"
      @click="reset"
    >
      重试渲染
    </button>
  </div>
  <slot v-else />
</template>

<script lang="ts" setup>
import { ref } from 'vue'

/** 参考站 ErrorBoundary 的 1:1 移植（onErrorCaptured 局部捕获预览崩溃） */
const hasError = ref(false)
const message = ref('')

onErrorCaptured((err) => {
  hasError.value = true
  message.value = err instanceof Error ? err.message : String(err)
  console.error('预览渲染崩溃', err)
  return false
})

const reset = () => {
  hasError.value = false
  message.value = ''
}
</script>
