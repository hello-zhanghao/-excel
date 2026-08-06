import React, { useState } from 'react'
import { Handle, Position, useReactFlow } from '@xyflow/react'

/**
 * 节点执行状态
 * - idle:    空闲（灰色）
 * - running: 执行中（蓝色脉动）
 * - success: 成功（绿色）
 * - error:   出错（红色）
 */
export type NodeStatus = 'idle' | 'running' | 'success' | 'error'

export interface BaseNodeProps {
  /** 标题栏左侧图标（emoji 或单字符） */
  icon: string
  /** 节点标题 */
  title: string
  /** 主题色（标题栏底色、Handle 颜色、选中高亮） */
  color: string
  /** 节点执行状态 */
  status?: NodeStatus
  /** 是否被选中（React Flow 注入） */
  selected?: boolean
  /** 是否渲染左侧输入 Handle */
  hasInput?: boolean
  /** 是否渲染右侧输出 Handle */
  hasOutput?: boolean
  /**
   * 多输入 Handle 配置（覆盖 hasInput）。
   * 每项渲染一个带标签的左侧 Handle，用于 join/union 等多输入节点。
   */
  inputLabels?: { id: string; label: string }[]
  /** 节点子内容（配置表单） */
  children?: React.ReactNode
  /** 紧凑模式下显示的摘要信息（如行数、数据集名） */
  summary?: React.ReactNode
  /** 节点 id，用于在弹窗中提供删除操作 */
  nodeId?: string
}

/** 状态颜色映射 */
const STATUS_COLORS: Record<NodeStatus, string> = {
  idle: '#9ca3af',
  running: '#3b82f6',
  success: '#22c55e',
  error: '#ef4444',
}

/** 注入 running 脉动动画 keyframes */
const PULSE_STYLE_ID = 'pipeline-node-pulse-keyframes'

function injectPulseKeyframes() {
  if (typeof document === 'undefined') return
  if (document.getElementById(PULSE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = PULSE_STYLE_ID
  style.textContent = `
    @keyframes pipeline-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.55); }
      70%  { box-shadow: 0 0 0 7px rgba(59, 130, 246, 0); }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }
  `
  document.head.appendChild(style)
}

injectPulseKeyframes()

// ---------------------------------------------------------------------------
// 各节点共用的内联控件样式
// ---------------------------------------------------------------------------

/** 通用文本输入框样式 */
export const nodeInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 30,
  padding: '4px 8px',
  fontSize: 12,
  color: '#111827',
  background: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
}

/** 下拉选择框样式 */
export const nodeSelectStyle: React.CSSProperties = {
  ...nodeInputStyle,
  cursor: 'pointer',
}

/** 通用按钮样式 */
export const nodeButtonStyle: React.CSSProperties = {
  minHeight: 30,
  padding: '4px 10px',
  fontSize: 12,
  color: '#374151',
  background: '#f9fafb',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  cursor: 'pointer',
}

/** 小尺寸图标按钮 */
export const nodeIconButtonStyle: React.CSSProperties = {
  ...nodeButtonStyle,
  width: 30,
  minWidth: 30,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
}

/** 标签文字样式 */
export const nodeLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#6b7280',
  fontWeight: 500,
}

/** Handle 公共样式 */
const handleStyle: React.CSSProperties = {
  width: 11,
  height: 11,
  border: '2px solid #ffffff',
  background: '#6366f1',
}

/**
 * 通用节点外壳（紧凑 + 弹窗）
 *
 * 默认以「紧凑卡片」形式渲染：只显示标题栏 + 摘要信息。
 * 点击节点时弹出配置面板（Modal），显示完整的 children 表单。
 * 这样画布上的节点保持小巧，细节在需要时展开。
 */
export function BaseNode({
  icon,
  title,
  color,
  status = 'idle',
  selected = false,
  hasInput = false,
  hasOutput = false,
  inputLabels,
  children,
  summary,
  nodeId,
}: BaseNodeProps) {
  const [showModal, setShowModal] = useState(false)
  const { deleteElements } = useReactFlow()
  const statusColor = STATUS_COLORS[status]
  const isRunning = status === 'running'
  const hasMultiInput = inputLabels && inputLabels.length > 0

  /** 删除当前节点（连同接入/接出的连线） */
  const handleDelete = () => {
    if (!nodeId) return
    deleteElements({ nodes: [{ id: nodeId }] })
    setShowModal(false)
  }

  return (
    <>
      <div
        className="pipeline-node"
        onClick={(e) => {
          e.stopPropagation()
          setShowModal(true)
        }}
        style={{
          width: 150,
          background: '#ffffff',
          borderRadius: 10,
          border: `2px solid ${selected ? color : '#e5e7eb'}`,
          boxShadow: selected
            ? `0 0 0 3px ${hexWithAlpha(color, 0.2)}, 0 4px 12px rgba(0,0,0,0.12)`
            : '0 2px 8px rgba(0,0,0,0.08)',
          overflow: 'visible',
          boxSizing: 'border-box',
          cursor: 'pointer',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* 单输入 Handle */}
        {hasInput && !hasMultiInput && (
          <Handle
            type="target"
            position={Position.Left}
            style={{ ...handleStyle, background: color }}
          />
        )}

        {/* 多输入 Handle */}
        {hasMultiInput && inputLabels.map((item, idx) => {
          const topPercent = (100 / (inputLabels.length + 1)) * (idx + 1)
          return (
            <div key={item.id}>
              <Handle
                type="target"
                position={Position.Left}
                id={item.id}
                style={{ ...handleStyle, background: color, top: `${topPercent}%` }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: -28,
                  top: `calc(${topPercent}% - 7px)`,
                  fontSize: 9,
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {item.label}
              </span>
            </div>
          )
        })}

        {/* 标题栏：图标 + 标题 + 状态 */}
        <div
          className="pipeline-node-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            background: color,
            color: '#ffffff',
            borderRadius: '10px 10px 0 0',
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
          <span
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          <span
            title={status}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor,
              boxShadow: isRunning ? `0 0 4px 1px ${statusColor}` : 'none',
              animation: isRunning ? 'pipeline-pulse 1.2s infinite' : 'none',
              flexShrink: 0,
            }}
          />
        </div>

        {/* 紧凑摘要区 */}
        <div
          className="pipeline-node-body"
          style={{
            padding: '6px 10px 8px',
            minHeight: 18,
            fontSize: 10.5,
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {summary ?? '点击查看配置 ⚙'}
          </span>
        </div>

        {hasOutput && (
          <Handle
            type="source"
            position={Position.Right}
            style={{ ...handleStyle, background: color }}
          />
        )}
      </div>

      {/* 配置弹窗 */}
      {showModal && (
        <div
          className="node-modal-overlay"
          onClick={(e) => {
            e.stopPropagation()
            setShowModal(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="nodrag node-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 340,
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflow: 'auto',
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              border: '1px solid #e5e7eb',
            }}
          >
            {/* 弹窗标题栏 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                background: color,
                color: '#ffffff',
                borderRadius: '12px 12px 0 0',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{title}</span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
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
                }}
              >
                ✕
              </button>
            </div>

            {/* 弹窗内容：完整配置表单 */}
            <div style={{ padding: 12 }}>{children}</div>

            {/* 弹窗底部操作：删除节点 */}
            {nodeId && (
              <div
                className="nodrag"
                style={{
                  padding: '10px 12px',
                  borderTop: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'flex-end',
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
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** 将 #rrggbb 颜色叠加指定透明度，返回 rgba() */
function hexWithAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return `rgba(107, 114, 128, ${alpha})`
  const int = parseInt(m[1], 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default BaseNode