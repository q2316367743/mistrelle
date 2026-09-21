<template>
  <t-space size="4px" class="r-chat-actionbar">
    <t-popconfirm v-if="role === 'user'" content="确认删除此消息及后续所有消息？" @confirm="emit('delete')">
      <t-tooltip content="删除此消息及后续">
        <t-button variant="text" shape="square" size="small">
          <template #icon>
            <DeleteIcon />
          </template>
        </t-button>
      </t-tooltip>
    </t-popconfirm>

    <t-tooltip v-if="role === 'assistant'" content="赞同">
      <t-button
        :theme="comment === 'good' ? 'primary' : 'default'"
        variant="text"
        shape="square"
        size="small"
        @click="emit('comment-change', comment === 'good' ? '' : 'good')"
      >
        <template #icon>
          <thumb-up-filled-icon v-if="comment === 'good'" />
          <thumb-up-icon v-else />
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
          <thumb-down-filled-icon v-if="comment === 'bad'" />
          <thumb-down-icon v-else />
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
import {
  CopyIcon,
  DeleteIcon,
  ThumbDownFilledIcon,
  ThumbDownIcon,
  ThumbUpFilledIcon,
  ThumbUpIcon
} from 'tdesign-icons-vue-next'
import type { ChatComment, ChatMessageRole } from '@/domain'
import { copyText } from '@/utils/native'
import { MessageUtil } from '@/utils/modal'

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
  delete: []
  'comment-change': [comment: ChatComment]
}>()

const handleCopy = () => {
  if (props.content) {
    copyText(props.content)
    MessageUtil.success('复制成功')
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
