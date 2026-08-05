import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeSelectStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import { SAMPLE_DATASETS } from '@/data/sampleDatasets'
import type { PipelineNode, DataSourceConfig } from '@/types/pipeline'

/** 数据源节点主题色：靛蓝 */
const DATA_SOURCE_COLOR = '#6366f1'

/**
 * 数据源节点
 *
 * - 从内置示例数据集中选择一个作为流水线的数据入口
 * - 只有输出 Handle（无输入），是流水线的起点
 * - 配置存储在 node.data.config（DataSourceConfig: { datasetId }）
 *   配置变化时通过 updateNodeData 写回
 */
export function DataSourceNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = data.config as DataSourceConfig
  const datasetId = config?.datasetId ?? ''
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const dataset = SAMPLE_DATASETS.find((d) => d.id === datasetId)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { config: { ...config, datasetId: e.target.value } })
  }

  return (
    <BaseNode
      icon="🗃️"
      title="数据源"
      color={DATA_SOURCE_COLOR}
      status={status}
      selected={selected}
      hasInput={false}
      hasOutput={true}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>内置数据集</label>

        <select
          value={datasetId}
          onChange={handleChange}
          style={nodeSelectStyle}
          className="nodrag"
        >
          <option value="">请选择...</option>
          {SAMPLE_DATASETS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.icon} {d.name}
            </option>
          ))}
        </select>

        {dataset ? (
          <div
            style={{
              marginTop: 2,
              padding: '6px 8px',
              background: '#f3f4f6',
              borderRadius: 6,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, color: '#111827' }}>{dataset.name}</div>
            <div style={{ color: '#6b7280' }}>{dataset.rows.length} 行</div>
            <div style={{ color: '#9ca3af', fontSize: 10 }}>{dataset.description}</div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#9ca3af' }}>未选择数据集</div>
        )}
      </div>
    </BaseNode>
  )
}

export default DataSourceNode
