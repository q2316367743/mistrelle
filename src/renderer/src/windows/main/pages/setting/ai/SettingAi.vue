<template>
  <page-layout title="AI 设置">
    <div class="ai-setting-layout">
      <setting-ai-sidebar
        :selected-id="selectedId"
        @add="handleAdd"
        @select="selectItem"
        @enable="handleProvideEnableChange"
        @delete="handleDelete"
      />

      <div class="ai-setting-main">
        <template v-if="!selectedId && !isCreating">
          <t-empty description="请选择一个提供方或新增" />
        </template>
        <builtin-provider-panel
          v-else-if="isBuiltinSelected"
          :name="builtinItem?.name ?? ''"
          :models="builtinModels"
          :refreshing="store.refreshingBuiltin"
          :signed-in="isSignedIn"
          @refresh="handleRefreshBuiltin"
        />
        <provider-editor
          v-else
          :key="selectedId || 'new'"
          :source="editingSource"
          :saving="saving"
          :name-presets="PROVIDER_NAME_PRESETS"
          :provider-presets="PROVIDER_PRESETS"
          :persist="handleSave"
        />
      </div>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { useSettingAiStore, useAuthStore, BUILTIN_PROVIDER_ID } from '@/windows/main/store'
import type { AiProvideFormat } from '@/entity'
import { MessageUtil } from '@/utils/modal'
import { openLogin } from '@/components/modals/LoginDialog'
import { PROVIDER_NAME_PRESETS, PROVIDER_PRESETS } from './providerPresets'
import SettingAiSidebar from './components/SettingAiSidebar.vue'
import BuiltinProviderPanel from './components/BuiltinProviderPanel.vue'
import ProviderEditor, { type ProviderFormData } from './components/ProviderEditor.vue'

const store = useSettingAiStore()
const authStore = useAuthStore()

/** 已登录（登录守卫用） */
const isSignedIn = computed(() => authStore.status === 'signed-in')

const selectedId = ref<string>('')
const isCreating = ref(false)
const saving = ref(false)

const builtinItem = computed(() => store.items.find((i) => i.builtin))
const isBuiltinSelected = computed(() => selectedId.value === BUILTIN_PROVIDER_ID)
const builtinModels = computed(() => builtinItem.value?.models ?? [])

/** 传给编辑器的只读快照；新建为 null */
const editingSource = computed<ProviderFormData | null>(() => {
  if (isCreating.value || !selectedId.value || selectedId.value === BUILTIN_PROVIDER_ID) {
    return null
  }
  const item = store.items.find((i) => i.id === selectedId.value)
  if (!item) return null
  return {
    id: item.id,
    name: item.name,
    baseUrl: item.baseUrl,
    key: item.key,
    models: item.models.map((m) => ({ ...m })),
    format: (item.format || 'chat') as AiProvideFormat
  }
})

function selectItem(id: string) {
  // 点击已选中项：保持选中，不再切到「新建」（新建只走「添加供应商」）
  if (id === selectedId.value) return
  selectedId.value = id
  isCreating.value = false
}

watch(
  () => store.items.length,
  (len) => {
    if (!selectedId.value && !isCreating.value && len > 0) {
      selectItem(store.items[0].id)
    }
  },
  { immediate: true }
)

const router = useRouter()

async function guardLogin(): Promise<boolean> {
  if (isSignedIn.value) return true
  if (authStore.status === 'unknown') {
    await authStore.refresh()
  }
  if (isSignedIn.value) return true
  MessageUtil.warning('请先登录后使用 AI 设置')
  openLogin(
    () => {
      void store.refreshBuiltinModels().catch(() => undefined)
    },
    () => router.push('/new')
  )
  return false
}

onMounted(() => {
  void guardLogin()
})

async function handleRefreshBuiltin() {
  if (!isSignedIn.value) {
    MessageUtil.warning('请先登录后获取内置模型列表')
    return
  }
  try {
    await store.refreshBuiltinModels()
    MessageUtil.success('模型列表已更新')
  } catch (e) {
    MessageUtil.error('获取内置模型失败: ' + (e as Error).message)
  }
}

async function handleSave(payload: ProviderFormData) {
  saving.value = true
  try {
    const wasCreating = isCreating.value || !payload.id
    await store.put({
      id: payload.id || undefined,
      name: payload.name,
      baseUrl: payload.baseUrl,
      key: payload.key,
      models: payload.models,
      format: payload.format,
      enable: payload.id
        ? (store.items.find((item) => item.id === payload.id)?.enable ?? true)
        : true
    })
    if (wasCreating) {
      const added = store.items.find(
        (item) => !item.builtin && item.name === payload.name && item.baseUrl === payload.baseUrl
      )
      if (added) {
        selectedId.value = added.id
        isCreating.value = false
      }
    }
    MessageUtil.success('保存成功')
  } catch (e) {
    MessageUtil.error('保存失败: ' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

function handleAdd() {
  isCreating.value = true
  selectedId.value = ''
}

async function handleProvideEnableChange(id: string, val: boolean) {
  const item = store.items.find((i) => i.id === id)
  if (!item || item.builtin) return
  await store.put({
    id: item.id,
    name: item.name,
    baseUrl: item.baseUrl,
    key: item.key,
    models: item.models,
    format: item.format,
    enable: val
  })
}

async function handleDelete(id: string) {
  await store.remove(id)
  if (selectedId.value === id) {
    if (store.items.length > 0) {
      selectItem(store.items[0].id)
    } else {
      selectedId.value = ''
      isCreating.value = false
    }
  }
}
</script>

<style scoped lang="less">
.ai-setting-layout {
  display: flex;
  height: 100%;
  min-height: 0;
}

.ai-setting-main {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  padding: 0 24px 24px 16px;
  z-index: 1;
}
</style>
