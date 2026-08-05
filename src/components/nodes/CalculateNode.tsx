import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeInputStyle, nodeLabelStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type { PipelineNode, CalculateConfig } from '@/types/pipeline'

/** 计算字段节点主题色：翡翠绿 */
const CALCULATE_COLOR = '#10b981'

/**
 * 计算字段节点
 *
 * - 通过表达式对每一行派生一个新字段，如 "profit / sales * 100"
 * - 同时具有输入与输出 Handle
 * - 配置存储在 node.data.config（CalculateConfig: { newField, expression }）
 */
export function CalculateNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as CalculateConfig) ?? { newField: '', expression: '' }
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const handleNewFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, newField: e.target.value } })
  }

  const handleExpressionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, expression: e.target.value } })
  }

  return (
    <BaseNode
      icon="🧮"
      title="计算字段"
      color={CALCULATE_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={true}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={nodeLabelStyle}>新字段名</label>
        <input
          type="text"
          value={config.newField ?? ''}
          placeholder="如 profit_rate"
          onChange={handleNewFieldChange}
          style={nodeInputStyle}
          className="nodrag"
        />

        <label style={{ ...nodeLabelStyle, marginTop: 2 }}>表达式</label>
        <input
          type="text"
          value={config.expression ?? ''}
          placeholder="如 profit / sales * 100"
          onChange={handleExpressionChange}
          style={nodeInputStyle}
          className="nodrag"
        />
        <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>
          可使用行内任意字段参与四则运算
        </div>
      </div>
    </BaseNode>
  )
}

export default CalculateNode
