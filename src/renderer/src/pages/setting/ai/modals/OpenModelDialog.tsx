import { CheckboxGroup, DialogPlugin, Form, FormItem, Input, InputNumber, RadioGroup } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import { AiModel, AiModelSupport, AiModelSupportOptions, AiModelType, AiModelTypeOptions } from '@/entity'
import { guessModelParams } from '@/utils/aiModel'

export interface AddModelResult {
  identifier: string
  name: string
  type: AiModelType
  context?: number
  output?: number
  support?: AiModelSupport[]
}

export const openModelDialog = (
  existingIdentifiers: string[],
  onConfirm: (result: AddModelResult) => void | Promise<void>,
  editingModel?: AiModel
) => {
  const identifier = ref(editingModel?.identifier ?? '')
  const name = ref(editingModel?.model ?? '')
  const type = ref<AiModelType>(editingModel?.type ?? 'chat')
  const context = ref<number | undefined>(editingModel?.context)
  const output = ref<number | undefined>(editingModel?.output)
  const support = ref<AiModelSupport[]>(editingModel?.support ?? [])
  const isEditing = !!editingModel

  // 输入模型标识后自动按内置表填充 context/output/support（仅当均未手动设置时）
  function onIdentifierChange() {
    if (isEditing || context.value != null || output.value != null) return
    const params = guessModelParams(identifier.value)
    if (params.context != null) context.value = params.context
    if (params.output != null) output.value = params.output
    if (params.support && support.value.length === 0) support.value = [...params.support]
  }

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
        type: type.value,
        context: context.value,
        output: output.value,
        support: support.value.length > 0 ? support.value : undefined
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
              onBlur={onIdentifierChange}
            />
          </FormItem>
          <FormItem label="显示名称" name="name">
            <Input v-model={name.value} placeholder="例如：GPT-4o、DeepSeek Chat" />
          </FormItem>
          <FormItem label="模型类型" name="type">
            <RadioGroup v-model={type.value} options={AiModelTypeOptions} />
          </FormItem>
          <FormItem label="上下文窗口" name="context">
            <InputNumber
              v-model={context.value}
              min={0}
              step={1000}
              placeholder="留空按默认窗口兜底"
              suffix="token"
              theme="normal"
            />
          </FormItem>
          <FormItem label="最大输出" name="output">
            <InputNumber
              v-model={output.value}
              min={0}
              step={1000}
              placeholder="可选"
              suffix="token"
              theme="normal"
            />
          </FormItem>
          <FormItem label="能力" name="support">
            <CheckboxGroup v-model={support.value} options={AiModelSupportOptions} />
          </FormItem>
        </Form>
      </div>
    )
  })
}
