import { DrawerPlugin, Checkbox, CheckboxGroup, Empty } from 'tdesign-vue-next'
import type { AiModel } from '@/entity'

interface ModelGroup {
  family: string
  models: Array<{ id: string; name: string }>
}

function getModelFamily(id: string): string {
  return id.split(/[-_.\d]/).filter(Boolean)[0] || id
}

function groupModels(models: Array<{ id: string; name: string }>): ModelGroup[] {
  const map = new Map<string, Array<{ id: string; name: string }>>()
  for (const m of models) {
    const family = getModelFamily(m.id)
    if (!map.has(family)) map.set(family, [])
    map.get(family)!.push(m)
  }
  return Array.from(map.entries())
    .map(([family, items]) => ({
      family,
      models: items.sort((a, b) => a.id.localeCompare(b.id))
    }))
    .sort((a, b) => a.family.localeCompare(b.family))
}

export const fetchModelsDrawer = (
  fetchedModels: Array<{ id: string; name: string }>,
  existingModels: AiModel[],
  onConfirm: (selectedIds: string[]) => void | Promise<void>
) => {
  const selectedIds = ref<string[]>(existingModels.filter((m) => m.enable).map((m) => m.identifier))
  const groups = groupModels(fetchedModels)

  const dp = DrawerPlugin({
    header: '选择要导入的模型',
    confirmBtn: '导入选中',
    size: '400px',
    onConfirm: async () => {
      await onConfirm(selectedIds.value)
      dp.destroy?.()
      return true
    },
    default: () => (
      <div>
        {fetchedModels.length > 0 ? (
          <>
            <Checkbox
              checked={selectedIds.value.length === fetchedModels.length}
              indeterminate={
                selectedIds.value.length > 0 && selectedIds.value.length < fetchedModels.length
              }
              onChange={(checked) => {
                selectedIds.value = checked ? fetchedModels.map((m) => m.id) : []
              }}
            >
              全选
            </Checkbox>
            <div style="height: 1px; background: var(--td-bg-color-component); margin: 12px 0" />
            {groups.map((group) => (
              <div key={group.family} style="margin-bottom: 12px">
                <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--td-text-color-primary)">
                  {group.family}
                </div>
                <Checkbox
                  checked={group.models.every((m) => selectedIds.value.includes(m.id))}
                  indeterminate={
                    !group.models.every((m) => selectedIds.value.includes(m.id)) &&
                    group.models.some((m) => selectedIds.value.includes(m.id))
                  }
                  onChange={(checked) => {
                    const groupIds = group.models.map((m) => m.id)
                    if (checked) {
                      const toAdd = groupIds.filter((id) => !selectedIds.value.includes(id))
                      selectedIds.value = [...selectedIds.value, ...toAdd]
                    } else {
                      selectedIds.value = selectedIds.value.filter((id) => !groupIds.includes(id))
                    }
                  }}
                >
                  全选
                </Checkbox>
                <div style="margin-top: 4px">
                  <CheckboxGroup v-model={selectedIds.value}>
                    {group.models.map((m) => (
                      <Checkbox
                        key={m.id}
                        value={m.id}
                        label={`${m.id}${m.name ? ' (' + m.name + ')' : ''}`}
                      />
                    ))}
                  </CheckboxGroup>
                </div>
              </div>
            ))}
          </>
        ) : (
          <Empty description="未获取到模型数据" />
        )}
      </div>
    )
  })
}
