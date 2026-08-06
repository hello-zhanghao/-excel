import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import {
  BaseNode,
  nodeInputStyle,
  nodeSelectStyle,
  nodeLabelStyle,
} from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type { PipelineNode, JoinConfig, JoinType } from '@/types/pipeline'

/** Join 节点主题色：紫色 */
const JOIN_COLOR = '#8b5cf6'

/** 可选关联类型 */
const JOIN_TYPES: JoinType[] = ['inner', 'left', 'right', 'full']

/** 关联类型展示标签 */
const JOIN_TYPE_LABELS: Record<JoinType, string> = {
  inner: '内连接 (inner)',
  left: '左连接 (left)',
  right: '右连接 (right)',
  full: '全连接 (full)',
}

/**
 * Join（关联）节点
 *
 * - 接收两个上游输入：左表（第一个连接）和右表（第二个连接）
 * - 按指定的 leftKey / rightKey 字段进行关联
 * - 支持 inner / left / right / full 四种关联类型
 * - 有两个输入 Handle（分别标记"左表"和"右表"）和一个输出 Handle
 *
 * 注意：React Flow 的 Handle id 用于区分多输入，
 * 连线时引擎根据 source 顺序确定左/右表。
 */
export function JoinNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as JoinConfig) ?? {
    leftKey: '',
    rightKey: '',
    joinType: 'inner' as JoinType,
  }
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const update = (patch: Partial<JoinConfig>) => {
    updateNodeData(id, { config: { ...config, ...patch } })
  }

  const handleLeftKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    update({ leftKey: e.target.value })
  }

  const handleRightKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    update({ rightKey: e.target.value })
  }

  const handleJoinTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    update({ joinType: e.target.value as JoinType })
  }

  return (
    <BaseNode
      icon="🔗"
      title="关联"
      color={JOIN_COLOR}
      status={status}
      selected={selected}
      hasInput={false}
      hasOutput={true}
      inputLabels={[
        { id: 'left', label: '左表' },
        { id: 'right', label: '右表' },
      ]}
      nodeId={id}
      summary={
        config.leftKey && config.rightKey
          ? `${config.leftKey} = ${config.rightKey} · ${config.joinType ?? 'inner'}`
          : '未配置关联字段'
      }
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={nodeLabelStyle}>左表关联字段</label>
        <input
          type="text"
          value={config.leftKey ?? ''}
          placeholder="如 region"
          onChange={handleLeftKeyChange}
          style={nodeInputStyle}
          className="nodrag"
        />

        <label style={{ ...nodeLabelStyle, marginTop: 2 }}>右表关联字段</label>
        <input
          type="text"
          value={config.rightKey ?? ''}
          placeholder="如 region"
          onChange={handleRightKeyChange}
          style={nodeInputStyle}
          className="nodrag"
        />

        <label style={{ ...nodeLabelStyle, marginTop: 2 }}>关联类型</label>
        <select
          value={config.joinType ?? 'inner'}
          onChange={handleJoinTypeChange}
          style={nodeSelectStyle}
          className="nodrag"
        >
          {JOIN_TYPES.map((jt) => (
            <option key={jt} value={jt}>
              {JOIN_TYPE_LABELS[jt]}
            </option>
          ))}
        </select>

        <div style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>
          左表 = 第一个连接的节点，右表 = 第二个连接的节点
        </div>
      </div>
    </BaseNode>
  )
}

export default JoinNode
