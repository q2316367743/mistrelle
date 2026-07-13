import { DialogPlugin, Form, FormItem, Input, RadioGroup } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import { AiModel, AiModelType, AiModelTypeOptions } from '@/entity'

export interface AddModelResult {
  identifier: string
  name: string
  type: AiModelType
}

export const openModelDialog = (
  existingIdentifiers: string[],
  onConfirm: (result: AddModelResult) => void | Promise<void>,
  editingModel?: AiModel
) => {
  const identifier = ref(editingModel?.identifier ?? '')
  const name = ref(editingModel?.model ?? '')
  const type = ref<AiModelType>(editingModel?.type ?? 'chat')
  const isEditing = !!editingModel

  const dp = DialogPlugin({
    header: isEditing ? '编辑模型' : '添加模型',
    confirmBtn: isEditing ? '保存' : '添加',
    placement: 'center',
    onConfirm: async () => {
      if (!identifier.value.trim()) {
        MessageUtil.warning('请输入模型标识')
        return false
      }
      if (!name.value.trim()) {
        MessageUtil.warning('请输入显示名称')
        return false
      }
      if (!isEditing && existingIdentifiers.includes(identifier.value.trim())) {
        MessageUtil.warning('模型标识已存在')
        return false
      }
      await onConfirm({
        identifier: identifier.value.trim(),
        name: name.value.trim(),
        type: type.value
      })
      dp?.destroy()
      return true
    },
    default: () => (
      <div class="px-4px">
        <Form layout="vertical">
          <FormItem label="模型标识" name="identifier">
            <Input
              v-model={identifier.value}
              placeholder="例如：gpt-4o、deepseek-chat"
              disabled={isEditing}
            />
          </FormItem>
          <FormItem label="显示名称" name="name">
            <Input v-model={name.value} placeholder="例如：GPT-4o、DeepSeek Chat" />
          </FormItem>
          <FormItem label="模型类型" name="type">
            <RadioGroup v-model={type.value} options={AiModelTypeOptions} />
          </FormItem>
        </Form>
      </div>
    )
  })
}
