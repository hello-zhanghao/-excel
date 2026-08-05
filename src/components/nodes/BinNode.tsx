import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeInputStyle, nodeSelectStyle, nodeLabelStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type { PipelineNode, BinConfig, BinMethod } from '@/types/pipeline'

/** 分箱节点主题色：青色 */
const BIN_COLOR = '#14b8a6'

/** 分箱方法列表 */
const BIN_METHODS: BinMethod[] = ['equalWidth', 'equalFreq']

const BIN_METHOD_LABELS: Record<BinMethod, string> = {
  equalWidth: '等宽分箱',
  equalFreq: '等频分箱',
}

/**
 * 分箱节点
 *
 * - 对数值字段进行离散化，生成 `${field}_bin` 新字段
 * - 配置：字段名 + 分箱数 + 分箱方法
 * - 同时具有输入与输出 Handle
 */
export function BinNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as BinConfig) ?? {
    field: '',
    bins: 5,
    method: 'equalWidth' as BinMethod,
  }
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, field: e.target.value } })
  }

  const handleBinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10)
    updateNodeData(id, {
      config: { ...config, bins: Number.isNaN(parsed) ? 0 : parsed },
    })
  }

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, {
      config: { ...config, method: e.target.value as BinMethod },
    })
  }

  return (
    <BaseNode
      icon="📦"
      title="分箱"
      color={BIN_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={true}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={nodeLabelStyle}>字段名</label>
        <input
          type="text"
          value={config.field ?? ''}
          placeholder="如 sales"
          onChange={handleFieldChange}
          style={nodeInputStyle}
          className="nodrag"
        />

        <label style={{ ...nodeLabelStyle, marginTop: 2 }}>分箱数</label>
        <input
          type="number"
          min={1}
          value={config.bins ?? 5}
          onChange={handleBinsChange}
          style={nodeInputStyle}
          className="nodrag"
        />

        <label style={{ ...nodeLabelStyle, marginTop: 2 }}>分箱方法</label>
        <select
          value={config.method ?? 'equalWidth'}
          onChange={handleMethodChange}
          style={nodeSelectStyle}
          className="nodrag"
        >
          {BIN_METHODS.map((m) => (
            <option key={m} value={m}>
              {BIN_METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
    </BaseNode>
  )
}

export default BinNode
