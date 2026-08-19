<template>
  <page-layout :pl="`${l3}px`">
    <template #title>
      <div class="flex gap-8px items-center">
        <t-button theme="default" variant="text" shape="square" class="detail-btn" @click="goList">
          <template #icon><chevron-left-icon /></template>
        </t-button>
        <div>{{ style?.name || '设计风格详情' }}</div>
      </div>
    </template>
    <template #extra>
      <t-button
        v-if="style && !style.isSystem"
        theme="default"
        variant="outline"
        @click="handleEdit"
      >
        <template #icon><EditIcon /></template>
        编辑
      </t-button>
    </template>

    <div v-if="loading" class="detail-loading">
      <t-loading size="large" />
    </div>

    <div v-else-if="style" class="detail">
      <section class="detail-block">
        <div class="detail-block__title">基础信息</div>
        <div class="detail-block__body">
          <div class="detail-basic">
            <div class="detail-basic__name">
              {{ style.name }}
              <t-tag v-if="style.isSystem" theme="primary" variant="light" size="small"
                >内置预设</t-tag
              >
            </div>
            <p class="detail-basic__desc">{{ style.description || '暂无简介' }}</p>
            <div class="detail-basic__meta">
              <t-tag size="small" variant="outline">{{ categoryLabel }}</t-tag>
              <t-tag v-for="t in style.tags" :key="t" size="small" variant="light">{{ t }}</t-tag>
            </div>
          </div>
        </div>
      </section>

      <section class="detail-block">
        <div class="detail-block__title">配色方案</div>
        <div class="detail-block__body">
          <style-palette-block :palette="style.colorPalette" />
        </div>
      </section>

      <section class="detail-block">
        <div class="detail-block__title">字体规范</div>
        <div class="detail-block__body">
          <style-typography-block :typography="style.typography" />
        </div>
      </section>

      <section class="detail-block">
        <div class="detail-block__title">细节规范</div>
        <div class="detail-block__body">
          <style-token-block :tokens="style.tokens" />
        </div>
      </section>

      <section class="detail-block">
        <div class="detail-block__title">视觉提示</div>
        <div class="detail-block__body">
          <div class="detail-prompt">
            <div class="detail-prompt__label">正向风格描述词</div>
            <pre class="detail-prompt__content">{{ style.visualPrompt || '未填写' }}</pre>
          </div>
          <div class="detail-prompt">
            <div class="detail-prompt__label">反向排除词</div>
            <pre class="detail-prompt__content detail-prompt__content--muted">{{
              style.negativePrompt || '未填写'
            }}</pre>
          </div>
        </div>
      </section>

      <section class="detail-block">
        <div class="detail-block__title">布局规则</div>
        <div class="detail-block__body">
          <ul v-if="style.layoutRules.length > 0" class="detail-rules">
            <li v-for="(rule, idx) in style.layoutRules" :key="idx" class="detail-rules__item">
              {{ rule }}
            </li>
          </ul>
          <div v-else class="detail-rules__empty">未设置布局约束</div>
        </div>
      </section>
    </div>

    <div v-else class="detail-empty">
      <t-empty title="设计风格不存在" description="该风格可能已被删除">
        <t-button theme="primary" @click="goList">返回风格列表</t-button>
      </t-empty>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeftIcon, EditIcon } from 'tdesign-icons-vue-next'
import { AiDesignStyle, DESIGN_STYLE_CATEGORY_OPTIONS } from '@/entity'
import { useDesignStyleStore } from '@/store'
import { openDesignStylePut } from '@/pages/design/list/modals/DesignStylePutDialog'
import StylePaletteBlock from './components/StylePaletteBlock.vue'
import StyleTypographyBlock from './components/StyleTypographyBlock.vue'
import StyleTokenBlock from './components/StyleTokenBlock.vue'
import { useTitlePadding } from '@/hooks'

const route = useRoute()
const router = useRouter()
const store = useDesignStyleStore()

const { l3 } = useTitlePadding()

const id = computed(() => String(route.params.id))
const loading = ref(true)
const style = ref<AiDesignStyle>()

const load = async () => {
  loading.value = true
  try {
    style.value = await store.getDetail(id.value)
  } finally {
    loading.value = false
  }
}
load()

const categoryLabel = computed(
  () =>
    DESIGN_STYLE_CATEGORY_OPTIONS.find((o) => o.value === style.value?.category)?.label ??
    style.value?.category ??
    ''
)

const goList = () => router.push('/design/list')

const handleEdit = async () => {
  await openDesignStylePut(id.value)
  // 编辑保存后重新读取（store 详情缓存已更新）
  await load()
}
</script>

<style scoped lang="less">
.detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px;
  max-width: 960px;
}

.detail-block {
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-medium);

  &__title {
    padding: 12px 16px;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    border-bottom: 1px solid var(--td-component-stroke);
  }

  &__body {
    padding: 16px;
  }
}

.detail-basic {
  &__name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__desc {
    margin: 8px 0 12px;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.detail-prompt {
  & + & {
    margin-top: 16px;
  }

  &__label {
    margin-bottom: 8px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }

  &__content {
    margin: 0;
    padding: 12px;
    font: var(--td-font-body-medium);
    line-height: 1.6;
    color: var(--td-text-color-primary);
    background: var(--td-bg-color-component);
    border-radius: var(--td-radius-default);
    white-space: pre-wrap;
    word-break: break-word;

    &--muted {
      color: var(--td-text-color-secondary);
    }
  }
}

.detail-rules {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__item {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
  }

  &__empty {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-placeholder);
  }
}

.detail-loading,
.detail-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}
.detail-btn {
  z-index: 60;
  -webkit-app-region: no-drag;
}
</style>
