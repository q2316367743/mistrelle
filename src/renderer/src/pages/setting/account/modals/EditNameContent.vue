<template>
  <div class="edit-name-content">
    <t-form :data="form" layout="vertical">
      <t-form-item label="用户名" name="name">
        <t-input v-model="form.name" placeholder="请输入新用户名" allow-clear @enter="handleSubmit" />
      </t-form-item>
    </t-form>
    <div class="edit-name-content__actions">
      <t-button variant="outline" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :loading="submitting" @click="handleSubmit">保存</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/store'
import { MessageUtil } from '@/utils/modal'

const props = defineProps<{ currentName: string }>()
const emit = defineEmits<{ close: []; success: [] }>()

const authStore = useAuthStore()
const form = reactive({ name: props.currentName })
const submitting = computed(() => authStore.submitting)

async function handleSubmit(): Promise<void> {
  const name = form.name.trim()
  if (!name) {
    MessageUtil.warning('请输入用户名')
    return
  }
  if (name.length > 50) {
    MessageUtil.warning('用户名过长（最多 50 字）')
    return
  }
  const ok = await authStore.updateName(name)
  if (ok) {
    MessageUtil.success('用户名已更新')
    emit('success')
  }
}
</script>
<style scoped lang="less">
.edit-name-content {
  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--td-comp-margin-s);
    margin-top: var(--td-comp-margin-l);
  }
}
</style>