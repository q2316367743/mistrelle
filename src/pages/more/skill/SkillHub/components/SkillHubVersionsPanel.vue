<template>
  <t-list v-if="versions.length > 0" split>
    <t-list-item v-for="item in versions" :key="item.versionId">
      <t-list-item-meta
        :title="`v${item.version}`"
        :description="item.changelog || '无更新说明'"
      />
      <template #action>
        <div class="skill-hub-versions__vmeta">
          <span>{{ prettyDate(item.createdAt) }}</span>
          <t-tag
            v-if="item.securityReports?.keen?.statusText"
            size="small"
            variant="light"
            :theme="securityTheme(item.securityReports.keen.status)"
            >{{ item.securityReports.keen.statusText }}</t-tag
          >
        </div>
      </template>
    </t-list-item>
  </t-list>
  <div v-else class="skill-hub-versions__empty">暂无版本信息</div>
</template>
<script lang="ts" setup>
import { prettyDate } from '@/utils/lang/FormatUtil'
import type { ApiV1SkillVersionItem } from '@/modules/skillhub'

defineProps<{
  versions: Array<ApiV1SkillVersionItem>
}>()

const securityTheme = (status: string) => {
  if (status === 'benign') return 'success'
  if (status === 'suspicious') return 'warning'
  return 'default'
}
</script>
<style scoped lang="less">
.skill-hub-versions {
  &__vmeta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }
}
</style>
