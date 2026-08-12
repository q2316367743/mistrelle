<template>
  <page-layout>
    <section class="style-hero">
      <div class="style-hero__left">
        <h1 class="style-hero__title">设计风格</h1>
        <p class="style-hero__subtitle">沉淀统一的设计语言，让 AI 生成始终保持一致的视觉风格</p>
        <t-button theme="primary" size="large" @click="handleAdd">
          <template #icon><AddIcon /></template>
          新建风格
        </t-button>
      </div>
    </section>

    <section class="style-section">
      <div class="style-section__header">
        <h2 class="style-section__title">全部风格</h2>
        <div class="style-section__actions">
          <t-select
            v-model="category"
            :options="filterOptions"
            clearable
            placeholder="全部分类"
            class="style-section__filter"
          />
          <t-input v-model="keyword" clearable placeholder="搜索风格" class="style-section__search">
            <template #prefix-icon><SearchIcon /></template>
          </t-input>
        </div>
      </div>
      <div v-if="filteredList.length > 0" class="style-grid">
        <design-style-card
          v-for="s in filteredList"
          :key="s.id"
          :style="s"
          @open="handleOpen(s.id)"
          @edit="handleEdit(s.id)"
          @delete="handleDelete(s.id)"
        />
      </div>
      <t-empty
        v-else
        title="暂无设计风格"
        description="点击右上角新建，或从内置预设中挑选"
        class="style-section__empty"
      />
    </section>
  </page-layout>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AddIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { DESIGN_STYLE_CATEGORY_OPTIONS } from '@/entity'
import { useDesignStyleStore } from '@/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import DesignStyleCard from './components/DesignStyleCard.vue'
import { openDesignStylePut } from './modals/DesignStylePutDialog'

const router = useRouter()
const store = useDesignStyleStore()

const keyword = ref('')
const category = ref('')
const filterOptions = [{ label: '全部分类', value: '' }, ...DESIGN_STYLE_CATEGORY_OPTIONS]

const filteredList = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return store.all.filter((s) => {
    if (category.value && s.category !== category.value) return false
    if (!text) return true
    return (
      s.name.toLowerCase().includes(text) ||
      s.description.toLowerCase().includes(text) ||
      s.tags.some((t) => t.toLowerCase().includes(text))
    )
  })
})

const handleAdd = () => openDesignStylePut()
const handleOpen = (id: string) => router.push(`/design/detail/${id}`)
const handleEdit = (id: string) => openDesignStylePut(id)

const handleDelete = async (id: string) => {
  const s = store.getById(id)
  if (!s) return
  try {
    await MessageBoxUtil.confirm(`确认删除设计风格「${s.name}」？删除后不可恢复`, '删除风格')
    await store.remove(id)
    MessageUtil.success('删除成功')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="less">
.style-hero {
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
}

.style-section {
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

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__filter {
    width: 140px;
  }

  &__search {
    width: 240px;
  }

  &__empty {
    margin-top: 40px;
  }
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
</style>
