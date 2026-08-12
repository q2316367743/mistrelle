<template>
  <div class="video-export-content">
    <t-form label-align="top" layout="vertical" :colon="false">
      <t-form-item label="格式">
        <t-radio-group v-model="format" variant="default-filled" class="video-export-content__full">
          <t-radio-button value="mp4">MP4</t-radio-button>
          <t-radio-button value="gif">GIF</t-radio-button>
          <t-radio-button value="webm">WebM</t-radio-button>
        </t-radio-group>
      </t-form-item>
      <t-form-item label="帧率">
        <t-select v-model="fps" :options="fpsOptions" class="video-export-content__full" />
      </t-form-item>
      <t-form-item
        label="时长（秒）"
        :help="`建议不小于动画最长时长（当前 ${defaultDuration} 秒）`"
      >
        <t-input-number
          v-model="duration"
          :min="0.5"
          :max="30"
          :step="0.5"
          :decimal-places="1"
          class="video-export-content__full"
        />
      </t-form-item>
      <t-form-item label="分辨率">
        <t-select v-model="scale" :options="scaleOptions" class="video-export-content__full" />
      </t-form-item>
      <t-form-item v-if="format !== 'mp4'" label="循环播放">
        <t-switch v-model="loop" size="small" />
      </t-form-item>
    </t-form>
    <div class="video-export-content__actions">
      <t-button theme="primary" @click="handleSubmit">开始导出</t-button>
      <t-button variant="outline" @click="emit('close')">取消</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { getCanvasStore, maxAnimationTime, startVideoExport } from '@/modules/canvas'

const props = defineProps<{
  sandbox: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = computed(() => getCanvasStore(props.sandbox ?? ''))

const format = ref<'mp4' | 'gif' | 'webm'>('mp4')
const fps = ref(30)
const duration = ref(2)
const scale = ref(1)
const loop = ref(true)

const fpsOptions = [24, 30, 60].map((v) => ({ label: `${v} 帧/秒`, value: v }))
const scaleOptions = [
  { label: '原始（100%）', value: 1 },
  { label: '高清（75%）', value: 0.75 },
  { label: '标清（50%）', value: 0.5 }
]

/** 动画最长时长（0.5 取整），作为时长默认值与提示依据 */
const defaultDuration = computed(() => {
  const doc = store.value.current.value
  return doc ? Math.max(0.5, Math.round(maxAnimationTime(doc) * 2) / 2) : 2
})

onMounted(() => {
  duration.value = defaultDuration.value
})

const handleSubmit = () => {
  const doc = store.value.current.value
  if (!doc) return
  // 关闭弹窗后立即由全屏遮罩接管进度；导出异常由遮罩展示错误文案
  emit('close')
  void startVideoExport(doc, {
    fps: fps.value,
    duration: Math.max(0.5, Number(duration.value) || defaultDuration.value),
    format: format.value,
    scale: scale.value,
    loop: loop.value,
    sandboxDir: props.sandbox ?? ''
  })
}
</script>
<style scoped lang="less">
.video-export-content {
  &__full {
    width: 100%;
  }

  &__actions {
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
