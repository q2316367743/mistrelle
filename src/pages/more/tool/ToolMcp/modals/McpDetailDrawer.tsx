import { DrawerPlugin, Button, Tag, List, ListItem, Loading } from 'tdesign-vue-next'
import { RefreshIcon, EditIcon, DeleteIcon } from 'tdesign-icons-vue-next'
import { MessageUtil, MessageBoxUtil } from '@/utils/modal'
import { useAiToolStore } from '@/store'
import type { McpStatus } from '@/store'
import { openMcpServerDialog } from './McpServerDialog'

const statusMap: Record<
  McpStatus,
  { label: string; theme: 'default' | 'primary' | 'success' | 'danger' }
> = {
  disconnected: { label: '未连接', theme: 'default' },
  connecting: { label: '连接中', theme: 'primary' },
  connected: { label: '已连接', theme: 'success' },
  error: { label: '连接失败', theme: 'danger' }
}

const labelStyle = {
  fontSize: '12px',
  color: 'var(--td-text-color-placeholder)',
  marginBottom: '4px'
} as const

const valueStyle = {
  fontSize: '13px',
  color: 'var(--td-text-color-primary)',
  wordBreak: 'break-all' as const
}

const sectionTitle = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--td-text-color-primary)',
  margin: '20px 0 8px'
} as const

/**
 * 打开 MCP 服务器详情抽屉，展示配置信息、连接状态与工具列表。
 * @param name 服务器名称（AiTool.name）
 * @param onChange 服务器列表变更后的回调（编辑 / 删除时触发）
 */
export const openMcpDetailDrawer = (name: string, onChange?: () => void) => {
  const store = useAiToolStore()

  const dp = DrawerPlugin({
    header: name,
    size: '480px',
    footer: false,
    default: () => {
      const tool = store.state.find((t) => t.name === name)
      if (!tool) return <div>服务器不存在</div>

      const conn = store.connections[name]
      const status = conn?.status ?? 'disconnected'
      const meta = statusMap[status]
      const tools = conn?.tools ?? []

      return (
        <div style={{ padding: '0 4px' }}>
          {/* 状态与操作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Tag theme={meta.theme} variant="light" size="small">
              {status === 'connecting' ? (
                <Loading size="12px" style={{ marginRight: '4px' }} />
              ) : null}
              {meta.label}
            </Tag>
            <Tag variant="light" size="small">
              {tool.type === 'local' ? 'stdio' : 'HTTP'}
            </Tag>
            <div style={{ flex: 1 }} />
            <Button
              size="small"
              variant="outline"
              onClick={async () => {
                await store.connect(name)
                MessageUtil.success('已重新连接')
              }}
              icon={() => <RefreshIcon />}
            >
              重连
            </Button>
            <Button
              size="small"
              variant="outline"
              onClick={() => {
                dp.destroy?.()
                openMcpServerDialog(() => onChange?.(), tool)
              }}
              icon={() => <EditIcon />}
            >
              编辑
            </Button>
            <Button
              size="small"
              theme="danger"
              variant="outline"
              onClick={() => {
                MessageBoxUtil.confirm(`确定删除 MCP 服务器「${name}」？`, '删除确认')
                  .then(async () => {
                    await store.remove(name)
                    MessageUtil.success('已删除')
                    dp.destroy?.()
                    onChange?.()
                  })
                  .catch(() => {})
              }}
              icon={() => <DeleteIcon />}
            >
              删除
            </Button>
          </div>

          {/* 错误信息 */}
          {status === 'error' && conn?.error ? (
            <div
              style={{
                padding: '8px 12px',
                marginBottom: '12px',
                borderRadius: 'var(--td-radius-medium)',
                background: 'var(--td-error-color-light)',
                color: 'var(--td-error-color)',
                fontSize: '13px',
                lineHeight: 1.6
              }}
            >
              {conn.error}
            </div>
          ) : null}

          {/* 配置信息 */}
          <div style={sectionTitle}>配置</div>
          {tool.type === 'local' ? (
            <>
              <div style={labelStyle}>启动命令</div>
              <div
                style={{
                  ...valueStyle,
                  fontFamily: 'var(--td-font-family-mono, monospace)',
                  marginBottom: '12px'
                }}
              >
                {tool.command.join(' ')}
              </div>
              {tool.env && Object.keys(tool.env).length > 0 ? (
                <>
                  <div style={labelStyle}>环境变量</div>
                  <div
                    style={{
                      ...valueStyle,
                      fontFamily: 'var(--td-font-family-mono, monospace)',
                      marginBottom: '12px'
                    }}
                  >
                    {Object.entries(tool.env).map(([k, v]) => (
                      <div key={k}>
                        {k}={v}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
              <div style={labelStyle}>服务地址</div>
              <div
                style={{
                  ...valueStyle,
                  fontFamily: 'var(--td-font-family-mono, monospace)',
                  marginBottom: '12px'
                }}
              >
                {tool.url}
              </div>
              {tool.headers && Object.keys(tool.headers).length > 0 ? (
                <>
                  <div style={labelStyle}>请求头</div>
                  <div
                    style={{
                      ...valueStyle,
                      fontFamily: 'var(--td-font-family-mono, monospace)',
                      marginBottom: '12px'
                    }}
                  >
                    {Object.entries(tool.headers).map(([k, v]) => (
                      <div key={k}>
                        {k}: {v}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}

          {/* 工具列表 */}
          <div style={sectionTitle}>工具（{tools.length}）</div>
          {status === 'connecting' ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Loading size="24px" />
            </div>
          ) : tools.length > 0 ? (
            <List split={true}>
              {tools.map((t) => (
                <ListItem key={t.name}>
                  <div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--td-text-color-primary)'
                      }}
                    >
                      {t.label}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--td-text-color-secondary)',
                        marginTop: '2px',
                        lineHeight: 1.5
                      }}
                    >
                      {t.description || '暂无描述'}
                    </div>
                  </div>
                </ListItem>
              ))}
            </List>
          ) : (
            <div
              style={{
                color: 'var(--td-text-color-placeholder)',
                fontSize: '13px',
                padding: '12px 0'
              }}
            >
              {status === 'connected' ? '该服务器未提供工具' : '连接后可查看工具列表'}
            </div>
          )}
        </div>
      )
    }
  })
}
