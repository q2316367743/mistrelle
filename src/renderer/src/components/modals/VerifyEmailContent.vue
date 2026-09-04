<template>
  <div class="verify-email">
    <div class="verify-email__body">
      <div class="verify-email__intro">
        验证邮件已发送至
        <span class="verify-email__address">{{ email }}</span>
      </div>
      <div class="verify-email__desc">
        请前往邮箱查收并点击邮件中的认证链接，完成验证后重新登录即可使用全部功能。
      </div>

      <div v-if="provider" class="verify-email__actions">
        <t-button theme="primary" variant="outline" block @click="openInbox">
          <template #icon><t-icon name="mail" /></template>
          前往 {{ provider.name }}
        </t-button>
      </div>

      <div class="verify-email__resend">
        <span class="verify-email__resend-tip">没收到邮件？</span>
        <t-button
          variant="text"
          size="small"
          :disabled="sending || countdown > 0"
          :loading="sending"
          @click="handleResend"
        >
          <template #icon><t-icon name="refresh" /></template>
          {{ countdown > 0 ? `${countdown}s 后可重发` : '重新发送验证邮件' }}
        </t-button>
      </div>
    </div>
    <div class="verify-email__footer">
      <t-button theme="primary" @click="emit('close')">我知道了</t-button>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'
import { mailProviderOf } from '@/utils/mailProvider'

const props = defineProps<{ email: string }>()
const emit = defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const provider = computed(() => mailProviderOf(props.email))

const sending = ref(false)
/** 重发冷却倒计时（与服务端同邮箱 60s 冷却一致，仅前端展示用） */
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function startCountdown(seconds = 60): void {
  stopCountdown()
  countdown.value = seconds
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) stopCountdown()
  }, 1000)
}

function stopCountdown(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (countdown.value < 0) countdown.value = 0
}

onBeforeUnmount(stopCountdown)

function openInbox(): void {
  if (provider.value) window.preload.inject.shell.openExternal(provider.value.url)
}

async function handleResend(): Promise<void> {
  if (sending.value || countdown.value > 0) return
  sending.value = true
  try {
    const res = await authStore.resendVerificationEmail(props.email)
    if (res.ok) {
      MessageUtil.success('验证邮件已重新发送，请查收')
      startCountdown()
    } else {
      MessageUtil.error(res.msg)
    }
  } finally {
    sending.value = false
  }
}
</script>
<style scoped lang="less">
.verify-email {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-l);

  &__body {
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-s);
  }

  &__intro {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  &__address {
    color: var(--td-text-color-primary);
    font-weight: var(--td-font-weight-bold);
    word-break: break-all;
  }

  &__desc {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    line-height: 1.6;
  }

  &__actions {
    margin-top: var(--td-comp-margin-s);
  }

  &__resend {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-xs);
    margin-top: var(--td-comp-margin-xs);

    &-tip {
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
