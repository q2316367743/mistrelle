<template>
  <t-space size="4px" class="r-chat-actionbar">
    <t-tooltip v-if="role === 'user'" content="重新回答">
      <t-button variant="text" shape="square" size="small" @click="emit('reask')">
        <template #icon>
          <RefreshIcon />
        </template>
      </t-button>
    </t-tooltip>

    <t-tooltip v-if="role === 'user'" content="回滚到此消息前">
      <t-button variant="text" shape="square" size="small" @click="emit('rollback')">
        <template #icon>
          <RollbackIcon />
        </template>
      </t-button>
    </t-tooltip>

    <t-tooltip v-if="role === 'assistant'" content="赞同">
      <t-button
        :theme="comment === 'good' ? 'primary' : 'default'"
        variant="text"
        shape="square"
        size="small"
        @click="emit('comment-change', comment === 'good' ? '' : 'good')"
      >
        <template #icon>
          <ThumbUpIcon />
        </template>
      </t-button>
    </t-tooltip>

    <t-tooltip v-if="role === 'assistant'" content="不赞同">
      <t-button
        :theme="comment === 'bad' ? 'primary' : 'default'"
        variant="text"
        shape="square"
        size="small"
        @click="emit('comment-change', comment === 'bad' ? '' : 'bad')"
      >
        <template #icon>
          <ThumbDownIcon />
        </template>
      </t-button>
    </t-tooltip>

    <t-tooltip content="复制">
      <t-button variant="text" shape="square" size="small" @click="handleCopy">
        <template #icon>
          <CopyIcon />
        </template>
      </t-button>
    </t-tooltip>
  </t-space>
</template>

<script lang="ts" setup>
import { CopyIcon, RefreshIcon, RollbackIcon, ThumbDownIcon, ThumbUpIcon } from 'tdesign-icons-vue-next'
import type { ChatComment, ChatMessageRole } from '@/domain'
import { copyText } from '@/utils/native'

const props = withDefaults(
  defineProps<{
    content?: string
    role?: Extract<ChatMessageRole, 'user' | 'assistant'>
    comment?: ChatComment
  }>(),
  {
    role: 'user',
    comment: ''
  }
)

const emit = defineEmits<{
  reask: []
  rollback: []
  'comment-change': [comment: ChatComment]
}>()

const handleCopy = () => {
  if (props.content) {
    copyText(props.content)
  }
}
</script>

<style scoped lang="less">
.r-chat-actionbar {
  opacity: 0.76;
  transition: opacity 160ms ease;

  &:hover {
    opacity: 1;
  }
}
</style>
