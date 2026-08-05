import React from 'react'
import { Handle, Position } from '@xyflow/react'

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
   * id 用作 React Flow Handle 的 id，label 显示在节点左侧。
   */
  inputLabels?: { id: string; label: string }[]
  /** 节点子内容 */
  children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// 状态颜色映射
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<NodeStatus, string> = {
  idle: '#9ca3af',
  running: '#3b82f6',
  success: '#22c55e',
  error: '#ef4444',
}

// ---------------------------------------------------------------------------
// 注入 running 脉动动画的 keyframes（仅注入一次）
// pipeline CSS 尚未引入时也能保证“执行中”状态的视觉反馈
// ---------------------------------------------------------------------------

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
// 各节点共用的内联控件样式 —— 保证可点击区域足够大
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

/** 小尺寸图标按钮（如删除一行） */
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

// ---------------------------------------------------------------------------
// Handle 公共样式
// ---------------------------------------------------------------------------

const handleStyle: React.CSSProperties = {
  width: 11,
  height: 11,
  border: '2px solid #ffffff',
  background: '#6366f1',
}

// ---------------------------------------------------------------------------
// 通用节点外壳
// ---------------------------------------------------------------------------

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
}: BaseNodeProps) {
  const statusColor = STATUS_COLORS[status]
  const isRunning = status === 'running'
  const hasMultiInput = inputLabels && inputLabels.length > 0

  return (
    <div
      className="pipeline-node"
      style={{
        width: 220,
        background: '#ffffff',
        borderRadius: 10,
        border: `2px solid ${selected ? color : '#e5e7eb'}`,
        boxShadow: selected
          ? `0 0 0 3px ${hexWithAlpha(color, 0.2)}, 0 4px 12px rgba(0,0,0,0.12)`
          : '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'visible',
        boxSizing: 'border-box',
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

      {/* 多输入 Handle：左表 / 右表 */}
      {hasMultiInput && inputLabels.map((item, idx) => {
        const topPercent = (100 / (inputLabels.length + 1)) * (idx + 1)
        return (
          <div key={item.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={item.id}
              style={{
                ...handleStyle,
                background: color,
                top: `${topPercent}%`,
              }}
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

      {/* 标题栏：图标 + 标题 + 状态指示器 */}
      <div
        className="pipeline-node-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: color,
          color: '#ffffff',
          borderRadius: '10px 10px 0 0',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        <span
          style={{
            flex: 1,
            fontSize: 13,
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
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: isRunning ? `0 0 4px 1px ${statusColor}` : 'none',
            animation: isRunning ? 'pipeline-pulse 1.2s infinite' : 'none',
            flexShrink: 0,
          }}
        />
      </div>

      {/* 子内容区域 */}
      <div className="pipeline-node-body" style={{ padding: 10 }}>
        {children}
      </div>

      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ ...handleStyle, background: color }}
        />
      )}
    </div>
  )
}

/**
 * 将 #rrggbb 颜色叠加指定透明度，返回 rgba() 字符串。
 * 输入非法时回退到灰色。
 */
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
