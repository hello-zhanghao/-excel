import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeInputStyle, nodeSelectStyle, nodeLabelStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import { useUpstreamFields } from './useUpstreamFields'
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

  // 上游传入的可用字段（去重有序）
  const upstreamFields = useUpstreamFields(id)

  const handleNewFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, newField: e.target.value } })
  }

  const handleExpressionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, expression: e.target.value } })
  }

  /** 选择字段时，把字段名追加到表达式末尾 */
  const handleInsertField = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const field = e.target.value
    if (!field) return
    const expr = config.expression ?? ''
    const next = expr ? `${expr} ${field}` : field
    updateNodeData(id, { config: { ...config, expression: next } })
    e.target.value = ''
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
      nodeId={id}
      summary={
        config.newField && config.expression
          ? `${config.newField} = ${config.expression}`
          : '未配置表达式'
      }
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
        {upstreamFields.length > 0 && (
          <>
            <label style={{ ...nodeLabelStyle, marginTop: 2 }}>插入字段到表达式</label>
            <select
              value=""
              onChange={handleInsertField}
              style={nodeSelectStyle}
              className="nodrag"
            >
              <option value="">选择字段 → 追加到表达式</option>
              {upstreamFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </BaseNode>
  )
}

export default CalculateNode
