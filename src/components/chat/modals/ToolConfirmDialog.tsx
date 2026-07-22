import { DialogPlugin } from 'tdesign-vue-next'

export const toolConfirmDialog = (
  toolLabel: string,
  toolName: string,
  args: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    const dp = DialogPlugin({
      header: `确认执行工具`,
      body: () => (
        <div>
          <div style={{ color: 'var(--td-text-color-secondary)', marginBottom: '12px' }}>
            AI 希望执行以下操作：
          </div>
          <div
            style={{
              marginBottom: '12px',
              padding: '8px 12px',
              background: 'var(--td-bg-color-container-hover)',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            <span style={{ fontWeight: 600 }}>{toolLabel}</span>
            <span
              style={{
                color: 'var(--td-text-color-placeholder)',
                marginLeft: '8px',
                fontSize: '12px'
              }}
            >
              {toolName}
            </span>
          </div>
          <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
            <t-textarea
              readonly
              value={args}
              autosize={{ minRows: 3, maxRows: 12 }}
              placeholder="无参数"
            />
          </div>
        </div>
      ),
      confirmBtn: '批准执行',
      cancelBtn: '拒绝',
      placement: 'center',
      onConfirm: () => {
        dp.destroy()
        resolve(true)
      },
      onClose: () => {
        dp.destroy()
        resolve(false)
      }
    })
  })
}
