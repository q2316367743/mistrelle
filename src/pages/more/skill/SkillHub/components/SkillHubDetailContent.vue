<template>
  <div v-if="loading" class="skill-hub-detail__loading">
    <t-loading text="加载中..." class="h-80vh" />
  </div>
  <div v-else class="skill-hub-detail">
    <div class="skill-hub-detail__header">
      <t-space size="small" class="skill-hub-detail__info">
        <span class="skill-hub-detail__name">{{ skill.name }}</span>
        <t-tag v-if="ver" size="small" variant="light" theme="primary">v{{ ver }}</t-tag>
        <t-tag size="small" variant="light">下载 {{ prettyCount(downloads) }}</t-tag>
        <t-tag size="small" variant="light">收藏 {{ prettyCount(stars) }}</t-tag>
        <t-tag v-if="source !== '-'" size="small" variant="outline">{{ source }}</t-tag>
        <t-tag v-if="skill.verified" size="small" theme="success" variant="light">已认证</t-tag>
      </t-space>
      <t-space size="small">
        <t-button theme="primary" size="small" @click="handleDownload">下载安装</t-button>
        <t-button v-if="skill.homepage" variant="outline" size="small" @click="handleHomepage"
          >主页</t-button
        >
      </t-space>
    </div>
    <div class="skill-hub-detail__cats">
      <t-tag v-for="c in categories" :key="c.key" size="small" variant="outline">{{
        c.name
      }}</t-tag>
    </div>
    <t-tabs v-model="activeTab" class="skill-hub-detail__tabs">
      <t-tab-panel value="overview" label="概述" :destroy-on-hide="false">
        <div class="skill-hub-detail__panel">
          <t-alert theme="info">以下内容来自该技能的 SKILL.md 原文</t-alert>
          <chat-content v-if="skillMd" :content="skillMd" />
          <div v-else class="skill-hub-detail__text">{{ fallback }}</div>
        </div>
      </t-tab-panel>
      <t-tab-panel value="files" label="文件" :destroy-on-hide="false">
        <div class="skill-hub-detail__panel">
          <t-tree
            v-if="fileTree.length > 0"
            :data="fileTree"
            hover
            expand-all
            activable
            line
            transition
            expand-on-click-node
            :icon="treeIcon"
            :operations="treeOperations"
            @click="handleTreeClick"
          />
          <div v-else class="skill-hub-detail__empty">暂无文件</div>
        </div>
      </t-tab-panel>
      <t-tab-panel value="versions" label="版本" :destroy-on-hide="false">
        <div class="skill-hub-detail__panel">
          <t-list v-if="versions.length > 0" split>
            <t-list-item v-for="item in versions" :key="item.versionId">
              <t-list-item-meta
                :title="`v${item.version}`"
                :description="item.changelog || '无更新说明'"
              />
              <template #action>
                <div class="skill-hub-detail__vmeta">
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
          <div v-else class="skill-hub-detail__empty">暂无版本信息</div>
        </div>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>
<script lang="ts" setup>
import { h, onMounted, ref, computed } from 'vue'
import { FolderIcon, FileMarkdownIcon, FileIcon } from 'tdesign-icons-vue-next'
import { ChatContent } from '@tdesign-vue-next/chat'
import { MessageUtil } from '@/utils/modal'
import { prettyDataUnit, prettyDate } from '@/utils/lang/FormatUtil'
import {
  skillHubApiV1SkillsInfo,
  skillHubApiV1SkillsFile,
  skillHubApiV1SkillsFiles,
  apiV1SkillsVersions,
  type ApiSkill,
  type ApiV1SkillsResult,
  type ApiV1SkillVersionItem
} from '@/modules/skillhub'
import { buildFileTree, openSkillHubFileView, type FileTreeNode } from './SkillHubDetailShared'
import { openSkillHubDownload } from '../modals/skillhub-func'

const props = defineProps<{
  skill: ApiSkill
}>()

