import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeInputStyle, nodeLabelStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type { PipelineNode, ExcelExportConfig } from '@/types/pipeline'

/** 导出节点主题色：翠绿 */
const EXPORT_COLOR = '#16a34a'

/** 从 node.data.preview 提取行数 */
function getPreviewRowCount(preview: unknown): number | null {
  if (preview == null) return null
  if (
    typeof preview === 'object' &&
    !Array.isArray(preview) &&
    Array.isArray((preview as any).rows)
  ) {
    return (preview as any).rows.length
  }
  if (Array.isArray(preview)) return preview.length
  return null
}

/**
 * 导出 Excel 节点
 *
 * - 流水线终点，连接上游数据后运行流水线即自动导出 .xlsx 文件
 * - 只有输入 Handle，没有输出 Handle
 * - 支持自定义导出文件名
 * - 运行后展示导出行数
 */
export function ExcelExportNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as ExcelExportConfig) ?? {}
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const rowCount = getPreviewRowCount(data.preview)
  const hasPreview = rowCount != null

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, filename: e.target.value } })
  }

  return (
    <BaseNode
      icon="⤓"
      title="导出 Excel"
      color={EXPORT_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={false}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={nodeLabelStyle}>文件名（可选）</label>
        <input
          type="text"
          value={config.filename ?? ''}
          placeholder="默认取节点标签"
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
            <span style={{ fontWeight: 600 }}>已导出</span>
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
            运行流水线后自动导出 Excel
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default ExcelExportNode