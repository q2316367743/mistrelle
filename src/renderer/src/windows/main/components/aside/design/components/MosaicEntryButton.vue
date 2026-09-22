<template>
  <!-- tooltip 挂 span：disabled 的原生 button 不派发鼠标事件，直接包 t-button 会悬停无提示 -->
  <t-tooltip :content="reason || '图片遮盖（马赛克 / 毛玻璃）'" placement="bottom">
    <span class="mosaic-entry">
      <t-button
        theme="primary"
        variant="text"
        shape="square"
        :disabled="!!reason"
        @click="emit('open')"
      >
        <template #icon>
          <mosaic-icon />
        </template>
      </t-button>
    </span>
  </t-tooltip>
</template>
<script lang="ts" setup>
import { MosaicIcon } from 'tdesign-icons-vue-next'

defineProps<{
  /** 不可用原因（空串 = 可用）；按钮置灰并以此作 tooltip 文案 */
  reason?: string
}>()

const emit = defineEmits<{
  (e: 'open'): void
}>()
</script>
<style scoped lang="less">
.mosaic-entry {
  display: inline-flex;
}
</style>
