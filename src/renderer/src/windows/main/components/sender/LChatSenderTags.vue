<template>
  <div v-if="agentName || designStyleName || privacy" class="flex items-center gap-8px">
    <t-tag
      v-if="agentName"
      closable
      theme="primary"
      variant="light-outline"
      @close="emit('clear-agent')"
    >
      <template #icon> <ai-education-icon /> </template>
      {{ agentName }}
    </t-tag>
    <t-tag v-if="designStyleName" theme="warning" variant="light" :title="designStyleName">
      <template #icon>
        <palette-icon />
      </template>
      {{ designStyleName }}
    </t-tag>
    <t-tag
      v-if="privacy"
      theme="danger"
      variant="light-outline"
      :closable="!lockPrivacy"
      title="隐私聊天：不注入记忆，内容不进入记忆系统（创建后锁定）"
      @close="emit('clear-privacy')"
    >
      <template #icon>
        <lock-on-icon />
      </template>
      隐私
    </t-tag>
  </div>
</template>
<script lang="ts" setup>
import { AiEducationIcon, LockOnIcon, PaletteIcon } from 'tdesign-icons-vue-next'

withDefaults(
  defineProps<{
    /** 当前选中 Agent 名称，空则不展示标签 */
    agentName?: string
    /** 设计风格展示文案，空则不展示标签 */
    designStyleName?: string
    /** 隐私聊天标记（创建后锁定） */
    privacy?: boolean
    /** 锁定隐私标记（聊天室）：标签不可关闭，仅回显 */
    lockPrivacy?: boolean
  }>(),
  {
    agentName: '',
    designStyleName: '',
    privacy: false,
    lockPrivacy: false
  }
)

const emit = defineEmits<{
  'clear-agent': []
  'clear-privacy': []
}>()
</script>
