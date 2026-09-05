<template>
  <div class="login-content">
    <t-tabs v-model="tab">
      <t-tab-panel value="login" label="登录">
        <t-form :data="form" layout="vertical" class="login-content__form">
          <t-form-item label="邮箱" name="email" label-align="top">
            <t-input v-model="form.email" placeholder="请输入邮箱" allow-clear />
          </t-form-item>
          <t-form-item label="密码" name="password" label-align="top">
            <t-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              allow-clear
              @enter="handleSubmit"
            />
          </t-form-item>
        </t-form>
      </t-tab-panel>
      <t-tab-panel value="signup" label="注册">
        <t-form :data="form" layout="vertical" class="login-content__form" label-align="top">
          <t-form-item label="昵称" name="name">
            <t-input v-model="form.name" placeholder="请输入昵称" allow-clear />
          </t-form-item>
          <t-form-item label="邮箱" name="email" label-align="top">
            <t-input v-model="form.email" placeholder="请输入邮箱" allow-clear />
          </t-form-item>
          <t-form-item label="密码" name="password" label-align="top">
            <t-input
              v-model="form.password"
              type="password"
              placeholder="至少 8 位"
              allow-clear
              @enter="handleSubmit"
            />
          </t-form-item>
        </t-form>
      </t-tab-panel>
    </t-tabs>
    <div class="login-content__actions">
      <t-button variant="outline" @click="handleCancel">取消</t-button>
      <t-button theme="primary" :loading="submitting" @click="handleSubmit">
        {{ tab === 'login' ? '登录' : '注册并登录' }}
      </t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useAuthStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'
import { openVerifyEmail } from './VerifyEmailDialog'

const emit = defineEmits<{ close: []; success: [] }>()

const authStore = useAuthStore()
const tab = ref<'login' | 'signup'>('login')
const form = reactive({ name: '', email: '', password: '' })
const submitting = computed(() => authStore.submitting)

function validate(): boolean {
  if (tab.value === 'signup' && !form.name.trim()) {
    MessageUtil.warning('请输入昵称')
    return false
  }
  if (!form.email.trim()) {
    MessageUtil.warning('请输入邮箱')
    return false
  }
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    MessageUtil.warning('邮箱格式不正确')
    return false
  }
  if (!form.password) {
    MessageUtil.warning('请输入密码')
    return false
  }
  if (tab.value === 'signup' && form.password.length < 8) {
    MessageUtil.warning('密码至少 8 位')
    return false
  }
  return true
}

async function handleSubmit(): Promise<void> {
  if (!validate()) return
  const email = form.email.trim()
  const res =
    tab.value === 'login'
      ? await authStore.signIn(email, form.password)
      : await authStore.signUp(form.name.trim(), email, form.password)
  if (res.ok) {
    emit('success')
    return
  }
  if (res.needEmailVerify) {
    // 邮箱未验证：关闭登录框并打开验证引导弹框（前往邮箱 / 重发验证邮件 / 完成验证后重登）
    emit('close')
    openVerifyEmail(email, form.password)
    return
  }
  MessageUtil.error(res.msg)
}

function handleCancel(): void {
  emit('close')
}
</script>
<style scoped lang="less">
.login-content {
  &__form {
    margin-top: var(--td-comp-margin-m);
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--td-comp-margin-s);
    margin-top: var(--td-comp-margin-l);
  }
}
</style>
