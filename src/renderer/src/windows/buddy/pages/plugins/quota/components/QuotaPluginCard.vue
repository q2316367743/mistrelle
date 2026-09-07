<template>
  <div class="plugin-card">
    <div class="plugin-head">
      <div class="name-wrap">
        <t-tag size="small" :theme="descriptor.source === 'builtin' ? 'primary' : 'default'" variant="light">
          {{ descriptor.source === 'builtin' ? '内置' : '第三方' }}
        </t-tag>
        <span class="name">{{ descriptor.name }}</span>
        <span class="desc">{{ descriptor.source === 'builtin' ? '随应用版本更新' : descriptor.key }}</span>
      </div>
      <div class="head-actions">
        <t-radio
          :checked="screenActive"
          :disabled="disabled || !enabled"
          @change="emit('setScreen')"
        >
          屏显额度
        </t-radio>
        <t-switch :value="enabled" :disabled="disabled" @change="(value) => emit('toggle', value === true)" />
      </div>
    </div>
    <t-alert v-if="descriptor.error" theme="error" :message="descriptor.error" />
    <template v-else>
      <div v-for="field in descriptor.settings" :key="field.key" class="setting-row">
        <span class="label">{{ field.label }}</span>
        <t-input
          v-model="localSettings[field.key]"
          class="setting-input"
          :type="field.secret ? 'password' : 'text'"
          :placeholder="field.placeholder"
          :disabled="disabled || !enabled"
          @blur="save"
          @enter="save"
        />
      </div>
      <div v-if="!descriptor.settings.length" class="hint">此插件无需配置</div>
      <div v-else class="hint">设置修改后失焦/回车保存，随下次刷新生效</div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import type { QuotaPluginDescriptor } from '@common/types/quota'

defineOptions({ name: 'QuotaPluginCard' })

const props = defineProps<{
  descriptor: QuotaPluginDescriptor
  enabled: boolean
  settings: Record<string, string>
  /** 本卡是否为当前屏显主额度（屏幕类设备只显示主额度的快照条目） */
  screenActive: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  toggle: [enabled: boolean]
  save: [settings: Record<string, string>]
  setScreen: []
}>()

/** settings 本地编辑态（失焦/回车整份提交，避免每次击键写盘） */
const localSettings = reactive<Record<string, string>>({})

watch(
  () => [props.settings, props.descriptor.settings] as const,
  () => {
    for (const field of props.descriptor.settings) {
      localSettings[field.key] = props.settings[field.key] ?? ''
    }
  },
  { immediate: true, deep: true }
)

/** 整份提交当前 settings（main patch 后回读对齐） */
function save(): void {
  if (props.disabled || !props.enabled) return
  const next: Record<string, string> = { ...props.settings }
  for (const field of props.descriptor.settings) {
    next[field.key] = (localSettings[field.key] ?? '').trim()
  }
  emit('save', next)
}
</script>

<style scoped lang="less">
.plugin-card {
  padding: 12px;
  border: 1px solid var(--td-component-stroke);
  border-radius: 6px;

  .plugin-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;

    .name-wrap {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;

      .name {
        font: var(--td-font-body-medium);
        font-weight: 600;
        color: var(--td-text-color-primary);
      }

      .desc {
        font: var(--td-font-body-small);
        color: var(--td-text-color-placeholder);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .head-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;

    .label {
      width: 88px;
      flex-shrink: 0;
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }

    .setting-input {
      flex: 1;
    }
  }

  .hint {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
