<template>
  <div class="panel">
    <div class="panel-head">
      <div class="panel-title">屏显额度</div>
      <t-link theme="primary" @click="goQuotaConfig">额度配置</t-link>
    </div>
    <div class="screen-row">
      <span class="label">上屏额度</span>
      <t-select
        class="screen-select"
        :value="screenQuota"
        :options="screenOptions"
        :disabled="lcdSaving"
        @change="changeScreenQuota"
      />
    </div>
    <div class="preview">
      <template v-if="screenItem">
        <div class="preview-row">
          <span class="preview-label">{{ screenItem.label }}</span>
          <span class="preview-value">
            {{ screenItem.screenValue ?? screenItem.value
            }}<template v-if="screenItem.screenUnit"> {{ screenItem.screenUnit }}</template>
          </span>
          <span v-if="screenItem.screenPct != null" class="preview-pct">
            {{ Math.round(screenItem.screenPct) }}%
          </span>
        </div>
        <div v-if="fallbackShown" class="preview-fallback">
          选中插件暂无屏显额度，当前显示第一条可用额度
        </div>
      </template>
      <span v-else class="empty">暂无额度数据——在「额度配置」页启用额度插件并刷新</span>
    </div>
    <div class="hint">
      屏上同时只显示一个额度：按键挑选额度插件上屏（写本设备配置）；该插件未启用或无额度时自动回落第一条可用额度。
      刷新节奏与插件管理在「额度配置」页。
    </div>
  </div>
</template>

<script lang="ts" setup>
import { CommonSelect } from '@/domain'
import type { QuotaItem } from '@common/types/quota'
import { useRouter } from 'vue-router'
import { useQuota } from '../../../settings/quota/useQuota'
import { useEsp32Lcd } from '../useEsp32Lcd'

defineOptions({ name: 'QuotaPanel' })

const router = useRouter()
// 屏显选择是屏幕自身的显示配置（esp32-lcd.json）；插件列表/快照只作选项与上屏预览（额度数据归额度配置页）
const { plugins, lastQuota } = useQuota()
const { config: lcdConfig, patch: patchLcd, saving: lcdSaving } = useEsp32Lcd()

/** 屏显额度下拉值（'' = 默认：回落第一条可用额度） */
const screenQuota = computed(() => lcdConfig.value?.screenQuota ?? '')

/** 下拉选项：默认 + 全部额度插件（写 esp32-lcd 配置 screenQuota，即改即存即时生效） */
const screenOptions = computed<Array<CommonSelect<string>>>(() => [
  { value: '', label: '默认（第一条可用）' },
  ...plugins.value.map((descriptor) => ({ value: descriptor.key, label: descriptor.name }))
])

function changeScreenQuota(value: unknown): void {
  if (typeof value !== 'string' || !lcdConfig.value) return
  void patchLcd({ screenQuota: value || undefined })
}

/** 带屏显字段的条目才是真正会下发屏幕的行（与 main pickScreenQuota 同语义） */
const hasScreenFields = (item: QuotaItem): boolean => !!item.screenTemplate && !!item.screenValue

/** 当前实际会显示在屏幕上的额度条目：先按选择键精确匹配，无则回落第一条带屏显字段者 */
const screenItem = computed<QuotaItem | null>(() => {
  const items = lastQuota.value?.items ?? []
  const scoped = screenQuota.value ? items.filter((item) => item.pluginKey === screenQuota.value) : items
  return scoped.find(hasScreenFields) ?? items.find(hasScreenFields) ?? null
})

/** 选择了指定插件但实际在显示回落条目时提示用户 */
const fallbackShown = computed(
  () => !!screenQuota.value && !!screenItem.value && screenItem.value.pluginKey !== screenQuota.value
)

/** 前往「设置-额度配置」管理插件与刷新节奏 */
function goQuotaConfig(): void {
  void router.push('/settings/quota')
}
</script>

<style scoped lang="less">
.panel {
  padding: 16px;
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-title {
  font: var(--td-font-body-medium);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.screen-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  .label {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  .screen-select {
    width: 220px;
  }
}

.preview {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer);

  .preview-row {
    display: flex;
    align-items: baseline;
    gap: 10px;

    .preview-label {
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }

    .preview-value {
      font-family: var(--td-font-family-code);
      font-size: var(--td-font-size-body-large);
      color: var(--td-text-color-primary);
    }

    .preview-pct {
      font: var(--td-font-body-small);
      color: var(--td-brand-color);
    }
  }

  .preview-fallback {
    margin-top: 4px;
    font: var(--td-font-body-small);
    color: var(--td-warning-color-7);
  }

  .empty {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}

.hint {
  margin-top: 8px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
}
</style>
