<template>
  <page-layout :title="project?.name || '未找到'">
    <template #extra>
      <t-button v-if="project" theme="default" variant="outline" @click="handleRename">
        <template #icon><EditIcon /></template>
        重命名
      </t-button>
    </template>
    <div class="project-detail-layout">
      <nav v-if="project" class="project-detail-tabs">
        <router-link
          v-for="t in tabs"
          :key="t.key"
          :to="t.path"
          class="project-detail-tab"
          active-class="is-active"
        >
          {{ t.label }}
        </router-link>
        <div class="ml-auto">
          <t-button theme="primary" variant="text" shape="square" @click="toggleCollapsed()">
            <template #icon>
              <MenuIcon />
            </template>
          </t-button>
        </div>
      </nav>

      <t-layout v-if="project" class="project-detail-body">
        <t-content class="project-detail-main">
          <t-layout class="h-full">
            <t-content class="overflow-auto">
              <router-view :id="id" />
            </t-content>
            <t-footer style="padding: 0;margin-top: 8px;">
              <project-footer-panel />
            </t-footer>
          </t-layout>
        </t-content>
        <t-aside class="project-detail-side" :width="collapsed ? '0px' : '240px'">
          <project-side-panel :project="project" />
        </t-aside>
      </t-layout>
      <div v-else class="project-detail-empty">
        <t-empty title="项目不存在" description="该项目可能已被删除">
          <t-button theme="primary" @click="goList">返回项目列表</t-button>
        </t-empty>
      </div>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { EditIcon, MenuIcon } from 'tdesign-icons-vue-next'
import { useProjectStore } from '@/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import ProjectSidePanel from './components/ProjectSidePanel.vue'
import { useBoolState } from '@/hooks'
import ProjectFooterPanel from '@/pages/project/detail/components/ProjectFooterPanel.vue'

const route = useRoute()
const router = useRouter()
const store = useProjectStore()

const [collapsed, toggleCollapsed] = useBoolState(false)

const id = computed(() => String(route.params.id))
const project = computed(() => store.getById(id.value))

const tabs = computed(() => [
  { key: 'dynamics', label: '动态', path: `/project/${id.value}/dynamics` },
  { key: 'plan', label: '计划', path: `/project/${id.value}/plan` },
  { key: 'task', label: '任务', path: `/project/${id.value}/task` },
  { key: 'asset', label: '资产', path: `/project/${id.value}/asset` }
])

const goList = () => router.push('/project/list')

const handleRename = async () => {
  if (!project.value) return
  try {
    const newName = await MessageBoxUtil.prompt('请输入新的项目名', '重命名项目', {
      inputValue: project.value.name
    })
    const trimmed = newName.trim()
    if (!trimmed || trimmed === project.value.name) return
    await store.updateName(project.value.id, trimmed)
    MessageUtil.success('重命名成功')
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  if (!project.value) {
    store.init().catch(() => {
      // ignore
    })
  }
})
</script>

<style scoped lang="less">
.project-detail-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--td-bg-color-page);
}

.project-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  height: 48px;
  background: var(--td-bg-color-container);
  border-bottom: 1px solid var(--td-component-stroke);

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
}

.project-detail-tabs {
  display: flex;
  gap: 24px;
  align-items: center;
  padding: 0 16px;
  height: 44px;
  background: var(--td-bg-color-container);
  border-bottom: 1px solid var(--td-component-stroke);
  flex-shrink: 0;
}

.project-detail-tab {
  display: flex;
  align-items: center;
  height: 100%;
  font: var(--td-font-title-small);
  color: var(--td-text-color-secondary);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition:
    color var(--fluent-transition-fast),
    border-color var(--fluent-transition-fast);

  &:hover {
    color: var(--td-text-color-primary);
  }

  &.is-active {
    color: var(--td-text-color-primary);
    border-bottom-color: var(--td-brand-color);
  }
}

.project-detail-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.project-detail-main {
  flex: 1;
  min-width: 0;
  padding: 16px;
  overflow: hidden;
  height: calc(100vh - 125px);
  background-color: var(--td-bg-color-container) !important;
}

.project-detail-side {
  border-left: 1px solid var(--td-component-stroke);
  overflow: hidden;
  background-color: var(--td-bg-color-container) !important;
}

.project-detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
