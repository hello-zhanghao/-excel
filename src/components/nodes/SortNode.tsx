import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeInputStyle, nodeSelectStyle, nodeLabelStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type { PipelineNode, SortConfig, SortOrder } from '@/types/pipeline'

/** 排序节点主题色：蓝色 */
const SORT_COLOR = '#3b82f6'

/** 排序方向列表 */
const SORT_ORDERS: SortOrder[] = ['asc', 'desc']

const SORT_ORDER_LABELS: Record<SortOrder, string> = {
  asc: '升序 (A→Z)',
  desc: '降序 (Z→A)',
}

/**
 * 排序节点
 *
 * - 按指定字段升序/降序排序
 * - 同时具有输入与输出 Handle
 */
export function SortNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as SortConfig) ?? { field: '', order: 'asc' as SortOrder }
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, field: e.target.value } })
  }

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { config: { ...config, order: e.target.value as SortOrder } })
  }

  return (
    <BaseNode
      icon="↕️"
      title="排序"
      color={SORT_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={true}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={nodeLabelStyle}>排序字段</label>
        <input
          type="text"
          value={config.field ?? ''}
          placeholder="如 sales"
          onChange={handleFieldChange}
          style={nodeInputStyle}
          className="nodrag"
        />

        <label style={{ ...nodeLabelStyle, marginTop: 2 }}>方向</label>
        <select
          value={config.order ?? 'asc'}
          onChange={handleOrderChange}
          style={nodeSelectStyle}
          className="nodrag"
        >
          {SORT_ORDERS.map((o) => (
            <option key={o} value={o}>
              {SORT_ORDER_LABELS[o]}
            </option>
          ))}
        </select>
      </div>
    </BaseNode>
  )
}

export default SortNode
