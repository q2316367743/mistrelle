import { DialogPlugin } from 'tdesign-vue-next'
import type { ToolFunction, ToolProperty } from '@/domain'

const PropertyRow = ({ name, prop, required }: { name: string; prop: ToolProperty; required: boolean }) => (
  <tr>
    <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--td-component-stroke)', fontSize: '13px' }}>
      <span style={{ color: 'var(--td-text-color-primary)' }}>{name}</span>
      {required && <span style={{ color: 'var(--td-error-color)', marginLeft: '4px' }}>*</span>}
    </td>
    <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--td-component-stroke)', fontSize: '13px', color: 'var(--td-text-color-placeholder)', fontFamily: 'var(--td-font-family-mono, monospace)' }}>
      {prop.type}{prop.items ? `[]` : ''}
    </td>
    <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--td-component-stroke)', fontSize: '13px', color: 'var(--td-text-color-secondary)' }}>
      {prop.description || '-'}
    </td>
  </tr>
)

const ParametersSection = ({ params }: { params: ToolFunction['parameters'] }) => {
  const entries = Object.entries(params.properties ?? {})
  if (entries.length === 0) return <div style={{ color: 'var(--td-text-color-placeholder)', fontSize: '13px' }}>无参数</div>

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
      <thead>
        <tr style={{ background: 'var(--td-bg-color-secondary)' }}>
          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--td-text-color-primary)', borderBottom: '1px solid var(--td-component-stroke)' }}>参数名</th>
          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--td-text-color-primary)', borderBottom: '1px solid var(--td-component-stroke)' }}>类型</th>
          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--td-text-color-primary)', borderBottom: '1px solid var(--td-component-stroke)' }}>描述</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([name, prop]) => (
          <PropertyRow key={name} name={name} prop={prop} required={params.required?.includes(name) ?? false} />
        ))}
      </tbody>
    </table>
  )
}

export const openToolDetailDialog = (tool: ToolFunction) => {
  const dp = DialogPlugin({
    header: () => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{tool.label}</span>
        {tool.risk && tool.risk !== 'safe' && (
          <span style={{
            display: 'inline-block',
            padding: '0 8px',
            fontSize: '12px',
            lineHeight: '22px',
            borderRadius: '4px',
            color: tool.risk === 'dangerous' ? 'var(--td-error-color)' : 'var(--td-warning-color)',
            background: 'var(--td-bg-color-container-hover)',
            border: `1px solid ${tool.risk === 'dangerous' ? 'var(--td-error-color)' : 'var(--td-warning-color)'}`,
          }}>{tool.risk === 'dangerous' ? '高危' : '需审批'}</span>
        )}
      </div>
    ),
    placement: 'center',
    width: '560px',
    footer: false,
    default: () => (
      <div>
        <div style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--td-text-color-secondary)', marginBottom: '20px' }}>
          {tool.description}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--td-text-color-primary)', marginBottom: '4px' }}>参数</div>
          <ParametersSection params={tool.parameters} />
        </div>
      </div>
    ),
    onClose: () => dp.destroy(),
  })
}
