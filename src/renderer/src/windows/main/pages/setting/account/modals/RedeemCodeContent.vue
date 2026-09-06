<template>
  <div class="redeem-content">
    <template v-if="!redeemed">
      <t-form layout="vertical">
        <t-form-item label="激活码">
          <t-input
            v-model="code"
            placeholder="请输入激活码"
            allow-clear
            @enter="handleVerify"
          />
        </t-form-item>
      </t-form>
      <t-alert v-if="error" theme="error" :message="error" class="redeem-content__error" />
      <div v-if="verified" class="redeem-content__card">
        <template v-if="verified.tier">
          <div class="redeem-content__card-title">
            <span class="redeem-content__card-name">{{ verified.tier.name }}</span>
            <t-tag variant="light" size="small">会员 · {{ verified.tier.months }} 个月</t-tag>
          </div>
          <div class="redeem-content__card-desc">
            升级档位立即生效；同档 / 降级档位在当前会员到期后续期生效。会员只提升每日登录赠送额度。
          </div>
        </template>
        <template v-else-if="verified.points != null">
          <div class="redeem-content__card-title">
            <span class="redeem-content__card-name">
              {{ verified.pack?.name ?? `${verified.points} 积分` }}
            </span>
            <t-tag variant="light" size="small">积分包</t-tag>
          </div>
          <div class="redeem-content__card-desc">
            {{ verified.pack ? `${verified.points} 积分 · ` : '' }}到账后计入永久积分，永不过期
          </div>
        </template>
        <template v-else>
          <div class="redeem-content__card-desc">该激活码无可识别的激活内容</div>
        </template>
      </div>
      <div class="redeem-content__actions">
        <t-button variant="outline" @click="emit('close')">取消</t-button>
        <t-button
          v-if="!verified"
          theme="primary"
          :loading="verifying"
          :disabled="!code.trim()"
          @click="handleVerify"
        >
          验证
        </t-button>
        <t-button v-else theme="primary" :loading="redeeming" @click="handleRedeem">
          确认激活
        </t-button>
      </div>
    </template>
    <template v-else>
      <div class="redeem-content__success">
        <check-circle-filled-icon class="redeem-content__success-icon" />
        <div class="redeem-content__success-title">激活成功</div>
        <template v-if="redeemed.points != null">
          <div class="redeem-content__success-row">
            <span>到账积分</span>
            <span>{{ redeemed.points }}</span>
          </div>
          <div class="redeem-content__success-row">
            <span>去向</span>
            <span>永久积分</span>
          </div>
        </template>
        <template v-else>
          <div class="redeem-content__success-row">
            <span>会员档位</span>
            <span>{{ redeemed.tierName }}</span>
          </div>
          <div class="redeem-content__success-row">
            <span>有效期至</span>
            <span>{{ formatDate(redeemed.expiresAt) }}</span>
          </div>
          <div v-if="redeemed.grantedPoints" class="redeem-content__success-row">
            <span>获赠积分</span>
            <span>{{ redeemed.grantedPoints }}</span>
          </div>
        </template>
      </div>
      <div class="redeem-content__actions">
        <t-button theme="primary" @click="emit('success')">完成</t-button>
      </div>
    </template>
  </div>
</template>
<script lang="ts" setup>
import { CheckCircleFilledIcon } from 'tdesign-icons-vue-next'
import { useAuthStore } from '@/windows/main/store'

const emit = defineEmits<{ close: []; success: [] }>()

const authStore = useAuthStore()
const code = ref('')
const verifying = ref(false)
const redeeming = ref(false)
const error = ref('')
const verified = ref<AuthCodeVerifyResult | null>(null)
const redeemed = ref<AuthCodeRedeemResult | null>(null)

// 修改激活码时清空上一次验证结果与错误
watch(code, () => {
  verified.value = null
  error.value = ''
})

async function handleVerify(): Promise<void> {
  const value = code.value.trim()
  if (!value || verifying.value) return
  verifying.value = true
  error.value = ''
  try {
    const res = await authStore.verifyCode(value)
    if (res.ok) {
      verified.value = res.data
    } else {
      error.value = res.msg
    }
  } finally {
    verifying.value = false
  }
}

async function handleRedeem(): Promise<void> {
  if (redeeming.value || !verified.value) return
  redeeming.value = true
  error.value = ''
  try {
    const res = await authStore.redeemCode(code.value.trim())
    if (res.ok) {
      redeemed.value = res.data
    } else {
      error.value = res.msg
    }
  } finally {
    redeeming.value = false
  }
}

function formatDate(ts: number | null): string {
  if (ts == null) return '-'
  return new Date(ts).toLocaleDateString('zh-CN')
}
</script>
<style scoped lang="less">
.redeem-content {
  &__error {
    margin-bottom: var(--td-comp-margin-s);
  }

  &__card {
    display: flex;
    flex-direction: column;
    gap: var(--td-comp-margin-xs);
    padding: var(--td-comp-paddingLR-l);
    background: var(--td-bg-color-container-hover);
    border-radius: var(--td-radius-medium);

    &-title {
      display: flex;
      align-items: center;
      gap: var(--td-comp-margin-s);
    }

    &-name {
      font: var(--td-font-title-medium);
      color: var(--td-text-color-primary);
    }

    &-desc {
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }
  }

  &__success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--td-comp-margin-s);
    padding: var(--td-comp-paddingTB-l) 0;

    &-icon {
      font-size: 40px;
      color: var(--td-success-color);
    }

    &-title {
      font: var(--td-font-title-medium);
      color: var(--td-text-color-primary);
    }

    &-row {
      display: flex;
      justify-content: space-between;
      width: 100%;
      max-width: 280px;
      font: var(--td-font-body-medium);
      color: var(--td-text-color-primary);

      span:first-child {
        color: var(--td-text-color-secondary);
      }
    }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--td-comp-margin-s);
    margin-top: var(--td-comp-margin-l);
  }
}
</style>
