<template>
  <div class="identity-panel">
    <div class="block-title">身份自述（不同提供方同款模型是否一致）</div>
    <div class="identity-grid">
      <div v-for="result in record.results" :key="result.target.modelId + result.target.provideName" class="identity-card">
        <div class="card-head">
          <span class="card-name">{{ modelName(result) }}</span>
          <span v-if="result.identity && !result.identity.error" class="card-latency">
            {{ (result.identity.latencyMs / 1000).toFixed(2) }}s
          </span>
        </div>
        <div v-if="result.identity?.error" class="card-error">{{ result.identity.error }}</div>
        <div v-else-if="result.identity?.content" class="card-content">{{ result.identity.content }}</div>
        <div v-else class="card-empty">—</div>
      </div>
    </div>

    <template v-if="hasConsistency">
      <div class="block-title consistency-title">一致性轮（temperature=0 同题重复 3 次）</div>
      <div v-for="result in record.results" :key="`c-${result.target.modelId}-${result.target.provideName}`" class="consistency-model">
        <div class="model-head">
          <span class="card-name">{{ modelName(result) }}</span>
          <t-tag
            v-for="(item, i) in result.consistency"
            :key="item.key"
            size="small"
            :theme="item.error ? 'danger' : item.allSame ? 'success' : 'warning'"
            :class="{ 'tag-gap': i > 0 }"
          >
            {{ item.tag }}：{{ item.error ? '失败' : item.allSame ? '三次一致' : '存在波动' }}
          </t-tag>
        </div>
        <div class="consistency-body">
          <div v-for="item in result.consistency" :key="`b-${item.key}`" class="consistency-item">
            <div class="item-tag">{{ item.tag }}</div>
            <div v-if="item.error" class="item-error">{{ item.error }}</div>
            <div v-for="(answer, i) in item.answers" :key="i" class="item-answer">
              <span class="answer-index">第{{ i + 1 }}次</span>
              <span class="answer-text" :title="answer">{{ answer }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
    <t-empty v-else description="无一致性轮数据" />
  </div>
</template>

<script lang="ts" setup>
import type { CompareRecord } from '../compare-types'
import { modelFullLabel } from '../compare-metrics'

const props = defineProps<{ record: CompareRecord }>()

const modelName = modelFullLabel

const hasConsistency = computed(() =>
  props.record.results.some((it) => it.consistency.length > 0)
)
</script>

<style scoped lang="less">
.identity-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.block-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--td-text-color-secondary);

  &.consistency-title {
    margin-top: 8px;
  }
}

.identity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  align-content: start;
}

.identity-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container-hover);

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .card-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--td-text-color-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-latency {
      flex-shrink: 0;
      font-size: 12px;
      color: var(--td-text-color-placeholder);
      font-variant-numeric: tabular-nums;
    }
  }

  .card-content {
    font-size: 12.5px;
    color: var(--td-text-color-primary);
    line-height: 1.6;
    word-break: break-all;
  }

  .card-error {
    font-size: 12px;
    color: var(--td-error-color);
    word-break: break-all;
  }

  .card-empty {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }
}

.consistency-model {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);

  .model-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;

    .card-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--td-text-color-primary);
    }

    .tag-gap {
      margin-left: 4px;
    }
  }
}

.consistency-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.consistency-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container-hover);

  .item-tag {
    font-size: 12px;
    font-weight: 600;
    color: var(--td-text-color-secondary);
  }

  .item-error {
    font-size: 12px;
    color: var(--td-error-color);
  }

  .item-answer {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;

    .answer-index {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--td-text-color-placeholder);
    }

    .answer-text {
      min-width: 0;
      font-size: 12px;
      color: var(--td-text-color-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
