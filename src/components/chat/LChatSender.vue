<template>
  <ChatSender
    v-model="inputValue"
    placeholder="请输入内容"
    :loading="loading"
    :textarea-props="{
      placeholder: placeholder
    }"
    @send="handleSend"
    @stop="handleStop"
  >
    <template #footer-prefix>
      <div class="model-select">
        <div class="flex gap-8px">
          <t-select v-model="model" :options="options" placeholder="请选择模型" />
          <div class="w-32px">
            <t-button
              :variant="thinkValue ? 'base' : 'outline'"
              shape="round"
              :theme="thinkValue ? 'primary' : 'default'"
              @click="toggleThink()"
            >
              <template #icon>
                <SystemSumIcon />
              </template>
              深度思考
            </t-button>
          </div>
        </div>
      </div>
    </template>
  </ChatSender>
</template>
<script lang="ts" setup>
import { SystemSumIcon } from 'tdesign-icons-vue-next'
import { ChatSender } from '@tdesign-vue-next/chat'
import { useSettingAiStore, useSettingDefaultStore } from '@/store'
import { useBoolState } from '@/hooks'
const props = defineProps({
  input: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: ''
  },
  think: {
    type: Boolean,
    default: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: '说点什么吧...'
  }
})
const emit = defineEmits(['update:input', 'update:model', 'update:think', 'send', 'stop'])

const inputValue = ref(props.input)
const model = ref(useSettingDefaultStore().state.defaultAssistantModel)
const [thinkValue, toggleThink] = useBoolState(props.think)

const options = computed(() => useSettingAiStore().options)

watch(inputValue, (value) => emit('update:input', value))
watch(model, (value) => emit('update:model', value))
watch(thinkValue, (value) => emit('update:think', value))
watch(
  () => props.input,
  (val) => {
    inputValue.value = val
  }
)
watch(
  () => props.model,
  (val) => {
    model.value = val
  }
)
watch(
  () => props.think,
  (val) => {
    thinkValue.value = val
  }
)

const handleSend = () => {
  emit('send')
}
const handleStop = () => {
  emit('stop')
}
</script>
<style scoped lang="less"></style>
