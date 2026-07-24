<template>
  <t-card size="small" hover-shadow class="skill-hub-card" @click="emit('detail')">
    <div class="skill-hub-card__head">
      <t-avatar v-if="skill.iconUrl" :image="skill.iconUrl" size="40px" shape="round" />
      <t-avatar v-else size="40px" shape="round">{{ skill.name.slice(0, 1) }}</t-avatar>
      <div class="skill-hub-card__title">
        <div class="skill-hub-card__name" :title="skill.name">
          {{ skill.name }}
          <t-tag v-if="skill.verified" size="small" theme="success" variant="light">已认证</t-tag>
        </div>
        <div class="skill-hub-card__slug">{{ skill.slug }}</div>
      </div>
    </div>
    <div class="skill-hub-card__desc" :title="desc">{{ desc || '暂无描述' }}</div>
    <div class="skill-hub-card__meta">
      <span>
        <download-icon size="14px" />
        {{ prettyCount(skill.downloads) }}
      </span>
      <span>
        <star-icon size="14px" />
        {{ prettyCount(skill.stars) }}
      </span>
      <span v-if="skill.version">v{{ skill.version }}</span>
    </div>
    <div class="skill-hub-card__footer">
      <div class="skill-hub-card__tags">
        <t-tag v-if="skill.ownerName" size="small" variant="light">{{ skill.ownerName }}</t-tag>
        <t-tag
          v-for="sub in (skill.subCategories ?? []).slice(0, 2)"
          :key="sub.key"
          size="small"
          variant="outline"
        >
          {{ sub.name }}
        </t-tag>
      </div>
      <t-button
        size="small"
        theme="primary"
        variant="outline"
        @click.stop="emit('download')"
      >
        下载
      </t-button>
    </div>
  </t-card>
</template>
<script lang="ts" setup>
import { DownloadIcon, StarIcon } from 'tdesign-icons-vue-next'
import type { ApiSkill } from '@/modules/skillhub'

const props = defineProps<{
  skill: ApiSkill
}>()

const emit = defineEmits<{
  download: []
  detail: []
}>()

const desc = computed(() => props.skill.description_zh || props.skill.description)

const prettyCount = (n: number) => {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
</script>
<style scoped lang="less">
.skill-hub-card {
  cursor: pointer;
  user-select: none;
  height: 100%;

  &__head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 10px;
  }

  &__title {
    min-width: 0;
    flex: 1;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__slug {
    margin-top: 2px;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__desc {
    display: -webkit-box;
    min-height: 40px;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 10px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);

    span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 12px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
  }
}
</style>
