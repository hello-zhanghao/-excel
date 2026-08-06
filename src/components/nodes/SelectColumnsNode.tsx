import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeButtonStyle } from './BaseNode'
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
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column' }}>
        {upstreamFields.length === 0 ? (
          <div style={{ fontSize: 11, color: '#9ca3af' }}>请先连接上游数据源</div>
        ) : (
          <>
            {/* 顶部：标题 + 全选操作，对齐统一 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 8,
                marginBottom: 8,
                borderBottom: '1px solid #f0f0f3',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                保留列
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: '#9ca3af' }}>
                  {fields.length} / {upstreamFields.length}
                </span>
              </span>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: '#6b7280',
                  cursor: 'pointer',
                  userSelect: 'none',
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

            {/* 字段列表：统一卡片式复选框 */}
            <div
              style={{
                maxHeight: 220,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: 2,
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
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#111827',
                      cursor: 'pointer',
                      background: checked ? 'var(--brand-light)' : 'var(--surface-muted)',
                      border: checked ? '1px solid var(--brand)' : '1px solid transparent',
                      transition: 'background 0.12s, border-color 0.12s',
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
                        flex: 1,
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

            {/* 底部操作：重置 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                paddingTop: 10,
                marginTop: 8,
                borderTop: '1px solid #f0f0f3',
              }}
            >
              {fields.length > 0 ? (
                <span style={{ fontSize: 10.5, color: '#c2410c', lineHeight: 1.3 }}>
                  未勾选列将在输出中丢弃
                </span>
              ) : (
                <span style={{ fontSize: 10.5, color: '#9ca3af' }}>默认保留全部列</span>
              )}
              <button
                type="button"
                onClick={() => update({ fields: [] })}
                style={nodeButtonStyle}
                className="nodrag"
              >
                重置
              </button>
            </div>
          </>
        )}
      </div>
    </BaseNode>
  )
}

export default SelectColumnsNode