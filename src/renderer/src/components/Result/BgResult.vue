<template>
  <div class="absolute top-0 left-0 w-full h-full bg-result" :style="bgStyle">
    <template v-if="isVideo">
      <video
        class="page-new__bg page-new__bg--video"
        :src="mediaSrc"
        muted
        loop
        autoplay
        playsinline
      />
    </template>
  </div>
</template>
<script lang="ts" setup>
import { useSettingGlobalStore } from '@/store'
import { isDark } from '@/global/BeanFactory'

const props = defineProps({
  light: {
    type: String as PropType<'bgNewLight' | 'bgChatLight'>,
    required: true
  },

  dark: {
    type: String as PropType<'bgNewDark' | 'bgChatDark'>,
    required: true
  }
})

const { state } = toRefs(useSettingGlobalStore())
const activeBg = computed(() => (isDark.value ? state.value[props.dark] : state.value[props.light]))
const isVideo = computed(() => activeBg.value.type === 'video')
const mediaSrc = computed(() => {
  const { type, value } = activeBg.value
  if ((type === 'image' || type === 'video') && value) {
    return window.preload.net.pathToHref(value)
  }
  return ''
})

const bgStyle = computed(() => {
  const { type, value, opacity } = activeBg.value
  const opacityStyle = (type === 'image' || type === 'video')
    ? { opacity: String(opacity ?? 1) }
    : {}
  switch (type) {
    case 'solid':
      return { ...opacityStyle, backgroundColor: value }
    case 'gradient':
      return { ...opacityStyle, background: value }
    case 'image':
      return value
        ? {
            ...opacityStyle,
            backgroundImage: `url(${window.preload.net.pathToHref(value)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }
        : opacityStyle
    case 'video':
    default:
      return opacityStyle
  }
})
</script>
<style scoped lang="less">
.bg-result {
  pointer-events: none;
}
.page-new__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.page-new__bg--video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
