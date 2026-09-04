<template>
  <div class="detail">
    <section class="detail-block">
      <div class="detail-block__title">效果预览</div>
      <div class="detail-block__body">
        <style-card-face :style="style" variant="full" />
      </div>
    </section>

    <section class="detail-block">
      <div class="detail-block__title">基础信息</div>
      <div class="detail-block__body">
        <div class="detail-basic">
          <div class="detail-basic__name">
            {{ style.name }}
            <t-tag v-if="style.isSystem" theme="primary" variant="light" size="small"
              >内置预设</t-tag
            >
            <t-tag v-else-if="online" theme="warning" variant="light" size="small">在线</t-tag>
          </div>
          <p class="detail-basic__desc">{{ style.description || '暂无简介' }}</p>
          <div class="detail-basic__meta">
            <t-tag size="small" variant="outline">{{ categoryLabel }}</t-tag>
            <t-tag v-for="t in style.tags" :key="t" size="small" variant="light">{{ t }}</t-tag>
          </div>
          <div v-if="style.aliases?.length" class="detail-basic__row">
            <span class="detail-basic__label">别名</span>
            <span>{{ style.aliases.join(' / ') }}</span>
          </div>
          <div v-if="style.signature" class="detail-basic__row">
            <span class="detail-basic__label">签名手法</span>
            <span>{{ style.signature }}</span>
          </div>
          <div class="detail-basic__row">
            <span class="detail-basic__label">留白</span>
            <span>约 {{ style.whitespaceRatio ?? 55 }}%</span>
          </div>
          <div v-if="style.preferredFormats?.length" class="detail-basic__row">
            <span class="detail-basic__label">常用画幅</span>
            <span>{{ style.preferredFormats.join(' / ') }}</span>
          </div>
          <div v-if="style.suitableFor" class="detail-basic__row">
            <span class="detail-basic__label">适合</span>
            <span>{{ style.suitableFor }}</span>
          </div>
          <div v-if="style.unsuitableFor" class="detail-basic__row">
            <span class="detail-basic__label">不适合</span>
            <span>{{ style.unsuitableFor }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="detail-block">
      <div class="detail-block__title">配色方案</div>
      <div class="detail-block__body">
        <style-palette-block :palette="style.colorPalette" />
      </div>
    </section>

    <section class="detail-block">
      <div class="detail-block__title">字体规范</div>
      <div class="detail-block__body">
        <style-typography-block :typography="style.typography" />
      </div>
    </section>

    <section class="detail-block">
      <div class="detail-block__title">细节规范</div>
      <div class="detail-block__body">
        <style-token-block :tokens="style.tokens" />
      </div>
    </section>

    <section class="detail-block">
      <div class="detail-block__title">视觉提示</div>
      <div class="detail-block__body">
        <style-prompt-block
          :visual-prompt="style.visualPrompt"
          :negative-prompt="style.negativePrompt"
        />
      </div>
    </section>

    <section class="detail-block">
      <div class="detail-block__title">布局规则</div>
      <div class="detail-block__body">
        <ul v-if="style.layoutRules.length > 0" class="detail-rules">
          <li v-for="(rule, idx) in style.layoutRules" :key="idx" class="detail-rules__item">
            {{ rule }}
          </li>
        </ul>
        <div v-else class="detail-rules__empty">未设置布局约束</div>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import {
  AiDesignStyle,
  getDesignStyleCategoryLabel,
  normalizeDesignStyleCategory
} from '@/entity'
import StylePaletteBlock from './StylePaletteBlock.vue'
import StyleTypographyBlock from './StyleTypographyBlock.vue'
import StyleTokenBlock from './StyleTokenBlock.vue'
import StylePromptBlock from './StylePromptBlock.vue'
import StyleCardFace from '@/components/design/StyleCardFace.vue'

const props = defineProps<{ style: AiDesignStyle; online?: boolean }>()

const categoryLabel = computed(() =>
  getDesignStyleCategoryLabel(normalizeDesignStyleCategory(props.style.category))
)
</script>

<style scoped lang="less">
.detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px;
  max-width: 960px;
}

.detail-block {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);

  &__title {
    padding: 12px 16px;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    border-bottom: 1px solid var(--td-component-stroke);
  }

  &__body {
    padding: 16px;
  }
}

.detail-basic {
  &__name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__desc {
    margin: 8px 0 12px;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__row {
    display: flex;
    gap: 12px;
    margin-top: 10px;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  &__label {
    flex-shrink: 0;
    width: 72px;
    color: var(--td-text-color-placeholder);
  }
}

.detail-rules {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__item {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  &__empty {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-placeholder);
  }
}
</style>
