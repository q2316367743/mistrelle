<template>
  <main class="skill-detail">
    <template v-if="skill">
      <div class="skill-detail__header">
        <div class="skill-detail__title">
          <span class="skill-detail__name">{{ skill.name }}</span>
          <t-tag size="small" variant="light">{{ skill.agentName }}</t-tag>
        </div>
        <t-space size="small">
          <t-button size="small" variant="outline" @click="emit('openFolder')">打开目录</t-button>
          <t-button size="small" theme="danger" variant="outline" @click="emit('remove')">删除</t-button>
        </t-space>
      </div>

      <div class="skill-detail__body">
        <div class="skill-detail__info">
          <div class="skill-detail__row">
            <span class="skill-detail__label">目录名</span>
            <span class="skill-detail__value">{{ skill.dirName }}</span>
          </div>
          <div class="skill-detail__row">
            <span class="skill-detail__label">路径</span>
            <span class="skill-detail__value" :title="skill.path">{{ skill.path }}</span>
          </div>
          <div class="skill-detail__row">
            <span class="skill-detail__label">描述</span>
            <span class="skill-detail__value">{{ skill.description || '暂无描述' }}</span>
          </div>
        </div>

        <div class="skill-detail__section-title">SKILL.md</div>
        <t-textarea
          :model-value="content"
          class="skill-detail__content"
          placeholder="SKILL.md 内容"
          :autosize="false"
          readonly
        />

        <div class="skill-detail__section-title">
          文件列表
          <t-button size="small" variant="text" @click="emit('reloadFiles')">
            <template #icon>
              <refresh-icon />
            </template>
          </t-button>
        </div>
        <t-loading :loading="detailLoading" size="small">
          <t-list :split="true" class="skill-detail__files">
            <t-list-item
              v-for="file in files"
              :key="file.path"
              class="skill-file-item"
              @click="emit('openFile', file)"
            >
              <div class="skill-file-item__name">{{ file.relativePath }}</div>
              <template #action>
                <span class="skill-file-item__size">{{ prettyDataUnit(file.size) }}</span>
              </template>
            </t-list-item>
            <div v-if="files.length === 0" class="skill-detail__empty">暂无文件</div>
          </t-list>
        </t-loading>
      </div>
    </template>
    <div v-else class="skill-detail__placeholder">
      <empty-result title="选择一个 Skill" tip="从左侧列表点击 Skill 查看详情" />
    </div>
  </main>
</template>
<script lang="ts" setup>
import { RefreshIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import { LocalSkill, LocalSkillFile } from '@/modules/skill'
import { prettyDataUnit } from '@/utils/lang/FormatUtil'

defineProps<{
  skill: LocalSkill | null
  content: string
  files: Array<LocalSkillFile>
  detailLoading: boolean
}>()

const emit = defineEmits<{
  openFolder: []
  remove: []
  reloadFiles: []
  openFile: [file: LocalSkillFile]
}>()
</script>
<style scoped lang="less">
.skill-detail {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 0;
    padding: 16px 16px 0;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
  }

  &__placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    :deep(.empty-result-container) {
      height: auto;
      min-height: 0;
    }
  }



  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    font: var(--td-font-title-large);
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__info {
    margin-bottom: 16px;
    padding: 12px;
    border-radius: var(--td-radius-default);
    background-color: var(--td-bg-color-secondarycontainer);
  }

  &__row {
    display: flex;
    gap: 12px;
    margin-bottom: 8px;
    font: var(--td-font-body-medium);

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__label {
    flex-shrink: 0;
    width: 48px;
    color: var(--td-text-color-secondary);
  }

  &__value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 16px 0 8px;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
  }

  &__content {
    width: 100%;
    height: 280px;

    :deep(textarea) {
      height: 100% !important;
      font-family: var(--td-font-family-mono, monospace);
      resize: vertical;
    }
  }

  &__files {
    border: 1px solid var(--td-component-border);
    border-radius: var(--td-radius-default);
  }

  &__empty {
    padding: 24px 12px;
    text-align: center;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}

.skill-file-item {
  cursor: pointer;

  &:hover {
    background-color: var(--td-bg-color-container-hover);
  }

  &__name {
    overflow: hidden;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__size {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
