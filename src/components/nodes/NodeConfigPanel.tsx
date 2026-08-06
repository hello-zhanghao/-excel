import { useEffect } from 'react'
import { useStore as useFlowStore, useReactFlow } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useNodeConfig } from './NodeConfigContext'
import type { NodeStatus } from './BaseNode'

/**
 * 节点配置面板（右侧固定窗口）
 *
 * 显示当前选中节点的配置表单。点击画布上的节点 → 打开面板；
 * 点击关闭按钮 / 删除节点 → 关闭面板。
 * 支持折叠为窄条（点击展开）与拖拽调整宽度。
 */
interface NodeConfigPanelProps {
  /** 展开时的面板宽度 */
  width?: number
  /** 是否折叠为窄条 */
  collapsed?: boolean
  /** 切换折叠状态 */
  onToggleCollapsed?: () => void
  /** 分隔条 mousedown（拖拽调整宽度） */
  onResizeStart?: (e: React.MouseEvent) => void
  /** 是否正在拖拽调整大小（用于高亮分隔条） */
  resizing?: boolean
}

export function NodeConfigPanel({
  width = 360,
  collapsed = false,
  onToggleCollapsed,
  onResizeStart,
  resizing = false,
}: NodeConfigPanelProps) {
  const { selectedNodeId, selectNode, getRegistered } = useNodeConfig()
  const nodes = useFlowStore((s) => s.nodes) as Node[]
  const { deleteElements } = useReactFlow()

  const info = getRegistered(selectedNodeId)
  const nodeExists = selectedNodeId ? nodes.some((n) => n.id === selectedNodeId) : false

  // 节点被删除时自动关闭面板
  useEffect(() => {
    if (selectedNodeId && !nodeExists) {
      selectNode(null)
    }
  }, [selectedNodeId, nodeExists, selectNode])

  if (!selectedNodeId || !info || !nodeExists) {
    return null
  }

  const status = (nodes.find((n) => n.id === selectedNodeId)?.data as any)?.status as
    | NodeStatus
    | undefined

  const handleDelete = () => {
    deleteElements({ nodes: [{ id: selectedNodeId }] })
    selectNode(null)
  }

  return (
    <aside className="node-config-panel" style={{ width: collapsed ? 36 : width }}>
      {collapsed ? (
        <div
          className="panel-collapsed-v"
          onClick={onToggleCollapsed}
          title="展开配置面板"
        >
          <span className="panel-icon">{info.icon}</span>
          <button className="panel-collapse-btn" type="button">
            «
          </button>
        </div>
      ) : (
        <>
          {/* 左边缘分隔条（拖拽调整宽度） */}
          <div
            className={`panel-divider panel-divider-v${resizing ? ' active' : ''}`}
            onMouseDown={onResizeStart}
            title="拖拽调整面板宽度"
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }}
          />

          {/* 标题栏 */}
          <div
            className="node-config-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 14px',
              background: info.color,
              color: '#ffffff',
              borderRadius: '0 0 0 0',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{info.icon}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {info.title}
            </span>
            {status && (
              <span
                title={status}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: status === 'success' ? '#22c55e' : status === 'error' ? '#ef4444' : status === 'running' ? '#ffffff' : 'rgba(255,255,255,0.7)',
                  boxShadow: status === 'running' ? '0 0 4px 1px rgba(255,255,255,0.8)' : 'none',
                  flexShrink: 0,
                }}
              />
            )}
            <button
              type="button"
              onClick={onToggleCollapsed}
              title="收起面板"
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                borderRadius: 6,
                width: 24,
                height: 24,
                fontSize: 13,
                lineHeight: 1,
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              »
            </button>
            <button
              type="button"
              onClick={() => selectNode(null)}
              title="关闭配置面板"
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                borderRadius: 6,
                width: 24,
                height: 24,
                fontSize: 14,
                lineHeight: 1,
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* 配置表单 */}
          <div
            className="node-config-body"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 14,
            }}
          >
            {info.renderForm()}
          </div>

          {/* 底部操作：删除节点 */}
          <div
            className="node-config-footer"
            style={{
              padding: '10px 14px',
              borderTop: '1px solid #eee',
              display: 'flex',
              justifyContent: 'flex-end',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={handleDelete}
              style={{
                border: '1px solid #ef4444',
                background: '#ffffff',
                color: '#ef4444',
                borderRadius: 6,
                padding: '5px 14px',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff'
                e.currentTarget.style.color = '#ef4444'
              }}
            >
              🗑 删除此节点
            </button>
          </div>
        </>
      )}
    </aside>
  )
}

export default NodeConfigPanel
