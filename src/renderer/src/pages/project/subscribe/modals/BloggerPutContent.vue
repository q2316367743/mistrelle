<template>
  <div class="blogger-put">
    <t-input
      v-model="url"
      class="mt-8px"
      placeholder="粘贴博主主页链接"
      clearable
      autofocus
      @enter="handleResolve"
    >
      <template #prefix-icon><LinkIcon /></template>
    </t-input>

    <div v-if="resolved" class="blogger-put__preview">
      <img v-if="resolved.avatar" :src="resolved.avatar" class="blogger-put__avatar" referrerpolicy="no-referrer" />
      <div v-else class="blogger-put__avatar blogger-put__avatar--empty">{{ resolved.name?.[0] }}</div>
      <div class="blogger-put__info">
        <span class="blogger-put__name">{{ resolved.name }}</span>
        <div class="blogger-put__meta">
          <t-tag v-if="resolved.platform" size="small" variant="light">
            {{ subscribePlatformLabel(resolved.platform) }}
          </t-tag>
          <span class="blogger-put__count">{{ resolved.videoCount ?? 0 }} 条笔记</span>
        </div>
      </div>
    </div>

    <div class="blogger-put__actions">
      <t-button variant="outline" :loading="resolving" @click="handleResolve">解析</t-button>
      <t-button theme="primary" :loading="loading" @click="handleSubmit">添加</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { LinkIcon } from 'tdesign-icons-vue-next'
import type { SubscribeBloggerResource } from '@/modules/subscribe'
import { resolveSubscribeBlogger, subscribeBloggerAdd } from '@/modules/subscribe'
import { subscribePlatformLabel } from '@/modules/subscribe'
import { MessageUtil } from '@/utils/modal'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', bloggerId: string): void
}>()

const url = ref('')
const resolved = ref<SubscribeBloggerResource | undefined>(undefined)
const resolving = ref(false)
const loading = ref(false)

const handleResolve = async () => {
  const link = url.value.trim()
  if (!link) {
    MessageUtil.warning('请输入博主主页链接')
    return
  }
  resolving.value = true
  try {
    resolved.value = await resolveSubscribeBlogger(link)
  } catch (e) {
    resolved.value = undefined
    MessageUtil.error('解析博主信息失败', e)
  } finally {
    resolving.value = false
  }
}

const handleSubmit = async () => {
  const link = url.value.trim()
  if (!link) {
    MessageUtil.warning('请输入博主主页链接')
    return
  }
  loading.value = true
  try {
    const blogger = await subscribeBloggerAdd(props.projectId, link)
    MessageUtil.success('已添加')
    emit('success', blogger.id)
  } catch (e) {
    MessageUtil.error('添加博主失败', e)
  } finally {
    loading.value = false
  }
}
</script>
<style scoped lang="less">
.blogger-put {
  display: flex;
  flex-direction: column;

  &__preview {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
    padding: 12px;
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-secondarycontainer);
  }

  &__avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;

    &--empty {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: var(--td-text-color-primary);
      background-color: var(--td-brand-color-light);
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  &__name {
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__count {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__actions {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
