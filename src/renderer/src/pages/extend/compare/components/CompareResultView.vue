<template>
  <t-tabs v-model="tab" class="compare-result">
    <t-tab-panel value="overview" label="对比总览" :destroy-on-hide="false">
      <div class="tab-body">
        <compare-overview-table :record="record" />
        <compare-profile-matrix :record="record" />
      </div>
    </t-tab-panel>

    <t-tab-panel value="questions" label="题集矩阵" :destroy-on-hide="false">
      <div class="tab-body">
        <compare-question-matrix v-if="hasQuestions" :record="record" />
        <t-empty v-else description="暂无题集结果" />
      </div>
    </t-tab-panel>

    <t-tab-panel value="identity" label="身份与一致性" :destroy-on-hide="false">
      <div class="tab-body">
        <compare-identity-panel :record="record" />
      </div>
    </t-tab-panel>

    <t-tab-panel value="logs" label="执行日志" :destroy-on-hide="false">
      <div class="tab-body">
        <compare-log-list :logs="record.logs" />
      </div>
    </t-tab-panel>
  </t-tabs>
</template>

<script lang="ts" setup>
import CompareOverviewTable from './CompareOverviewTable.vue'
import CompareProfileMatrix from './CompareProfileMatrix.vue'
import CompareQuestionMatrix from './CompareQuestionMatrix.vue'
import CompareIdentityPanel from './CompareIdentityPanel.vue'
import CompareLogList from './CompareLogList.vue'
import type { CompareRecord } from '../compare-types'

const props = defineProps<{ record: CompareRecord }>()

const tab = ref('overview')

const hasQuestions = computed(() =>
  props.record.results.some((it) => it.questions.length > 0)
)
</script>

<style scoped lang="less">
.compare-result {
  :deep(.t-tabs__content) {
    padding-top: 8px;
  }
}

.tab-body {
  max-height: 420px;
  overflow-y: auto;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
