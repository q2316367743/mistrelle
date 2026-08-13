<template>
  <div class="token-fields">
    <div class="token-fields__group">
      <div class="token-fields__group-title">间距 Spacing</div>
      <t-form class="token-fields__form">
        <div class="token-fields__grid">
          <t-form-item label="页面边距 (px)">
            <t-input-number v-model="tokens.spacing.pageMargin" :min="0" :max="200" />
          </t-form-item>
          <t-form-item label="区块间距 (px)">
            <t-input-number v-model="tokens.spacing.sectionGap" :min="0" :max="200" />
          </t-form-item>
          <t-form-item label="卡片内边距 (px)">
            <t-input-number v-model="tokens.spacing.cardPadding" :min="0" :max="200" />
          </t-form-item>
          <t-form-item label="间距基准 (px)" help="间距体系按此单位缩放">
            <t-input-number v-model="tokens.spacing.baseUnit" :min="1" :max="32" />
          </t-form-item>
        </div>
      </t-form>
    </div>

    <div class="token-fields__group">
      <div class="token-fields__group-title">圆角 Radius</div>
      <t-form class="token-fields__form">
        <div class="token-fields__grid">
          <t-form-item label="小圆角 (px)" help="按钮 / 输入框">
            <t-input-number v-model="tokens.radius.small" :min="0" :max="100" />
          </t-form-item>
          <t-form-item label="中圆角 (px)" help="卡片">
            <t-input-number v-model="tokens.radius.medium" :min="0" :max="100" />
          </t-form-item>
          <t-form-item label="大圆角 (px)" help="弹窗 / 横幅">
            <t-input-number v-model="tokens.radius.large" :min="0" :max="100" />
          </t-form-item>
          <t-form-item label="胶囊按钮">
            <t-switch v-model="tokens.radius.pill" />
          </t-form-item>
        </div>
      </t-form>
    </div>

    <div class="token-fields__group">
      <div class="token-fields__group-title">边框 Border</div>
      <t-form class="token-fields__form">
        <div class="token-fields__grid">
          <t-form-item label="边框宽度 (px)">
            <t-input-number
              v-model="tokens.border.width"
              :min="0"
              :max="20"
              :disabled="tokens.border.style === 'none'"
            />
          </t-form-item>
          <t-form-item label="边框样式">
            <t-select v-model="tokens.border.style" :options="borderStyleOptions" />
          </t-form-item>
          <t-form-item label="边框颜色">
            <div class="token-fields__row">
              <t-color-picker
                v-model="tokens.border.color"
                format="HEX"
                :disabled="tokens.border.style === 'none'"
              />
              <span class="token-fields__hex">{{ tokens.border.color }}</span>
            </div>
          </t-form-item>
        </div>
      </t-form>
    </div>

    <div class="token-fields__group">
      <div class="token-fields__group-title">阴影 Shadow</div>
      <t-form class="token-fields__form">
        <div class="token-fields__grid">
          <t-form-item label="启用阴影">
            <t-switch v-model="tokens.shadow.enabled" />
          </t-form-item>
          <t-form-item label="水平偏移 (px)">
            <t-input-number
              v-model="tokens.shadow.offsetX"
              :min="-100"
              :max="100"
              :disabled="!tokens.shadow.enabled"
            />
          </t-form-item>
          <t-form-item label="垂直偏移 (px)">
            <t-input-number
              v-model="tokens.shadow.offsetY"
              :min="-100"
              :max="100"
              :disabled="!tokens.shadow.enabled"
            />
          </t-form-item>
          <t-form-item label="模糊半径 (px)">
            <t-input-number
              v-model="tokens.shadow.blur"
              :min="0"
              :max="200"
              :disabled="!tokens.shadow.enabled"
            />
          </t-form-item>
          <t-form-item label="阴影颜色" help="支持透明度">
            <div class="token-fields__row">
              <t-color-picker
                v-model="tokens.shadow.color"
                format="RGBA"
                enable-alpha
                :disabled="!tokens.shadow.enabled"
              />
              <span class="token-fields__hex">{{ tokens.shadow.color }}</span>
            </div>
          </t-form-item>
        </div>
      </t-form>
    </div>

    <div class="token-fields__group">
      <div class="token-fields__group-title">动效 Motion</div>
      <t-form class="token-fields__form">
        <div class="token-fields__grid">
          <t-form-item label="基础时长 (ms)">
            <t-input-number v-model="tokens.motion.duration" :min="0" :max="2000" :step="50" />
          </t-form-item>
          <t-form-item label="缓动曲线">
            <t-input v-model="tokens.motion.easing" placeholder="如 ease / cubic-bezier(0.2,0,0,1)" />
          </t-form-item>
          <t-form-item label="动效范围">
            <t-input v-model="tokens.motion.scope" placeholder="如 hover / 切换 / 入场" />
          </t-form-item>
        </div>
      </t-form>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AiDesignStyleTokens } from '@/entity'

defineProps<{ tokens: AiDesignStyleTokens }>()

const borderStyleOptions: Array<{ value: string; label: string }> = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
  { value: 'none', label: '无边框' }
]
</script>

<style scoped lang="less">
.token-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;

  &__group-title {
    margin-bottom: 8px;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
  }

  &__form {
    max-width: 560px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0 16px;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__hex {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
  }
}
</style>
