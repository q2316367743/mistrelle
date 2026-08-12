<template>
  <transition name="video-overlay">
    <div v-if="show" class="video-overlay" @wheel.prevent @touchmove.prevent>
      <div class="video-overlay__card">
        <div class="video-overlay__title">{{ title }}</div>
        <div class="video-overlay__caption">{{ caption }}</div>
        <t-progress
          theme="line"
          :percentage="progress"
          :stroke-width="2"
          :label="false"
          class="video-overlay__progress"
        />
        <div class="video-overlay__actions">
          <t-button
            size="small"
            theme="danger"
            variant="outline"
            :disabled="!canCancel"
            @click="cancel"
          >
            取消导出
          </t-button>
        </div>
      </div>
    </div>
  </transition>
</template>
<script lang="ts" setup>
import { getVideoExportController } from '@/modules/canvas'

const controller = getVideoExportController()
const state = controller.state

const show = computed(() => state.status !== 'idle')
const progress = computed(() => state.progress)
const canCancel = computed(() => state.status === 'rendering' || state.status === 'encoding')

const title = computed(() => {
  switch (state.status) {
    case 'rendering':
    case 'encoding':
      return '正在导出视频'
    case 'done':
      return '导出完成'
    case 'cancelled':
      return '已取消导出'
    case 'error':
      return '导出失败'
    default:
      return ''
  }
})

const caption = computed(() => {
  switch (state.status) {
    case 'rendering':
      return `渲染帧中 · ${state.frame}/${state.totalFrames} 帧`
    case 'encoding':
      return '合并视频中'
    case 'done':
      return state.outputPath ? `已保存：${state.outputPath}` : ''
    case 'cancelled':
      return '导出已取消'
    case 'error':
      return state.error ?? '未知错误'
    default:
      return ''
  }
})

const cancel = () => controller.cancel()
</script>
<style scoped lang="less">
.video-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--td-mask-active);
  backdrop-filter: blur(8px);
  pointer-events: all;

  &__card {
    width: 420px;
    padding: 24px 28px;
    border-radius: var(--td-radius-large);
    background: var(--td-bg-color-container);
    box-shadow: var(--td-shadow-3);
    backdrop-filter: blur(60px) saturate(125%);
  }

  &__title {
    font-size: 28px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__caption {
    margin-top: 8px;
    font-size: 14px;
    color: var(--td-text-color-secondary);
    word-break: break-all;
  }

  &__progress {
    margin-top: 20px;
  }

  &__actions {
    margin-top: 24px;
    display: flex;
    justify-content: center;
  }
}

// 进入 Decelerate：遮罩淡入 + 卡片 scale 0.98→1；退出 Accelerate：整体淡出
.video-overlay-enter-active,
.video-overlay-leave-active {
  transition: opacity 167ms cubic-bezier(0, 0, 0, 1);
}
.video-overlay-enter-active .video-overlay__card {
  transition: transform 167ms cubic-bezier(0, 0, 0, 1);
}
.video-overlay-leave-active {
  transition-duration: 167ms;
  transition-timing-function: cubic-bezier(1, 0, 1, 1);
}
.video-overlay-enter-from,
.video-overlay-leave-to {
  opacity: 0;
}
.video-overlay-enter-from .video-overlay__card {
  transform: scale(0.98);
}
</style>
