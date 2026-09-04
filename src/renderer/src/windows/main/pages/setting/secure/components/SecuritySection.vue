<template>
  <div class="security-section" :class="{ clickable }">
    <div class="section-header">
      <t-icon :name="icon" class="section-icon" />
      <div class="section-meta">
        <div class="section-title-row">
          <span class="section-title">{{ title }}</span>
          <t-tooltip v-if="tip" :content="tip">
            <t-icon name="help-circle" class="section-help" />
          </t-tooltip>
        </div>
        <div v-if="description" class="section-desc">{{ description }}</div>
      </div>
      <div class="section-action">
        <slot name="action" />
        <t-icon v-if="arrow" name="chevron-right" class="section-arrow" />
      </div>
    </div>
    <div v-if="$slots.default" class="section-body">
      <slot />
    </div>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  icon: string
  title: string
  description?: string
  tip?: string
  arrow?: boolean
  clickable?: boolean
}>()
</script>

<style scoped lang="less">
.security-section {
  padding: 16px 0;
  border-top: 1px solid var(--td-component-stroke);

  &:first-child {
    padding-top: 8px;
    border-top: none;
  }

  &.clickable {
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-radius: var(--td-radius-default);

    &:hover {
      background-color: var(--td-bg-color-secondarycontainer);
    }
  }
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.section-icon {
  flex: none;
  margin-top: 2px;
  font-size: 20px;
  color: var(--td-brand-color);
}

.section-meta {
  flex: 1;
  min-width: 0;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.section-help {
  font-size: 14px;
  color: var(--td-text-color-placeholder);
  cursor: help;
}

.section-desc {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--td-text-color-secondary);
}

.section-action {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-arrow {
  font-size: 16px;
  color: var(--td-text-color-placeholder);
}

.section-body {
  margin-top: 12px;
  padding-left: 32px;
}
</style>
