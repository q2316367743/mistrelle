<template>
  <page-layout title="资源管理">
    <div class="asset-page">
      <div class="asset-subtitle">
        <span>统一管理本地资源库（~/.mistrelle/assets），字体可被设计画布直接使用</span>
        <t-tag variant="light" theme="primary" class="subtitle-tag">资源库</t-tag>
      </div>

      <t-tabs v-model="activeTab" placement="top">
        <t-tab-panel value="font" label="字体">
          <div class="font-toolbar">
            <t-button theme="primary" variant="outline" @click="openFolder">
              <template #icon><FolderOpenIcon /></template>
              打开字体目录
            </t-button>
            <t-button theme="primary" @click="addFont">
              <template #icon><AddIcon /></template>
              添加字体
            </t-button>
            <t-button variant="text" @click="reload">
              <template #icon><RefreshIcon /></template>
              刷新
            </t-button>
          </div>

          <t-table
            :data="fonts"
            :columns="columns"
            :loading="loading"
            row-key="name"
            size="medium"
            :pagination="pagination"
            hover
            :table-layout="'fixed'"
          >
            <template #source="{ row }">
              <t-tag :theme="row.source === 'library' ? 'primary' : 'default'" variant="light">
                {{ row.source === 'library' ? '资源库' : '系统' }}
              </t-tag>
            </template>
            <template #op="{ row }">
              <t-button v-if="row.source === 'library'" variant="text" theme="danger" @click="removeFont(row)">
                删除
              </t-button>
            </template>
          </t-table>
        </t-tab-panel>

        <t-tab-panel value="image" label="插图素材">
          <t-empty description="插图素材管理即将上线，敬请期待" />
        </t-tab-panel>
      </t-tabs>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { AddIcon, FolderOpenIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'

const activeTab = ref('font')
const fonts = ref<FontItem[]>([])
const loading = ref(false)

const pagination = {
  defaultCurrent: 1,
  defaultPageSize: 20,
  total: computed(() => fonts.value.length),
  showJumper: true
}

const columns = computed(() => [
  { colKey: 'name', title: '字体名称', ellipsis: true, minWidth: 200 },
  { colKey: 'source', title: '来源', width: 100 },
  { colKey: 'path', title: '文件路径', ellipsis: true, minWidth: 300 },
  { colKey: 'op', title: '操作', width: 90 }
])

const reload = async () => {
  loading.value = true
  try {
    fonts.value = await window.preload.font.listFonts()
  } catch (e) {
    MessageUtil.error('获取字体列表失败', e)
  } finally {
    loading.value = false
  }
}

const openFolder = () => {
  window.preload.inject.shell.showItemInFolder(window.preload.font.getAssetsDir())
}

const addFont = async () => {
  const files = window.preload.inject.dialog.open({
    title: '选择字体文件',
    filters: [{ name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc', 'otc'] }],
    properties: ['openFile', 'multiSelections']
  })
  if (!files?.length) return
  const failed: string[] = []
  for (const file of files) {
    const result = await window.preload.font.addFont(file)
    if ('error' in result && result.error) failed.push(`${file}: ${result.error}`)
  }
  await reload()
  if (failed.length === 0) {
    MessageUtil.success(`已添加 ${files.length} 个字体`)
  } else {
    MessageUtil.error(failed.join('\n'))
  }
}

const removeFont = async (font: FontItem) => {
  const { MessageBoxUtil } = await import('@/utils/modal')
  try {
    await MessageBoxUtil.confirm(`确认删除字体「${font.name}」？`, '删除字体')
  } catch {
    return
  }
  const result = await window.preload.font.removeFont(font.name)
  if ('error' in result && result.error) {
    MessageUtil.error(result.error)
    return
  }
  MessageUtil.success(`已删除「${font.name}」`)
  await reload()
}

onMounted(reload)
</script>

<style scoped lang="less">
.asset-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 16px 16px;
}

.asset-subtitle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--td-text-color-secondary);

  .subtitle-tag {
    flex: none;
  }
}

.font-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
</style>
