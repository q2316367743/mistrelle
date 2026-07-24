import { ref } from 'vue'
import {
  DialogPlugin,
  Form,
  FormItem,
  Input,
  RadioGroup,
  RadioButton,
  Switch,
  Button
} from 'tdesign-vue-next'
import { AddIcon, DeleteIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import { useAiToolStore } from '@/store'
import type { AiTool } from '@/entity/ai'

interface KeyValue {
  key: string
  value: string
}

const toKeyValues = (record?: Record<string, string>): KeyValue[] =>
  record ? Object.entries(record).map(([key, value]) => ({ key, value })) : []

const toRecord = (items: KeyValue[]): Record<string, string> | undefined => {
  const filtered = items.filter((e) => e.key.trim())
  return filtered.length > 0
    ? Object.fromEntries(filtered.map((e) => [e.key.trim(), e.value]))
    : undefined
}

/** 渲染键值对编辑器（环境变量 / 请求头） */
const renderKeyValues = (items: KeyValue[], onUpdate: (next: KeyValue[]) => void) => (
  <div>
    {items.map((item, index) => (
      <div
        key={index}
        style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}
      >
        <Input v-model={items[index].key} placeholder="KEY" style={{ flex: 1 }} />
        <Input v-model={items[index].value} placeholder="VALUE" style={{ flex: 1 }} />
        <Button
          theme="danger"
          variant="text"
          size="small"
          shape="square"
          onClick={() => onUpdate(items.filter((_, i) => i !== index))}
        >
          <DeleteIcon />
        </Button>
      </div>
    ))}
    <Button
      size="small"
      variant="dashed"
      onClick={() => onUpdate([...items, { key: '', value: '' }])}
      icon={() => <AddIcon />}
    >
      添加
    </Button>
  </div>
)

/**
 * 打开 MCP 服务器添加 / 编辑弹窗。
 * @param onSuccess 保存成功后的回调
 * @param existing 传入已有配置则为编辑模式
 */
export const openMcpServerDialog = (onSuccess: () => void, existing?: AiTool) => {
  const store = useAiToolStore()
  const isEdit = !!existing

  const form = ref({
    name: existing?.name ?? '',
    type: (existing?.type ?? 'local') as 'local' | 'remote',
    command: existing?.type === 'local' ? existing.command.join(' ') : '',
    url: existing?.type === 'remote' ? existing.url : '',
    env: toKeyValues(existing?.type === 'local' ? existing.env : undefined),
    headers: toKeyValues(existing?.type === 'remote' ? existing.headers : undefined),
    enabled: existing?.enabled ?? true
  })

  const dp = DialogPlugin({
    header: isEdit ? '编辑 MCP 服务器' : '添加 MCP 服务器',
    placement: 'center',
    width: '520px',
    confirmBtn: isEdit ? '保存' : '添加',
    onConfirm: async () => {
      const name = form.value.name.trim()
      if (!name) {
        MessageUtil.warning('请输入服务器名称')
        return false
      }
      if (!isEdit && store.state.some((t) => t.name === name)) {
        MessageUtil.warning('名称已存在')
        return false
      }
      if (form.value.type === 'local' && !form.value.command.trim()) {
        MessageUtil.warning('请输入启动命令')
        return false
      }
      if (form.value.type === 'remote' && !form.value.url.trim()) {
        MessageUtil.warning('请输入服务地址')
        return false
      }

      const tool: AiTool =
        form.value.type === 'local'
          ? {
              name,
              type: 'local',
              enabled: form.value.enabled,
              command: form.value.command.trim().split(/\s+/),
              env: toRecord(form.value.env)
            }
          : {
              name,
              type: 'remote',
              enabled: form.value.enabled,
              url: form.value.url.trim(),
              headers: toRecord(form.value.headers)
            }

      dp.update({ confirmLoading: true })
      try {
        if (isEdit) {
          store.update(tool)
          if (tool.enabled) await store.connect(name)
          else await store.disconnect(name)
        } else {
          store.add(tool)
          if (tool.enabled) await store.connect(name)
        }
        MessageUtil.success(isEdit ? '保存成功' : '添加成功')
        dp.destroy()
        onSuccess()
      } catch (e) {
        MessageUtil.error(isEdit ? '保存失败' : '添加失败', e)
      } finally {
        dp.update({ confirmLoading: false })
      }
      return false
    },
    default: () => (
      <Form data={form.value} layout="vertical">
        <FormItem label="名称" name="name">
          <Input v-model={form.value.name} placeholder="如 filesystem、github" disabled={isEdit} />
        </FormItem>
        <FormItem label="类型" name="type">
          <RadioGroup v-model={form.value.type} variant="primary-filled">
            <RadioButton value="local">本地 (stdio)</RadioButton>
            <RadioButton value="remote">远程 (HTTP)</RadioButton>
          </RadioGroup>
        </FormItem>
        {form.value.type === 'local' ? (
          <>
            <FormItem label="启动命令" name="command">
              <Input
                v-model={form.value.command}
                placeholder="如 npx -y @modelcontextprotocol/server-filesystem /path"
              />
            </FormItem>
            <FormItem label="环境变量" name="env">
              {renderKeyValues(form.value.env, (next) => (form.value.env = next))}
            </FormItem>
          </>
        ) : (
          <>
            <FormItem label="服务地址" name="url">
              <Input v-model={form.value.url} placeholder="如 http://localhost:3000/mcp" />
            </FormItem>
            <FormItem label="请求头" name="headers">
              {renderKeyValues(form.value.headers, (next) => (form.value.headers = next))}
            </FormItem>
          </>
        )}
        <FormItem label="启用" name="enabled">
          <Switch v-model={form.value.enabled} />
        </FormItem>
      </Form>
    )
  })
}