const loading = ref(true)
const detail = ref<ApiV1SkillsResult | null>(null)
const skillMd = ref('')
const fileTree = ref<FileTreeNode[]>([])
const versions = ref<ApiV1SkillVersionItem[]>([])
const activeTab = ref('overview')

onMounted(async () => {
  try {
    const [info, md, fileRes, versionRes] = await Promise.all([
      skillHubApiV1SkillsInfo(props.skill.slug),
      skillHubApiV1SkillsFile(props.skill.slug, 'SKILL.md').catch(() => ''),
      skillHubApiV1SkillsFiles(props.skill.slug).catch(() => null),
      apiV1SkillsVersions(props.skill.slug).catch(() => null)
    ])
    detail.value = info
    skillMd.value = md
    fileTree.value = fileRes ? buildFileTree(fileRes.files) : []
    versions.value = versionRes?.versions ?? []
  } catch (e) {
    MessageUtil.error('加载详情失败', e)
  } finally {
    loading.value = false
  }
})

const s = computed(() => detail.value?.skill)
const ver = computed(() => detail.value?.latestVersion?.version || props.skill.version)
const downloads = computed(() => s.value?.stats?.downloads ?? props.skill.downloads)
const stars = computed(() => s.value?.stats?.stars ?? props.skill.stars)
const source = computed(
  () => props.skill.ownerName || detail.value?.owner?.displayName || props.skill.source || '-'
)
const categories = computed(
  () => (s.value?.subCategories?.length ? s.value.subCategories : props.skill.subCategories) ?? []
)
const fallback = computed(
  () =>
    s.value?.summary_zh ||
    s.value?.summary ||
    props.skill.description_zh ||
    props.skill.description ||
    '暂无介绍'
)

const prettyCount = (n: number) => {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const securityTheme = (status: string) => {
  if (status === 'benign') return 'success'
  if (status === 'suspicious') return 'warning'
  return 'default'
}

const handleDownload = () => openSkillHubDownload(props.skill)
const handleHomepage = () => window.preload.inject.shell.openExternal(props.skill.homepage)

const handleTreeClick = (ctx: unknown) => {
  const data = ((ctx as { node: { data: FileTreeNode } }).node?.data ?? null) as FileTreeNode | null
  if (!data?.isFile) return
  openSkillHubFileView(props.skill.slug, String(data.value), data.size)
}

const treeIcon: any = (_h: unknown, node: { data: FileTreeNode }) => {
  const d = node.data
  if (!d.isFile) return h(FolderIcon as any)
  const name = String(d.value).split('/').pop() || ''
  if (/\.md$/i.test(name)) return h(FileMarkdownIcon as any)
  return h(FileIcon as any)
}

const treeOperations: any = (_h: unknown, node: { data: FileTreeNode }) => {
  const d = node.data
  if (d.isFile && d.size != null) {
    return h('span', { class: 'skill-hub-detail__fsize' }, prettyDataUnit(d.size))
  }
  return null
}
</script>
<style scoped lang="less">
.skill-hub-detail__loading {
  padding: 48px;
  text-align: center;
}
.skill-hub-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: nowrap;
    flex-shrink: 0;
  }

  &__info {
    min-width: 0;
    overflow: hidden;
  }

  &__name {
    font: var(--td-font-title-large);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__cats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex-shrink: 0;
  }

  &__tabs {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  &__panel {
    height: 100%;
    overflow: auto;
    padding: 4px 0;
  }

  &__text {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
    white-space: pre-wrap;
    line-height: 1.6;
  }

  &__empty {
    padding: 24px;
    text-align: center;
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }

  &__vmeta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__fsize {
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }
}

.skill-hub-detail :deep(.t-tabs) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.skill-hub-detail :deep(.t-tabs__content) {
  flex: 1;
  min-height: 0;
}
.skill-hub-detail :deep(.t-tab-panel) {
  height: 100%;
}
.skill-hub-detail :deep(.t-tree) {
  padding: 4px 0;
}
.skill-hub-detail :deep(.t-tree .t-tree__label) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
