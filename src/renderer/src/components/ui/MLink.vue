<template>
  <t-link theme="primary" :href @click="handleClick()"><slot /></t-link>
</template>
<script lang="ts" setup>
import { openUrlByBrowser } from '@/utils/native'

const props = defineProps({
  href: String
})
const handleClick = () => {
  openUrlByBrowser(props.href)
}
</script>
<style scoped lang="less"></style>
