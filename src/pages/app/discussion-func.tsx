import { useAiDiscussionStore, useAiPromptStore } from '@/store'
import { DialogPlugin, Form, FormItem, Input, Select, Textarea, Button } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import { useContextMenu, useSnowflake } from '@/hooks'
import { AddIcon, DeleteIcon, EditIcon, ChevronDownIcon, ChevronRightIcon } from 'tdesign-icons-vue-next'
import { AiDiscussionForm, buildAiDiscussionForm } from '@/entity/ai'

export const openDiscussionPut = async (id?: string) => {
  const { getById, put } = useAiDiscussionStore()
  const old = await getById(id)
  const form = ref<AiDiscussionForm>(old || buildAiDiscussionForm())
  const expandedRoles = ref<number[]>([])
  const summaryExpanded = ref(old?.summaryRole !== undefined)

  const toggleRoleExpand = (index: number) => {
    const idx = expandedRoles.value.indexOf(index)
    if (idx > -1) {
      expandedRoles.value.splice(idx, 1)
    } else {
      expandedRoles.value.push(index)
    }
  }

  const addRole = () => {
    form.value.roles.push({
      id: useSnowflake().nextId(),
      name: '',
      description: '',
      prompt: '',
      model: '',
      index: form.value.roles.length,
    })
    expandedRoles.value.push(form.value.roles.length - 1)
  }

  const removeRole = (index: number) => {
    form.value.roles.splice(index, 1)
    form.value.roles.forEach((r, i) => { r.index = i })
    const idx = expandedRoles.value.indexOf(index)
    if (idx > -1) expandedRoles.value.splice(idx, 1)
  }

  const dp = DialogPlugin({
    header: (old ? '修改' : '新增') + '分组',
    placement: 'center',
    width: '80vw',
    onConfirm: () => {
      if (!summaryExpanded.value) form.value.summaryRole = undefined
      put(form.value, id)
        .then(() => {
          MessageUtil.success('保存成功')
          dp.destroy()
        })
        .catch((e) => {
          MessageUtil.error('保存失败', e)
        })
    },
    default: () => {
      const promptStore = useAiPromptStore()
      const promptOptions = computed(() => promptStore.state.map(p => ({ label: p.name, value: p.id })))
      const modeOptions = [
        { label: '自动推进', value: 'auto' },
        { label: '手动推进', value: 'manual' },
        { label: '限制轮数', value: 'rounds_limit' },
      ]
      const orderOptions = [
        { label: '顺序发言', value: 'sequential' },
        { label: '随机发言', value: 'random' },
        { label: '并行发言', value: 'parallel' },
      ]
      const summaryTriggerOptions = [
        { label: '每轮结束后', value: 'after_each_round' },
        { label: '所有轮结束后', value: 'after_all_rounds' },
        { label: '手动触发', value: 'manual' },
      ]

      return (
        <div style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}>
          <Form data={form.value}>
            <FormItem label={'分组名称'} name={'name'}>
              <Input v-model={form.value.name} placeholder={'请输入分组名称'} />
            </FormItem>
            <FormItem label={'分组描述'} name={'description'}>
              <Textarea
                v-model={form.value.description}
                placeholder={'请输入分组描述'}
                autosize={{ minRows: 2, maxRows: 4 }}
              />
            </FormItem>

            <FormItem label={'讨论模式'} name={'mode'}>
              <Select v-model={form.value.mode} options={modeOptions} />
            </FormItem>
            {form.value.mode === 'rounds_limit' && (
              <FormItem label={'最大轮数'} name={'maxRounds'}>
                <Input v-model={form.value.maxRounds} type={'number'} />
              </FormItem>
            )}
            <FormItem label={'发言顺序'} name={'orderType'}>
              <Select v-model={form.value.orderType} options={orderOptions} />
            </FormItem>
            <FormItem label={'总结触发'} name={'summaryTrigger'}>
              <Select v-model={form.value.summaryTrigger} options={summaryTriggerOptions} />
            </FormItem>

            <div style={{ marginTop: '16px' }}>
              <div
                style={{
                  marginBottom: '8px',
                  fontSize: '14px',
                  color: 'var(--td-text-color-primary)'
                }}
              >
                参与者角色
              </div>
              <Button icon={() => <AddIcon />} variant={'outline'} onClick={addRole}>
                添加角色
              </Button>
              {form.value.roles.map((role, index) => (
                <div
                  key={role.id}
                  style={{
                    border: '1px solid var(--td-border-level-2-color)',
                    borderRadius: 'var(--td-radius-default)',
                    padding: '8px 12px',
                    marginTop: '8px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleRoleExpand(index)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {expandedRoles.value.includes(index) ? (
                        <ChevronDownIcon />
                      ) : (
                        <ChevronRightIcon />
                      )}
                      <span>{role.name || `角色 ${index + 1}`}</span>
                    </div>
                    <Button
                      theme={'danger'}
                      variant={'text'}
                      shape={'square'}
                      icon={() => <DeleteIcon />}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation()
                        removeRole(index)
                      }}
                    />
                  </div>
                  {expandedRoles.value.includes(index) && (
                    <div
                      style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--td-border-level-2-color)'
                      }}
                    >
                      <div style={{ marginBottom: '12px' }}>
                        <div
                          style={{
                            marginBottom: '4px',
                            fontSize: '14px',
                            color: 'var(--td-text-color-secondary)'
                          }}
                        >
                          选择提示词
                        </div>
                        <Select
                          v-model={role.promptId}
                          options={promptOptions.value}
                          placeholder={'请选择提示词'}
                          clearable={true}
                          onChange={(value) => {
                            if (value) {
                              promptStore.getById(value as string).then(p => {
                                if (p) {
                                  role.name = p.name
                                  role.description = p.description
                                  role.prompt = p.prompt
                                  role.model = p.model
                                }
                              })
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '16px' }}>
              <div
                style={{
                  marginBottom: '8px',
                  fontSize: '14px',
                  color: 'var(--td-text-color-primary)'
                }}
              >
                总结者角色
              </div>
              {form.value.summaryRole ? (
                <div
                  style={{
                    border: '1px solid var(--td-border-level-2-color)',
                    borderRadius: 'var(--td-radius-default)',
                    padding: '8px 12px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      summaryExpanded.value = !summaryExpanded.value
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {summaryExpanded.value ? <ChevronDownIcon /> : <ChevronRightIcon />}
                      <span>{form.value.summaryRole.name || '总结者'}</span>
                    </div>
                    <Button
                      theme={'danger'}
                      variant={'text'}
                      shape={'square'}
                      icon={() => <DeleteIcon />}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation()
                        form.value.summaryRole = undefined
                        summaryExpanded.value = false
                      }}
                    />
                  </div>
                  {summaryExpanded.value && (
                    <div
                      style={{
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--td-border-level-2-color)'
                      }}
                    >
                      <div style={{ marginBottom: '12px' }}>
                        <div
                          style={{
                            marginBottom: '4px',
                            fontSize: '14px',
                            color: 'var(--td-text-color-secondary)'
                          }}
                        >
                          选择提示词
                        </div>
                        <Select
                          v-model={form.value.summaryRole.promptId}
                          options={promptOptions.value}
                          placeholder={'请选择提示词'}
                          clearable={true}
                          onChange={(value) => {
                            if (value) {
                              promptStore.getById(value as string).then(p => {
                                if (p) {
                                  form.value.summaryRole!.name = p.name
                                  form.value.summaryRole!.description = p.description
                                  form.value.summaryRole!.prompt = p.prompt
                                  form.value.summaryRole!.model = p.model
                                }
                              })
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  icon={() => <AddIcon />}
                  variant={'outline'}
                  onClick={() => {
                    form.value.summaryRole = {
                      id: useSnowflake().nextId(),
                      name: '',
                      description: '',
                      prompt: '',
                      model: '',
                      index: -1
                    }
                    summaryExpanded.value = true
                  }}
                >
                  添加总结者角色
                </Button>
              )}
            </div>
          </Form>
        </div>
      )
    }
  })
}

export const openDiscussionContextmenu = (e: MouseEvent, id: string) => {
  useContextMenu(e, {
    items: [
      {
        icon: () => <EditIcon />,
        label: '编辑',
        onClick: () => openDiscussionPut(id)
      },
      {
        icon: () => <DeleteIcon class={'color-red'} />,
        label: <span class={'color-red'}>删除</span>,
        onClick: () => {}
      }
    ]
  })
}
