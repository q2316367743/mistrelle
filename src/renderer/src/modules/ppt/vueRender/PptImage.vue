<template>
  <div class="ppt-image" :data-node-id="node.id" :style="boxStyle">
    <img v-if="src" class="ppt-image__img" :src="src" :style="imgStyle" alt="" />
  </div>
</template>
<script lang="ts" setup>
/**
 * Image 图片节点：src 为 base64 data URI 或沙盒本地路径（resolveSrc 异步转 data URL）。
 * sizing.type → object-fit：contain 完整容纳 / cover 铺满 / crop 近似为 cover
 * （crop 的 x/y/w/h 像素裁剪以 object-position 粗略支持）。
 */
import { computed, onMounted, ref, type CSSProperties } from 'vue'
import type { PptTheme, SlideNode } from '../pptTypes'
import { attrNum, commonStyle } from './attrStyle'
import { resolveSrc } from './resolveSrc'

const props = defineProps<{ node: SlideNode; theme: PptTheme }>()

const src = ref('')

onMounted(() => {
  void resolveSrc(props.node.attr.src).then((url) => {
    src.value = url
  })
})

const boxStyle = computed<CSSProperties>(() => commonStyle(props.node, props.theme))

const imgStyle = computed<CSSProperties>(() => {
  const sizing = props.node.attr['sizing.type']
  const cropX = attrNum(props.node.attr, 'sizing.x', 50)
  const cropY = attrNum(props.node.attr, 'sizing.y', 50)
  return {
    objectFit: sizing === 'contain' ? 'contain' : 'cover',
    objectPosition: sizing === 'crop' ? `${cropX}% ${cropY}%` : 'center'
  }
})
</script>
<style scoped lang="less">
.ppt-image {
  overflow: hidden;

  &__img {
    display: block;
    width: 100%;
    height: 100%;
  }
}
</style>
