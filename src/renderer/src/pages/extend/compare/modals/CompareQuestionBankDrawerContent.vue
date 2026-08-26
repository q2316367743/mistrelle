<template>
  <div class="bank-content">
    <t-alert theme="info" class="bank-tip">
      题库入库 compare_question 表（不再手改 json 防格式错误）。判分规则：关键词全部包含
      {{ '＋' }} 可选正则匹配；答案全文保留在对比记录中供人工复核。启用开关 / 编辑即时保存。
    </t-alert>

    <t-table row-key="key" size="small" bordered :columns="columns" :data="bank" :loading="saving">
      <template #enable="{ row }">
        <t-switch v-model="row.enable" size="small" @change="handleToggle(row)" />
      </template>
      <template #tag="{ row }">
        <t-tag size="small" variant="outline">{{ row.tag }}</t-tag>
      </template>
      <template #question="{ row }">
        <span class="question-text" :title="row.question">{{ row.question }}</span>
      </template>
      <template #answerKeys="{ row }">
        <span class="keys-text">{{ row.answerKeys.join('、') }}</span>
      </template>
      <template #op="{ row }">
        <div class="op-cell">
          <t-link theme="primary" hover="color" @click="openEdit(row)">编辑</t-link>
          <t-popconfirm content="确认删除该题？" @confirm="handleDelete(row.key)">
            <t-link theme="danger" hover="color">删除</t-link>
          </t-popconfirm>
        </div>
      </template>
    </t-table>

    <div class="bank-actions">
      <div class="left-actions">
        <t-button variant="outline" @click="openEdit(null)">
          <template #icon><AddIcon /></template>
          新增题目
        </t-button>
        <t-popconfirm
          content="确认恢复内置默认题库？当前全部题目将被默认 12 题覆盖。"
          @confirm="handleReset"
        >
          <t-button variant="outline" theme="danger" :loading="saving">恢复默认</t-button>
        </t-popconfirm>
      </div>
      <div class="right-actions">
        <span class="count-text">共 {{ bank.length }} 题 · {{ enabledCount }} 启用</span>
        <t-button theme="default" variant="base" @click="emit('close')">关闭</t-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AddIcon } from 'tdesign-icons-vue-next'
import type { BaseTableCol } from 'tdesign-vue-next'
import { useModelCompare } from '../useModelCompare'
import { openQuestionEditDialog } from './CompareQuestionEditDialog'

const emit = defineEmits<{ close: [] }>()

const { bank, upsertQuestion, deleteQuestion, resetBank } = useModelCompare()

const saving = ref(false)
const enabledCount = computed(() => bank.value.filter((it) => it.enable).length)

const columns: BaseTableCol[] = [
  { colKey: 'enable', title: '启用', width: 64 },
  { colKey: 'tag', title: '分类', width: 110 },
  { colKey: 'question', title: '题目' },
  { colKey: 'answerKeys', title: '关键词', width: 150 },
  { colKey: 'op', title: '操作', width: 110 }
]

/** 启停即时保存（t-switch change 回调参数是 SwitchValue，此处无需读取） */
const handleToggle = async (row: CompareQuestionInput): Promise<void> => {
  await upsertQuestion({ ...row, enable: Boolean(row.enable) })
}

const openEdit = (question: CompareQuestionInput | null): void => {
  const nextOrder =
    bank.value.length > 0 ? Math.max(...bank.value.map((it) => it.orderIndex)) + 1 : 1
  openQuestionEditDialog(question, nextOrder)
}

const handleDelete = async (key: string): Promise<void> => {
  await deleteQuestion(key)
}

const handleReset = async (): Promise<void> => {
  saving.value = true
  try {
    await resetBank()
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="less">
.bank-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.bank-tip {
  margin: 0;
}

.question-text {
  font-size: 12px;
  color: var(--td-text-color-primary);
}

.keys-text {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.op-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bank-actions {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0;
  background: var(--td-bg-color-container);

  .left-actions {
    display: flex;
    gap: 8px;
  }

  .right-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .count-text {
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }
}
</style>