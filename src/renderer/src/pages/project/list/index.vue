<template>
  <page-layout>
    <section class="project-hero">
      <div class="project-hero__left">
        <h1 class="project-hero__title">项目</h1>
        <p class="project-hero__subtitle">多人协同，打造超级团队</p>
        <t-button theme="primary" size="large" @click="handleAdd">
          <template #icon><AddIcon /></template>
          新建项目
        </t-button>
      </div>
      <div class="project-hero__right"></div>
    </section>

    <section class="project-section">
      <div class="project-section__header">
        <h2 class="project-section__title">我的项目</h2>
        <t-input
          v-model="keyword"
          clearable
          placeholder="搜索项目"
          class="project-section__search"
        >
          <template #prefix-icon><SearchIcon /></template>
        </t-input>
      </div>
      <div v-if="filteredList.length > 0" class="project-grid project-grid--2col">
        <project-card
          v-for="p in filteredList"
          :key="p.id"
          :project="p"
          @open="handleOpen(p.id)"
          @rename="handleRename(p.id)"
          @edit="handleEdit(p.id)"
          @delete="handleDelete(p.id)"
        />
      </div>
      <t-empty
        v-else
        title="暂无项目"
        description="点击右上角新建项目，或从下方模版创建"
        class="project-section__empty"
      />
    </section>

    <section class="project-section">
      <h2 class="project-section__title">从模版创建</h2>
      <div class="project-grid project-grid--3col">
        <project-template-card
          v-for="t in templates"
          :key="t.key"
          :template="t"
          @use="handleUseTemplate(t)"
        />
      </div>
    </section>
  </page-layout>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AddIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { useProjectStore } from '@/store'
import { PROJECT_TEMPLATES, ProjectTemplate } from '@/modules/project'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import ProjectCard from './components/ProjectCard.vue'
import ProjectTemplateCard from './components/ProjectTemplateCard.vue'
import { openProjectPut } from './modals/ProjectPutDialog'

const router = useRouter()
const store = useProjectStore()
const keyword = ref('')
const templates = PROJECT_TEMPLATES

const filteredList = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return store.state
  return store.state.filter((p) => p.name.toLowerCase().includes(text))
})

const handleAdd = () => openProjectPut()
const handleOpen = (id: string) => router.push(`/project/${id}`)
const handleEdit = (id: string) => openProjectPut(id)
const handleUseTemplate = (t: ProjectTemplate) => openProjectPut(undefined, t)

const handleRename = async (id: string) => {
  const p = store.getById(id)
  if (!p) return
  try {
    const newName = await MessageBoxUtil.prompt('请输入新的项目名', '重命名项目', {
      inputValue: p.name
    })
    const trimmed = newName.trim()
    if (!trimmed || trimmed === p.name) return
    await store.updateName(id, trimmed)
    MessageUtil.success('重命名成功')
  } catch {
    // 用户取消
  }
}

const handleDelete = async (id: string) => {
  const p = store.getById(id)
  if (!p) return
  try {
    await MessageBoxUtil.confirm(
      `确认删除项目「${p.name}」？将一并删除该项目下的全部对话、任务、动态和文件，数据不可恢复`,
      '删除项目'
    )
    await store.remove(id)
    MessageUtil.success('删除成功')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="less">
.project-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32px 24px;
  background: var(--td-bg-color-container);
  border-bottom: 1px solid var(--td-component-stroke);

  &__title {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: var(--td-text-color-primary);
  }

  &__subtitle {
    margin: 8px 0 20px;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
  }

  &__right {
    width: 320px;
    height: 160px;
  }
}

.project-section {
  padding: 24px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  &__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__search {
    width: 240px;
  }

  &__empty {
    margin-top: 40px;
  }
}

.project-grid {
  display: grid;
  gap: 12px;

  &--2col {
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  }

  &--3col {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}
</style>
