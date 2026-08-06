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

/** 从 node.data.preview 提取多 sheet 摘要（{ name, rowCount }[]），无则返回 null */
function getPreviewSheets(preview: unknown): { name: string; rowCount: number }[] | null {
  if (preview == null || typeof preview !== 'object') return null
  const sheets = (preview as any).sheets
  if (Array.isArray(sheets) && sheets.length > 0) {
    return sheets.map((s) => ({
      name: String(s?.name ?? 'Sheet'),
      rowCount: Number(s?.rowCount ?? 0),
    }))
  }
  return null
}

/**
 * 导出 Excel 节点
 *
 * - 流水线终点，连接上游数据后运行流水线即自动导出 .xlsx 文件
 * - 支持多个上游同时接入：每路数据导出为工作簿中的一个 sheet
 * - 只有输入 Handle，没有输出 Handle
 * - 支持自定义导出文件名
 * - 运行后展示每个 sheet 的导出情况
 */
export function ExcelExportNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as ExcelExportConfig) ?? {}
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const rowCount = getPreviewRowCount(data.preview)
  const hasPreview = rowCount != null
  const sheets = getPreviewSheets(data.preview)

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
      nodeId={id}
      summary={
        sheets && sheets.length > 0
          ? `${sheets.length} 个表 · ${rowCount ?? 0} 行`
          : hasPreview
            ? `${rowCount} 行`
            : '导出 Excel'
      }
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              padding: '6px 8px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 6,
              fontSize: 11,
              color: '#047857',
              lineHeight: 1.6,
            }}
          >
            {sheets && sheets.length > 1 ? (
              <>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  已导出 {sheets.length} 个 sheet · 共 {rowCount} 行
                </div>
                {sheets.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10.5 }}>
                    <span style={{ color: '#065f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📄 {s.name}
                    </span>
                    <span style={{ flexShrink: 0, color: '#047857' }}>{s.rowCount} 行</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>已导出</span>
                <span>{rowCount} 行</span>
              </div>
            )}
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

        {!hasPreview && (
          <div style={{ fontSize: 10.5, color: '#9ca3af', lineHeight: 1.5 }}>
            支持连接多个上游节点：每路数据会导出为同一个 Excel 文件中的一个 sheet。
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default ExcelExportNode
