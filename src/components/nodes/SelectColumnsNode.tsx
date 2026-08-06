import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeButtonStyle, nodeLabelStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import { useUpstreamFields } from './useUpstreamFields'
import type { PipelineNode, SelectColumnsConfig } from '@/types/pipeline'

/** 列筛选节点主题色：橙色 */
const SELECT_COLOR = '#f97316'

/**
 * 列筛选节点
 *
 * - 从上游数据字段中勾选要保留的列，未勾选的列被丢弃
 * - 字段列表从上游数据下拉复选（可多选）
 * - 同时具有输入与输出 Handle
 */
export function SelectColumnsNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as SelectColumnsConfig) ?? { fields: [] }
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const fields: string[] = config.fields ?? []

  // 上游传入的可用字段（去重有序）
  const upstreamFields = useUpstreamFields(id)

  const update = (patch: Partial<SelectColumnsConfig>) => {
    updateNodeData(id, { config: { ...config, ...patch } })
  }

  /** 切换某个字段的保留状态 */
  const toggleField = (field: string, checked: boolean) => {
    if (checked) {
      if (!fields.includes(field)) update({ fields: [...fields, field] })
    } else {
      update({ fields: fields.filter((f) => f !== field) })
    }
  }

  /** 全选 / 取消全选 */
  const toggleAll = (checked: boolean) => {
    update({ fields: checked ? [...upstreamFields] : [] })
  }

  return (
    <BaseNode
      icon="☰"
      title="列筛选"
      color={SELECT_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={true}
      nodeId={id}
      summary={
        fields.length > 0
          ? `保留 ${fields.length} 列`
          : upstreamFields.length > 0
            ? '保留全部列'
            : '未连接上游'
      }
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {upstreamFields.length === 0 ? (
          <div style={{ fontSize: 11, color: '#9ca3af' }}>请先连接上游数据源</div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 2px',
              }}
            >
              <label style={nodeLabelStyle}>保留列（{fields.length}/{upstreamFields.length}）</label>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: '#6b7280',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={fields.length === upstreamFields.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="nodrag"
                />
                全选
              </label>
            </div>

            <div
              style={{
                maxHeight: 200,
                overflow: 'auto',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {upstreamFields.map((field) => {
                const checked = fields.includes(field)
                return (
                  <label
                    key={field}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 6px',
                      borderRadius: 4,
                      fontSize: 12,
                      color: '#111827',
                      cursor: 'pointer',
                      background: checked ? '#fff7ed' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleField(field, e.target.checked)}
                      className="nodrag"
                    />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {field}
                    </span>
                  </label>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => update({ fields: [] })}
              style={nodeButtonStyle}
              className="nodrag"
            >
              重置（保留全部列）
            </button>
          </>
        )}

        {fields.length > 0 && (
          <div
            style={{
              padding: '5px 8px',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: 6,
              fontSize: 10.5,
              color: '#c2410c',
              lineHeight: 1.4,
            }}
          >
            其余列将在输出中被丢弃
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default SelectColumnsNode