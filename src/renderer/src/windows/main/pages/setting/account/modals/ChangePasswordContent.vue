<template>
  <div class="change-password-content">
    <t-form :data="form" layout="vertical">
      <t-form-item label="当前密码" name="currentPassword">
        <t-input
          v-model="form.currentPassword"
          type="password"
          placeholder="请输入当前密码"
          allow-clear
        />
      </t-form-item>
      <t-form-item label="新密码" name="newPassword">
        <t-input
          v-model="form.newPassword"
          type="password"
          placeholder="至少 8 位"
          allow-clear
          @enter="handleSubmit"
        />
      </t-form-item>
      <t-form-item label="确认新密码" name="confirmPassword">
        <t-input
          v-model="form.confirmPassword"
          type="password"
          placeholder="再次输入新密码"
          allow-clear
          @enter="handleSubmit"
        />
      </t-form-item>
    </t-form>
    <div class="change-password-content__actions">
      <t-button variant="outline" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :loading="submitting" @click="handleSubmit">确认修改</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'

const emit = defineEmits<{ close: []; success: [] }>()

const authStore = useAuthStore()
const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const submitting = computed(() => authStore.submitting)

function validate(): boolean {
  if (!form.currentPassword) {
    MessageUtil.warning('请输入当前密码')
    return false
  }
  if (form.newPassword.length < 8) {
    MessageUtil.warning('新密码至少 8 位')
    return false
  }
  if (form.newPassword !== form.confirmPassword) {
    MessageUtil.warning('两次输入的新密码不一致')
    return false
  }
  return true
}

async function handleSubmit(): Promise<void> {
  if (!validate()) return
  const ok = await authStore.changePassword(form.currentPassword, form.newPassword)
  if (ok) {
    MessageUtil.success('密码已修改')
    emit('success')
  }
}
</script>
<style scoped lang="less">
.change-password-content {
  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--td-comp-margin-s);
    margin-top: var(--td-comp-margin-l);
  }
}
</style>
