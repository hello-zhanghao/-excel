import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import {
  BaseNode,
  nodeSelectStyle,
  nodeLabelStyle,
} from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type { PipelineNode, UnionConfig } from '@/types/pipeline'

/** Union 节点主题色：青绿色 */
const UNION_COLOR = '#06b6d4'

/**
 * Union（合并）节点
 *
 * - 接收多个上游输入，将所有行纵向堆叠
 * - 字段取并集，缺失字段补 null
 * - 可选去重（基于所有字段的完全匹配）
 * - 有两个输入 Handle（可接收两路输入）和一个输出 Handle
 *
 * 适用场景：
 *  - 合并多月/多地区/多产品维度的数据
 *  - 合并结构相同或相似的多张表
 */
export function UnionNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as UnionConfig) ?? { distinct: false }
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const handleDistinctChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, {
      config: { ...config, distinct: e.target.value === 'true' },
    })
  }

  return (
    <BaseNode
      icon="📋"
      title="合并"
      color={UNION_COLOR}
      status={status}
      selected={selected}
      hasInput={false}
      hasOutput={true}
      inputLabels={[
        { id: 'input1', label: '表1' },
        { id: 'input2', label: '表2' },
      ]}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={nodeLabelStyle}>去重模式</label>
        <select
          value={String(config.distinct ?? false)}
          onChange={handleDistinctChange}
          style={nodeSelectStyle}
          className="nodrag"
        >
          <option value="false">保留所有行</option>
          <option value="true">去除完全重复行</option>
        </select>

        <div
          style={{
            marginTop: 2,
            padding: '6px 8px',
            background: '#f0fdfa',
            borderRadius: 6,
            fontSize: 10,
            lineHeight: 1.5,
            color: '#0f766e',
          }}
        >
          <div style={{ fontWeight: 600 }}>纵向堆叠多表</div>
          <div>字段取并集，缺失补 null</div>
        </div>
      </div>
    </BaseNode>
  )
}

export default UnionNode
