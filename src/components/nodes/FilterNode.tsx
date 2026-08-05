import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import {
  BaseNode,
  nodeInputStyle,
  nodeSelectStyle,
  nodeButtonStyle,
  nodeIconButtonStyle,
} from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type {
  PipelineNode,
  FilterConfig,
  FilterCondition,
  FilterOperator,
} from '@/types/pipeline'

/** 过滤节点主题色：琥珀 */
const FILTER_COLOR = '#f59e0b'

/** 可选操作符列表 */
const OPERATORS: FilterOperator[] = [
  'gt',
  'lt',
  'eq',
  'neq',
  'gte',
  'lte',
  'in',
  'contains',
]

/** 操作符展示标签 */
const OPERATOR_LABELS: Record<FilterOperator, string> = {
  gt: '大于 (>)',
  lt: '小于 (<)',
  eq: '等于 (=)',
  neq: '不等于 (≠)',
  gte: '大于等于 (≥)',
  lte: '小于等于 (≤)',
  in: '属于 (in)',
  contains: '包含',
}

/**
 * 把输入框中的原始字符串转换为 FilterCondition.value
 * - in 操作符：按逗号拆分为数组，并尝试转成数字
 * - 其余操作符：尝试转成数字，失败则保留字符串
 */
function parseValue(operator: FilterOperator, raw: string): any {
  const coerce = (s: string): any => {
    const trimmed = s.trim()
    if (trimmed === '') return ''
    const n = Number(trimmed)
    return Number.isNaN(n) ? trimmed : n
  }

  if (operator === 'in') {
    return raw
      .split(',')
      .map((s) => coerce(s))
      .filter((s) => s !== '')
  }
  return coerce(raw)
}

/** 把 value 转回输入框可显示的字符串（in 操作符时用逗号拼接） */
function valueToString(value: any, operator: FilterOperator): string {
  if (value == null) return ''
  if (operator === 'in' && Array.isArray(value)) {
    return value.map((v) => String(v)).join(', ')
  }
  return String(value)
}

/**
 * 过滤节点
 *
 * - 可添加多个过滤条件（field, operator, value）
 * - 条件之间默认 AND 关系
 * - 同时具有输入与输出 Handle
 */
export function FilterNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()

  const config = (data.config as FilterConfig) ?? { conditions: [] }
  const status = (data.status as NodeStatus | undefined) ?? 'idle'
  const conditions: FilterCondition[] = config.conditions ?? []

  /** 整体写回 conditions */
  const updateConditions = (next: FilterCondition[]) => {
    updateNodeData(id, { config: { ...config, conditions: next } })
  }

  const handleAdd = () => {
    updateConditions([
      ...conditions,
      { field: '', operator: 'gt', value: '' },
    ])
  }

  const handleRemove = (index: number) => {
    updateConditions(conditions.filter((_, i) => i !== index))
  }

  const handleFieldChange = (index: number, field: string) => {
    updateConditions(
      conditions.map((c, i) => (i === index ? { ...c, field } : c)),
    )
  }

  const handleOperatorChange = (index: number, operator: FilterOperator) => {
    updateConditions(
      conditions.map((c, i) =>
        i === index ? { ...c, operator, value: parseValue(operator, valueToString(c.value, c.operator)) } : c,
      ),
    )
  }

  const handleValueChange = (index: number, raw: string) => {
    const operator = conditions[index].operator
    updateConditions(
      conditions.map((c, i) =>
        i === index ? { ...c, value: parseValue(operator, raw) } : c,
      ),
    )
  }

  return (
    <BaseNode
      icon="🔍"
      title="筛选"
      color={FILTER_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={true}
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {conditions.length === 0 && (
          <div style={{ fontSize: 11, color: '#9ca3af' }}>暂无条件，点击下方按钮添加</div>
        )}

        {conditions.map((cond, i) => (
          <div
            key={i}
            style={{
              padding: 6,
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="text"
                value={cond.field}
                placeholder="字段名"
                onChange={(e) => handleFieldChange(i, e.target.value)}
                style={{ ...nodeInputStyle, flex: 1 }}
                className="nodrag"
              />
              <button
                type="button"
                title="删除条件"
                onClick={() => handleRemove(i)}
                style={nodeIconButtonStyle}
                className="nodrag"
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', gap: 4 }}>
              <select
                value={cond.operator}
                onChange={(e) => handleOperatorChange(i, e.target.value as FilterOperator)}
                style={{ ...nodeSelectStyle, width: 88, flex: '0 0 auto' }}
                className="nodrag"
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={valueToString(cond.value, cond.operator)}
                placeholder={cond.operator === 'in' ? '值1, 值2' : '值'}
                onChange={(e) => handleValueChange(i, e.target.value)}
                style={{ ...nodeInputStyle, flex: 1 }}
                className="nodrag"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAdd}
          style={{ ...nodeButtonStyle, marginTop: 2 }}
          className="nodrag"
        >
          + 添加条件
        </button>
      </div>
    </BaseNode>
  )
}

export default FilterNode
