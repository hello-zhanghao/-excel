import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import {
  BaseNode,
  nodeInputStyle,
  nodeSelectStyle,
  nodeButtonStyle,
  nodeIconButtonStyle,
  nodeLabelStyle,
} from './BaseNode'
import type { NodeStatus } from './BaseNode'
import { useUpstreamFields } from './useUpstreamFields'
import type {
  PipelineNode,
  AggregateConfig,
  AggregateMeasure,
} from '@/types/pipeline'
import type { Aggregation } from '@/types'

/** 聚合节点主题色：玫瑰红 */
const AGGREGATE_COLOR = '#f43f5e'

/** 可选聚合方式 */
const AGGREGATIONS: Aggregation[] = [
  'sum',
  'avg',
  'count',
  'min',
  'max',
  'count_distinct',
]

const AGGREGATION_LABELS: Record<Aggregation, string> = {
  sum: '求和 (sum)',
  avg: '平均 (avg)',
  count: '计数 (count)',
  min: '最小 (min)',
  max: '最大 (max)',
  count_distinct: '去重计数',
}

/** 空字段提示文案 */
const EMPTY_FIELD_HINT = '请先连接上游数据源'

/**
 * 聚合节点
 *
 * - groupBy：分组字段，从上游数据字段下拉选择（可多选）
 * - measures：度量列表，字段从上游数据下拉选择
 * - 同时具有输入与输出 Handle
 */
export function AggregateNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as AggregateConfig) ?? { groupBy: [], measures: [] }
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const groupBy: string[] = config.groupBy ?? []
  const measures: AggregateMeasure[] = config.measures ?? []

  // 上游传入的可用字段（去重有序）
  const upstreamFields = useUpstreamFields(id)

  const update = (patch: Partial<AggregateConfig>) => {
    updateNodeData(id, { config: { ...config, ...patch } })
  }

  /** 添加一个分组字段（下拉选择） */
  const handleAddGroupBy = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const field = e.target.value
    if (field && !groupBy.includes(field)) {
      update({ groupBy: [...groupBy, field] })
    }
    // 重置 select 到占位
    e.target.value = ''
  }

  /** 移除一个分组字段标签 */
  const handleRemoveGroupBy = (field: string) => {
    update({ groupBy: groupBy.filter((f) => f !== field) })
  }

  const handleAddMeasure = () => {
    update({
      measures: [...measures, { field: '', aggregation: 'sum' }],
    })
  }

  const handleRemoveMeasure = (index: number) => {
    update({ measures: measures.filter((_, i) => i !== index) })
  }

  const handleMeasureField = (index: number, field: string) => {
    update({
      measures: measures.map((m, i) => (i === index ? { ...m, field } : m)),
    })
  }

  const handleMeasureAgg = (index: number, aggregation: Aggregation) => {
    update({
      measures: measures.map((m, i) =>
        i === index ? { ...m, aggregation } : m,
      ),
    })
  }

  return (
    <BaseNode
      icon="📊"
      title="聚合"
      color={AGGREGATE_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={true}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* 分组字段：标签 + 下拉选择 */}
        <label style={nodeLabelStyle}>分组字段</label>

        {upstreamFields.length === 0 ? (
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {EMPTY_FIELD_HINT}
          </div>
        ) : (
          <>
            {groupBy.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {groupBy.map((field) => (
                  <span
                    key={field}
                    title="点击移除"
                    onClick={() => handleRemoveGroupBy(field)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      background: '#ffe4e6',
                      color: '#be123c',
                      borderRadius: 999,
                      cursor: 'pointer',
                      border: '1px solid #fecdd3',
                    }}
                  >
                    {field} ×
                  </span>
                ))}
              </div>
            )}
            <select
              value=""
              onChange={handleAddGroupBy}
              style={nodeSelectStyle}
              className="nodrag"
            >
              <option value="">
                {groupBy.length > 0 ? '+ 添加分组字段' : '选择分组字段'}
              </option>
              {upstreamFields
                .filter((f) => !groupBy.includes(f))
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </select>
          </>
        )}

        {/* 度量列表 */}
        <label style={{ ...nodeLabelStyle, marginTop: 2 }}>度量</label>

        {measures.length === 0 && (
          <div style={{ fontSize: 11, color: '#9ca3af' }}>暂无度量，点击下方按钮添加</div>
        )}

        {measures.map((measure, i) => (
          <div
            key={i}
            style={{ display: 'flex', gap: 4, alignItems: 'center' }}
          >
            {upstreamFields.length > 0 ? (
              <select
                value={measure.field}
                onChange={(e) => handleMeasureField(i, e.target.value)}
                style={{ ...nodeSelectStyle, flex: 1, minWidth: 0 }}
                className="nodrag"
              >
                <option value="">选择字段</option>
                {upstreamFields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={measure.field}
                placeholder={EMPTY_FIELD_HINT}
                onChange={(e) => handleMeasureField(i, e.target.value)}
                style={{ ...nodeInputStyle, flex: 1 }}
                className="nodrag"
              />
            )}
            <select
              value={measure.aggregation}
              onChange={(e) => handleMeasureAgg(i, e.target.value as Aggregation)}
              style={{ ...nodeSelectStyle, width: 80, flex: '0 0 auto' }}
              className="nodrag"
            >
              {AGGREGATIONS.map((agg) => (
                <option key={agg} value={agg}>
                  {AGGREGATION_LABELS[agg]}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="删除度量"
              onClick={() => handleRemoveMeasure(i)}
              style={nodeIconButtonStyle}
              className="nodrag"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddMeasure}
          style={{ ...nodeButtonStyle, marginTop: 2 }}
          className="nodrag"
        >
          + 添加度量
        </button>
      </div>
    </BaseNode>
  )
}

export default AggregateNode