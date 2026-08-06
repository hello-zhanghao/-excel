import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeInputStyle, nodeLabelStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type { PipelineNode, OutputConfig } from '@/types/pipeline'

/** 输出节点主题色：石板灰 */
const OUTPUT_COLOR = '#64748b'

/**
 * 从 node.data.preview 中提取行数。
 * preview 可能是：
 * - NodeOutput 形态 { rows: any[], fields: ... }
 * - 直接是行数组 Record<string, any>[]
 * - 其它形态
 */
function getPreviewRowCount(preview: unknown): number | null {
  if (preview == null) return null

  // 形态一：{ rows: [...] }
  if (
    typeof preview === 'object' &&
    !Array.isArray(preview) &&
    Array.isArray((preview as any).rows)
  ) {
    return (preview as any).rows.length
  }

  // 形态二：直接是数组
  if (Array.isArray(preview)) {
    return preview.length
  }

  return null
}

/**
 * 输出节点
 *
 * - 流水线终点，把上游结果透传给可视化层
 * - 只有输入 Handle，没有输出 Handle
 * - 若节点带有预览数据（node.data.preview），展示行数
 * - 支持自定义输出名称（node.data.config.name）
 */
export function OutputNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as OutputConfig) ?? {}
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const rowCount = getPreviewRowCount(data.preview)
  const hasPreview = rowCount != null

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, name: e.target.value } })
  }

  return (
    <BaseNode
      icon="📈"
      title={config.name && config.name.trim() !== '' ? config.name : '输出'}
      color={OUTPUT_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={false}
      nodeId={id}
      summary={hasPreview ? `${rowCount} 行` : '输出到可视化'}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={nodeLabelStyle}>输出名称（可选）</label>
        <input
          type="text"
          value={config.name ?? ''}
          placeholder="输出到可视化"
          onChange={handleNameChange}
          style={nodeInputStyle}
          className="nodrag"
        />

        {hasPreview ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 8px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 6,
              fontSize: 11,
              color: '#047857',
            }}
          >
            <span style={{ fontWeight: 600 }}>预览</span>
            <span>{rowCount} 行</span>
          </div>
        ) : (
          <div
            style={{
              padding: '6px 8px',
              background: '#f3f4f6',
              borderRadius: 6,
              fontSize: 11,
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            输出到可视化
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default OutputNode
