<template>
  <l-chat-engine
    v-if="storageKey && chat"
    :key="storageKey"
    :chat-id="chat.id"
    :chat-name="chat.name"
    :privacy="chat.privacy"
    :storage-key="storageKey"
  />
  <loading-result v-else title="正在加载中" />
</template>
<script lang="ts" setup>
import { useAiChatStore } from '@/store'
import { buildChatMainKey } from '@/modules/chat'

const route = useRoute()

// 直接从 store 计算（非快照）：置顶 / 更名 / 隐私标记等行级更新替换数组元素后，标题与标识仍实时生效
const chat = computed(() =>
  useAiChatStore().state.find((e) => e.id === (route.params.id as string))
)
const storageKey = ref<string>()

watch(
  () => route.params.id,
  () => {
    if (!chat.value) {
      storageKey.value = undefined
      return
    }
    // 先清空再重设：变更 storageKey 触发 :key 重建引擎组件
    storageKey.value = ''
    nextTick(() => {
      storageKey.value = buildChatMainKey(chat.value?.id ?? '')
    })
  },
  { immediate: true }
)
</script>
<style scoped lang="less"></style>
