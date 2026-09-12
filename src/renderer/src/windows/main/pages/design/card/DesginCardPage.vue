<template>
  <div class="h-100vh overflow-y-auto">
    <section class="style-hero">
      <div class="style-hero__left">
        <h1 class="style-hero__title">笔记卡片风格</h1>
        <p class="style-hero__subtitle">约定样式的图文卡片风格，供「笔记卡片」生成与 AI 使用</p>
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
          <t-input v-model="keyword" clearable placeholder="搜索风格" class="style-section__search">
            <template #prefix-icon><SearchIcon /></template>
          </t-input>
        </div>
      </div>

      <template v-if="filtered.length > 0">
        <div class="style-grid">
          <card-style-card
            v-for="s in filtered"
            :key="s.id"
            :style="s"
            @open="handleOpen(s.id)"
            @edit="handleEdit(s.id)"
            @delete="handleDelete(s.id)"
          />
        </div>
      </template>
      <t-empty
        v-else
        title="暂无卡片风格"
        description="点击上方新建，或直接使用内置预设"
        class="style-section__empty"
      />
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { AddIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { useCardStyleStore } from '@/windows/main/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import CardStyleCard from './components/CardStyleCard.vue'
import { openCardStyleDetail } from './modals/CardStyleDetailDrawer'
import { openCardStylePut } from './modals/CardStylePutDrawer'

defineOptions({ name: 'DesignCardPage' })
const store = useCardStyleStore()

const keyword = ref('')

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return store.all
  return store.all.filter(
    (s) =>
      s.name.toLowerCase().includes(text) ||
      s.description.toLowerCase().includes(text) ||
      s.tags.some((t) => t.toLowerCase().includes(text))
  )
})

const handleAdd = () => openCardStylePut()
const handleOpen = (id: string) => openCardStyleDetail(id)

const handleEdit = (id: string) => openCardStylePut(id)

const handleDelete = async (id: string) => {
  const s = store.getById(id)
  if (!s) return
  try {
    await MessageBoxUtil.confirm(`确认删除卡片风格「${s.name}」？删除后不可恢复`, '删除风格')
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
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 16px 0;
    padding: 0 24px;
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
  padding: 0 24px 32px;
}
</style>
