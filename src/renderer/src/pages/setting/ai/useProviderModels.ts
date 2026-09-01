/**
 * 自定义供应商「模型管理」操作集合（AI 设置页）：
 * 手动添加 / 编辑 / 删除 / 启用切换 / 从接口获取导入。
 * 操作经 onSaved 回调落盘（由调用方注入 handleSave）。
 */
import type { AiModel, AiProvideFormat } from '@/entity'
import { listAiModels } from '@/modules/ai'
import { MessageUtil } from '@/utils/modal'
import { guessModelParams, guessModelType } from '@/utils/aiModel'
import { openModelDialog } from './modals/OpenModelDialog'
import { fetchModelsDrawer } from './modals/FetchModelsDrawer'

export interface UseProviderModelsOptions {
  /** 当前表单 models（可变引用，操作直接修改） */
  models: AiModel[]
  /** 表单内联方法（保存后刷新选中态） */
  onSaved: () => Promise<void>
}

export function useProviderModels(options: UseProviderModelsOptions) {
  const fetching = ref(false)

  const addModel = (): void => {
    openModelDialog(
      options.models.map((m) => m.identifier),
      async (result) => {
        options.models.push({
          identifier: result.identifier,
          model: result.name,
          type: result.type,
          context: result.context,
          output: result.output,
          support: result.support,
          enable: true
        })
        await options.onSaved()
        MessageUtil.success('模型已添加')
      }
    )
  }

  const editModel = (model: AiModel): void => {
    openModelDialog(
      options.models.map((m) => m.identifier),
      async (result) => {
        const target = options.models.find((m) => m.identifier === model.identifier)
        if (target) {
          target.model = result.name
          target.type = result.type
          target.context = result.context
          target.output = result.output
          target.support = result.support
        }
        await options.onSaved()
        MessageUtil.success('模型已更新')
      },
      model
    )
  }

  const deleteModel = async (row: AiModel): Promise<void> => {
    const index = options.models.findIndex((m) => m.identifier === row.identifier)
    if (index > -1) {
      options.models.splice(index, 1)
      await options.onSaved()
    }
  }

  const toggleModel = async (row: AiModel, val: boolean): Promise<void> => {
    const model = options.models.find((m) => m.identifier === row.identifier)
    if (model) {
      model.enable = val
      await options.onSaved()
    }
  }

  const fetchModels = async (params: {
    baseUrl: string
    key: string
    format: AiProvideFormat
  }): Promise<void> => {
    if (!params.baseUrl || !params.key) {
      MessageUtil.warning('请先填写接口地址和密钥')
      return
    }
    fetching.value = true
    try {
      const fetched = (
        await listAiModels({
          baseURL: params.baseUrl,
          apiKey: params.key,
          format: params.format
        })
      ).map((m) => ({
        id: m.id,
        name: m.id
      }))
      fetchModelsDrawer(fetched, options.models, async (selectedIds: string[]) => {
        options.models.length = 0
        for (const m of fetched) {
          options.models.push({
            identifier: m.id,
            model: m.name,
            type: guessModelType(m.id),
            ...guessModelParams(m.id),
            enable: selectedIds.includes(m.id)
          })
        }
        await options.onSaved()
        MessageUtil.success('模型已更新')
      })
    } catch (e) {
      MessageUtil.error('获取模型失败: ' + (e as Error).message)
    } finally {
      fetching.value = false
    }
  }

  return {
    fetching,
    addModel,
    editModel,
    deleteModel,
    toggleModel,
    fetchModels
  }
}
