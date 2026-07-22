import { DrawerPlugin, Form, FormItem, InputNumber, RadioGroup, Select } from 'tdesign-vue-next'
import type { AiDiscussionRole, AiDiscussionSessionConfig } from '@/entity/ai'

interface DiscussionSettingsDrawerOptions {
  /** 讨论组名称，用于标题展示 */
  title?: string
  /** 可选的总结者角色（来自讨论组配置） */
  summaryRole?: AiDiscussionRole
  /** 打开时的初始配置 */
  initial: AiDiscussionSessionConfig
  /** 确认时回调，接收编辑后的配置副本 */
  onApply: (config: AiDiscussionSessionConfig) => void | Promise<void>
}

const afterRoundOptions = [
  { label: '自动进入下一轮', value: 'auto' },
  { label: '等我补充后再继续', value: 'wait_input' },
  { label: '自动总结并结束', value: 'summarize' }
]

const orderOptions = [
  { label: '轮流发言', value: 'sequential' },
  { label: '随机发言', value: 'random' },
  { label: '并行发言', value: 'parallel' }
]

/**
 * 讨论设置抽屉。
 * 创建讨论前可通过「高级」打开以覆盖默认配置；讨论进行中可随时打开调整当前会话配置。
 */
export const openDiscussionSettingsDrawer = (options: DiscussionSettingsDrawerOptions) => {
  const { initial, summaryRole, onApply } = options
  // 编辑副本，避免直接修改外部状态，确认后才回写
  const config = ref<AiDiscussionSessionConfig>({
    ...initial,
    summaryRole: initial.summaryRole ?? summaryRole
  })
  // 总结者至多来自讨论组配置的一个角色，用 id 作为选择值再映射回对象
  const summaryRoleId = computed<string | undefined>({
    get: () => config.value.summaryRole?.id,
    set: (value) => {
      config.value.summaryRole = value && summaryRole ? { ...summaryRole } : undefined
    }
  })

  const dp = DrawerPlugin({
    header: options.title ? `讨论设置 · ${options.title}` : '讨论设置',
    confirmBtn: '应用',
    cancelBtn: '取消',
    size: '420px',
    onConfirm: async () => {
      await onApply({ ...config.value })
      dp.destroy?.()
      return true
    },
    default: () => (
      <Form labelAlign={'top'}>
        <FormItem label={'总轮数'} help={'设为 0 表示无限轮数，直到手动停止'}>
          <InputNumber
            v-model={config.value.maxRounds}
            min={0}
            step={1}
            theme={'normal'}
            style={{ width: '100%' }}
          />
        </FormItem>
        <FormItem label={'每轮结束后'}>
          <RadioGroup v-model={config.value.afterRound} options={afterRoundOptions} />
        </FormItem>
        <FormItem label={'发言顺序'}>
          <Select v-model={config.value.orderType} options={orderOptions} />
        </FormItem>
        <FormItem label={'总结者'} help={summaryRole ? undefined : '当前讨论组未配置总结者'}>
          <Select
            v-model={summaryRoleId.value}
            options={
              summaryRole ? [{ label: summaryRole.name || '总结者', value: summaryRole.id }] : []
            }
            placeholder={'不总结'}
            clearable={true}
          />
        </FormItem>
      </Form>
    )
  })
}
