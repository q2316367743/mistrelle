<template>
  <div class="link-dialog">
    <t-input
      v-model="href"
      placeholder="粘贴或输入链接地址，留空则移除链接"
      clearable
      autofocus
      @enter="submit"
    />
    <div class="link-dialog__tip">支持 http(s):// 开头的网址；留空并确定可移除当前链接。</div>
    <div class="link-dialog__actions">
      <t-button variant="outline" @click="emit('close')">取消</t-button>
      <t-button theme="primary" @click="submit">确定</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
const props = defineProps<{
  /** 现有链接地址（空串 = 新增） */
  currentHref: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', href: string): void
}>()

const href = ref(props.currentHref)

/** 归一化：裸域名补 https://，其余原样（留空表示移除链接） */
const normalizeHref = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) return trimmed
  return `https://${trimmed}`
}

const submit = (): void => emit('confirm', normalizeHref(href.value))
</script>
<style scoped lang="less">
.link-dialog {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 4px 0;

  &__tip {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding-top: 20px;
  }
}
</style>
