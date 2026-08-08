/**
 * 数据流执行引擎
 *
 * 接收 React Flow 的节点与边，按拓扑序逐节点执行数据处理逻辑，
 * 最终返回每个节点的输出结果（rows + fields）。
 *
 * 节点类型：
 * - dataSource: 从内置数据集加载（无上游输入）
 * - filter:     按条件过滤行
 * - calculate:  基于表达式派生新字段
 * - aggregate:  分组聚合
 * - bin:        数值分箱（等宽 / 等频）
 * - sort:       排序
 * - join:       按字段关联两表（inner/left/right/full）
 * - union:      纵向堆叠多表行
 * - output:     直接透传
 */

import type { Edge } from '@xyflow/react'
import type {
  PipelineNode,
  DataSourceConfig,
  FilterConfig,
  CalculateConfig,
  AggregateConfig,
  BinConfig,
  SortConfig,
  SelectColumnsConfig,
  JoinConfig,
  UnionConfig,
  FilterCondition,
  NodeOutput,
} from '@/types/pipeline'
import type { FieldMeta, Aggregation } from '@/types'
import { FieldKind } from '@/types'
import { SAMPLE_DATASETS, inferFieldsFromRows } from '@/data/sampleDatasets'

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 安全地推断字段元信息：
 * 优先用结果行推断；当结果为空时回退到上游输入行，保证 schema 不丢失。
 */
function inferFieldsSafe(
  rows: Record<string, any>[],
  fallback: Record<string, any>[],
): FieldMeta[] {
  if (rows.length > 0) return inferFieldsFromRows(rows)
  if (fallback.length > 0) return inferFieldsFromRows(fallback)
  return []
}

/**
 * 保证某个字段一定出现在 fields 列表中（计算/分箱节点派生新字段时使用）
 */
function ensureField(
  fields: FieldMeta[],
  name: string,
  dataType: FieldMeta['dataType'] = 'number',
  kind: FieldKind = FieldKind.Measure,
): FieldMeta[] {
  if (fields.find((f) => f.name === name)) return fields
  return [...fields, { name, dataType, kind, sample: [] }]
}

/** 将数值格式化为分箱标签上的可读字符串 */
function formatNumber(n: number): string {
  if (!isFinite(n)) return String(n)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** 节点类型的中文标签（用于导出 sheet 命名兜底） */
const NODE_TYPE_LABELS: Record<string, string> = {
  dataSource: '数据源',
  filter: '筛选',
  calculate: '计算字段',
  aggregate: '聚合',
  bin: '分箱',
  sort: '排序',
  selectColumns: '列筛选',
  join: '关联',
  union: '合并',
  output: '输出',
  excelExport: '导出',
  pptExport: '导出 PPT',
}

function nodeTypeLabel(type: string | undefined): string {
  if (!type) return ''
  return NODE_TYPE_LABELS[type] ?? type
}

// ---------------------------------------------------------------------------
// 1. 拓扑排序
// ---------------------------------------------------------------------------

/**
 * 拓扑排序：根据边的关系确定节点执行顺序。
 *
 * 采用 Kahn 算法（基于入度的 BFS）：
 *  - 边 source -> target 表示 target 依赖 source，source 先执行
 *  - 入度为 0 的节点先入队，逐个处理后将其后继节点入度减一
 *  - 若存在环，剩余节点按原始顺序追加在末尾，避免数据丢失
 *
 * @param nodes React Flow 节点列表
 * @param edges React Flow 边列表
 * @returns 按执行顺序排列的节点数组
 */
export function topologicalSort(
  nodes: PipelineNode[],
  edges: Edge[],
): PipelineNode[] {
  const nodeMap = new Map<string, PipelineNode>(nodes.map((n) => [n.id, n]))

  // 邻接表：source -> target[]
  const adjacency = new Map<string, string[]>()
  // 入度：target -> 入度数
  const inDegree = new Map<string, number>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of edges) {
    // 仅处理两端节点都存在的边，避免悬空边干扰
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue
    adjacency.get(edge.source)!.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  }

  // 入度为 0 的节点入队（保持原始顺序，结果更稳定）
  const queue: string[] = []
  for (const node of nodes) {
    if ((inDegree.get(node.id) || 0) === 0) queue.push(node.id)
  }

  const sorted: PipelineNode[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)

    const node = nodeMap.get(id)
    if (node) sorted.push(node)

    for (const next of adjacency.get(id) || []) {
      const deg = (inDegree.get(next) || 0) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  // 存在环时，把未访问的节点追加到末尾
  if (sorted.length < nodes.length) {
    for (const node of nodes) {
      if (!visited.has(node.id)) sorted.push(node)
    }
  }

  return sorted
}

// ---------------------------------------------------------------------------
// 2. 各节点类型的数据处理逻辑
// ---------------------------------------------------------------------------

/** dataSource：从内置数据集或上传文件加载 */
function executeDataSource(node: PipelineNode): NodeOutput {
  const config = node.data.config as DataSourceConfig
  // 优先使用上传的文件数据（config.rows 为解析后的行数组）
  if (config.rows && config.rows.length > 0) {
    const rows = config.rows.map((r) => ({ ...r }))
    const fields = inferFieldsFromRows(rows)
    return { rows, fields }
  }
  // 回退到内置示例数据集
  const dataset = SAMPLE_DATASETS.find((d) => d.id === config.datasetId)
  if (!dataset) {
    return { rows: [], fields: [] }
  }
  // 深拷贝行，避免后续节点污染内置数据集
  const rows = dataset.rows.map((r) => ({ ...r }))
  const fields = inferFieldsFromRows(rows)
  return { rows, fields }
}

/** 判断单行是否满足一个过滤条件 */
function matchCondition(row: Record<string, any>, cond: FilterCondition): boolean {
  const val = row[cond.field]
  switch (cond.operator) {
    case 'gt':       return val > cond.value
    case 'lt':       return val < cond.value
    case 'gte':      return val >= cond.value
    case 'lte':      return val <= cond.value
    case 'eq':       return val === cond.value
    case 'neq':      return val !== cond.value
    case 'in':       return Array.isArray(cond.value) && cond.value.includes(val)
    case 'contains': return val != null && String(val).includes(String(cond.value))
    default:         return true
  }
}

/** filter：按 conditions 过滤行 */
function executeFilter(
  node: PipelineNode,
  inputData: Record<string, any>[],
): NodeOutput {
  const config = node.data.config as FilterConfig
  const logic = config.logic === 'OR' ? 'OR' : 'AND'
  const conditions = config.conditions || []

  const rows = inputData.filter((row) => {
    if (conditions.length === 0) return true
    const results = conditions.map((c) => matchCondition(row, c))
    return logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
  })

  // 过滤不改变 schema，用上游输入推断字段，避免结果为空时 schema 丢失
  const fields = inferFieldsSafe(rows, inputData)
  return { rows, fields }
}

/** calculate：解析表达式，对每行派生新字段 */
function executeCalculate(
  node: PipelineNode,
  inputData: Record<string, any>[],
): NodeOutput {
  const config = node.data.config as CalculateConfig
  const { newField, expression } = config

  // 编译表达式：用 with(row) 把行字段注入作用域，支持 "profit / sales * 100" 这类写法
  let evaluator: (row: Record<string, any>) => any
  try {
    // eslint-disable-next-line no-new-func
    evaluator = new Function(
      'row',
      'with(row){ return ' + expression + ' }',
    ) as (row: Record<string, any>) => any
  } catch {
    // 表达式语法错误，统一返回 null
    evaluator = () => null
  }

  const rows = inputData.map((row) => {
    let value: any
    try {
      value = evaluator(row)
      // NaN / Infinity 视作无效
      if (typeof value === 'number' && !isFinite(value)) value = null
    } catch {
      value = null
    }
    return { ...row, [newField]: value }
  })

  let fields = inferFieldsSafe(rows, inputData)
  // 即使结果为空也要保证新字段出现在 schema 中
  fields = ensureField(fields, newField, 'number', FieldKind.Measure)
  return { rows, fields }
}

/**
 * 增量聚合器 —— 不保存分组内所有行，只累计聚合值
 * 内存占用从 O(总行数) 降至 O(分组数)，适合十万行以上数据
 */
interface AggAccumulator {
  sum: number
  count: number
  min: number | null
  max: number | null
  distinct: Set<string>
  firstValues: Record<string, any>
}

/** 创建新的聚合累加器 */
function createAccumulator(
  groupBy: string[],
  measures: AggregateConfig['measures'],
  firstRow: Record<string, any>,
): AggAccumulator {
  const firstValues: Record<string, any> = {}
  for (const f of groupBy) firstValues[f] = firstRow?.[f]
  return { sum: 0, count: 0, min: null, max: null, distinct: new Set(), firstValues }
}

/** 将一行数据增量并入聚合器 */
function accumulateRow(
  acc: AggAccumulator,
  row: Record<string, any>,
  measures: AggregateConfig['measures'],
) {
  for (const measure of measures) {
    const raw = row[measure.field]
    if (raw == null || raw === '') continue
    const num = Number(raw)
    if (isFinite(num)) {
      acc.sum += num
      acc.count++
      if (acc.min === null || num < acc.min) acc.min = num
      if (acc.max === null || num > acc.max) acc.max = num
    }
    acc.distinct.add(String(raw))
  }
}

/** 从累加器读取某个 measure 的聚合结果 */
function finalizeAccumulator(
  acc: AggAccumulator,
  measure: { field: string; aggregation: Aggregation },
): any {
  switch (measure.aggregation) {
    case 'sum': return acc.sum
    case 'avg': return acc.count > 0 ? acc.sum / acc.count : null
    case 'count': return acc.count
    case 'min': return acc.min
    case 'max': return acc.max
    case 'count_distinct': return acc.distinct.size
    default: return null
  }
}

/** aggregate：按 groupBy 分组，对 measures 做增量聚合（十万行级优化） */
function executeAggregate(
  node: PipelineNode,
  inputData: Record<string, any>[],
): NodeOutput {
  const config = node.data.config as AggregateConfig
  const groupBy = config.groupBy || []
  const measures = config.measures || []

  // 单遍扫描：增量聚合，避免保存所有分组行
  const groups = new Map<string, AggAccumulator>()
  for (const row of inputData) {
    const key = groupBy.length > 0
      ? groupBy.map((f) => String(row[f] ?? '')).join('\u0001')
      : '__all__'
    let acc = groups.get(key)
    if (!acc) {
      acc = createAccumulator(groupBy, measures, row)
      groups.set(key, acc)
    }
    accumulateRow(acc, row, measures)
  }

  const rows: Record<string, any>[] = []
  for (const acc of groups.values()) {
    const out: Record<string, any> = { ...acc.firstValues }
    for (const measure of measures) {
      const alias = measure.alias || `${measure.aggregation}_${measure.field}`
      out[alias] = finalizeAccumulator(acc, measure)
    }
    rows.push(out)
  }

  const fields = inferFieldsSafe(rows, inputData)
  return { rows, fields }
}

/** 根据分箱边界定位某个值所属的 bin 序号 */
function findBinIndex(value: number, edges: number[]): number {
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i]
    const hi = edges[i + 1]
    const isLast = i === edges.length - 2
    // 最后一个区间右端闭合，保证 max 值能落入分箱
    if (isLast ? value >= lo && value <= hi : value >= lo && value < hi) {
      return i
    }
  }
  // 兜底：放入最后一个分箱
  return edges.length - 2
}

/** 生成某个分箱的可读标签，如 "[0, 10)" 或 "[90, 100]" */
function formatBinLabel(edges: number[], idx: number): string {
  const lo = edges[idx]
  const hi = edges[idx + 1]
  const isLast = idx === edges.length - 2
  return isLast
    ? `[${formatNumber(lo)}, ${formatNumber(hi)}]`
    : `[${formatNumber(lo)}, ${formatNumber(hi)})`
}

/** bin：对数值字段分箱，生成 `${field}_bin` 新字段 */
function executeBin(
  node: PipelineNode,
  inputData: Record<string, any>[],
): NodeOutput {
  const config = node.data.config as BinConfig
  const { field, bins, method } = config
  const newField = `${field}_bin`
  const binCount = Math.max(1, Math.floor(bins))

  // 收集有效数值
  const numericValues = inputData
    .map((r) => Number(r[field]))
    .filter((v) => isFinite(v))

  // 计算分箱边界 edges（长度 = binCount + 1）
  let edges: number[]
  if (numericValues.length === 0) {
    // 无有效数据，所有值标记为 null
    const rows = inputData.map((r) => ({ ...r, [newField]: null }))
    let fields = inferFieldsSafe(rows, inputData)
    fields = ensureField(fields, newField, 'string', FieldKind.Dimension)
    return { rows, fields }
  }

  if (method === 'equalFreq') {
    // 等频：按分位数取边界
    const sorted = [...numericValues].sort((a, b) => a - b)
    edges = []
    for (let i = 0; i <= binCount; i++) {
      const idx = Math.min(sorted.length - 1, Math.floor((i * sorted.length) / binCount))
      edges.push(sorted[idx])
    }
  } else {
    // 等宽：按 min/max 等分
    const min = Math.min(...numericValues)
    const max = Math.max(...numericValues)
    const step = (max - min) / binCount || 0
    edges = []
    for (let i = 0; i <= binCount; i++) {
      edges.push(min + step * i)
    }
  }

  const rows = inputData.map((row) => {
    const v = Number(row[field])
    let label: string | null = null
    if (isFinite(v)) {
      label = formatBinLabel(edges, findBinIndex(v, edges))
    }
    return { ...row, [newField]: label }
  })

  let fields = inferFieldsSafe(rows, inputData)
  fields = ensureField(fields, newField, 'string', FieldKind.Dimension)
  return { rows, fields }
}

/** sort：按字段排序 */
function executeSort(
  node: PipelineNode,
  inputData: Record<string, any>[],
): NodeOutput {
  const config = node.data.config as SortConfig
  const { field, order } = config
  const dir = order === 'desc' ? -1 : 1

  // 复制后排序，避免改动上游数组；行对象本身不修改
  const rows = [...inputData].sort((a, b) => {
    const va = a[field]
    const vb = b[field]
    if (va == null && vb == null) return 0
    if (va == null) return 1   // null 值统一排到末尾（不受升降序影响符号简化处理）
    if (vb == null) return -1
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * dir
    }
    return String(va).localeCompare(String(vb)) * dir
  })

  const fields = inferFieldsSafe(rows, inputData)
  return { rows, fields }
}

/** selectColumns：只保留选中的列 */
function executeSelectColumns(
  node: PipelineNode,
  inputData: Record<string, any>[],
): NodeOutput {
  const config = node.data.config as SelectColumnsConfig
  const fields = config.fields || []

  // 未选择任何列时透传全部（保持 schema 不丢失）
  if (fields.length === 0) {
    return {
      rows: inputData.map((r) => ({ ...r })),
      fields: inferFieldsSafe(inputData, inputData),
    }
  }

  // 只保留选中列，忽略上游不存在的字段名
  const keepSet = new Set(fields)
  const rows = inputData.map((row) => {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(row)) {
      if (keepSet.has(k)) out[k] = v
    }
    return out
  })

  let resultFields = inferFieldsSafe(rows, inputData)
  // 当结果为空时，基于上游 schema 过滤出保留字段，避免 schema 丢失
  if (resultFields.length === 0) {
    const upstreamFields = inferFieldsSafe(inputData, inputData)
    resultFields = upstreamFields.filter((f) => keepSet.has(f.name))
  }
  return { rows, fields: resultFields }
}

// ---------------------------------------------------------------------------
// Join / Union —— 多输入节点
// ---------------------------------------------------------------------------

/**
 * join：按字段关联两表
 *
 * inputs[0] = 左表，inputs[1] = 右表
 * 支持四种关联类型：inner / left / right / full
 *
 * 字段冲突处理：当两表有同名字段（非关联键）时，右表字段自动加后缀 "_right"
 */
function executeJoin(
  node: PipelineNode,
  inputs: Record<string, any>[][],
): NodeOutput {
  const config = node.data.config as JoinConfig
  const { leftKey, rightKey, joinType = 'inner' } = config

  const leftRows = inputs[0] ?? []
  const rightRows = inputs[1] ?? []

  // 收集两表字段名，检测冲突
  const leftFields = leftRows.length > 0 ? Object.keys(leftRows[0]) : []
  const rightFields = rightRows.length > 0 ? Object.keys(rightRows[0]) : []
  const conflictFields = new Set(
    rightFields.filter((f) => f !== rightKey && leftFields.includes(f)),
  )

  // 构建右表索引：key -> rows[]（一对多场景）
  const rightIndex = new Map<string, Record<string, any>[]>()
  for (const row of rightRows) {
    const key = String(row[rightKey])
    let group = rightIndex.get(key)
    if (!group) {
      group = []
      rightIndex.set(key, group)
    }
    group.push(row)
  }

  const matchedRightIds = new Set<string>()
  const resultRows: Record<string, any>[] = []

  /** 把右表行合并到左表行，冲突字段加后缀 */
  const mergeRow = (
    left: Record<string, any>,
    right: Record<string, any> | null,
  ): Record<string, any> => {
    const merged: Record<string, any> = { ...left }
    if (right) {
      for (const [k, v] of Object.entries(right)) {
        if (k === rightKey) continue // 关联键不重复
        const targetKey = conflictFields.has(k) ? `${k}_right` : k
        merged[targetKey] = v
      }
    }
    return merged
  }

  // 处理左表每一行
  for (const leftRow of leftRows) {
    const key = String(leftRow[leftKey])
    const matches = rightIndex.get(key)

    if (matches && matches.length > 0) {
      // 有匹配：inner/left 都保留
      for (const rightRow of matches) {
        matchedRightIds.add(String(rightRow[rightKey]))
        resultRows.push(mergeRow(leftRow, rightRow))
      }
    } else if (joinType === 'left' || joinType === 'full') {
      // 无匹配但 left/full：保留左表行，右表字段补 null
      resultRows.push(mergeRow(leftRow, null))
    }
    // inner/right 无匹配时丢弃左表行
  }

  // right/full：追加未匹配的右表行
  if (joinType === 'right' || joinType === 'full') {
    for (const rightRow of rightRows) {
      const key = String(rightRow[rightKey])
      if (!matchedRightIds.has(key)) {
        // 左表字段补 null
        const merged: Record<string, any> = {}
        for (const f of leftFields) {
          merged[f] = f === leftKey ? rightRow[rightKey] : null
        }
        for (const [k, v] of Object.entries(rightRow)) {
          if (k === rightKey) continue
          const targetKey = conflictFields.has(k) ? `${k}_right` : k
          merged[targetKey] = v
        }
        resultRows.push(merged)
      }
    }
  }

  const fields = inferFieldsSafe(resultRows, leftRows.length > 0 ? leftRows : rightRows)
  return { rows: resultRows, fields }
}

/**
 * union：纵向堆叠多表行
 *
 * 将所有上游输入的行合并在一起，字段取并集，缺失字段补 null。
 * 可选去重（基于所有字段的完全匹配）。
 */
function executeUnion(
  node: PipelineNode,
  inputs: Record<string, any>[][],
): NodeOutput {
  const config = node.data.config as UnionConfig
  const distinct = config?.distinct ?? false

  // 收集所有字段名（保持出现顺序）
  const allFields: string[] = []
  const fieldSet = new Set<string>()
  for (const input of inputs) {
    if (input.length > 0) {
      for (const key of Object.keys(input[0])) {
        if (!fieldSet.has(key)) {
          fieldSet.add(key)
          allFields.push(key)
        }
      }
    }
  }

  // 堆叠所有行，确保每行都有所有字段
  let rows: Record<string, any>[] = []
  for (const input of inputs) {
    for (const row of input) {
      const normalized: Record<string, any> = {}
      for (const f of allFields) {
        normalized[f] = row[f] ?? null
      }
      rows.push(normalized)
    }
  }

  // 去重
  if (distinct) {
    const seen = new Set<string>()
    rows = rows.filter((row) => {
      const key = JSON.stringify(row)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  // 推断字段类型
  let fields: FieldMeta[] = []
  if (rows.length > 0) {
    fields = inferFieldsFromRows(rows)
  } else {
    // 无行时从上游推断
    for (const input of inputs) {
      if (input.length > 0) {
        fields = inferFieldsFromRows(input)
        break
      }
    }
  }

  return { rows, fields }
}

/**
 * 2. 执行单个节点
 *
 * 单输入节点（filter/calculate/aggregate/bin/sort/output）使用 inputData，
 * 多输入节点（join/union）使用 allInputs 数组。
 *
 * @param node        待执行节点
 * @param inputData   上游节点输出的行数据（扁平化后，单输入节点使用）
 * @param allInputs   所有上游输入的数组（join/union/excelExport 等多输入节点使用）
 * @param sourceNodes 上游节点列表（与 allInputs 一一对应，excelExport 用于生成 sheet 名）
 * @returns 节点输出 { rows, fields }
 */
export async function executeNode(
  node: PipelineNode,
  inputData: Record<string, any>[],
  allInputs?: Record<string, any>[][],
  sourceNodes?: (PipelineNode | undefined)[],
): Promise<NodeOutput> {
  const type = node.type

  switch (type) {
    case 'dataSource':
      return executeDataSource(node)
    case 'filter':
      return executeFilter(node, inputData)
    case 'calculate':
      return executeCalculate(node, inputData)
    case 'aggregate':
      return executeAggregate(node, inputData)
    case 'bin':
      return executeBin(node, inputData)
    case 'sort':
      return executeSort(node, inputData)
    case 'selectColumns':
      return executeSelectColumns(node, inputData)
    case 'join':
      return executeJoin(node, allInputs ?? [inputData])
    case 'union':
      return executeUnion(node, allInputs ?? [inputData])
    case 'output':
      // 直接透传（浅拷贝行对象，避免下游修改影响上游缓存）
      return {
        rows: inputData.map((r) => ({ ...r })),
        fields: inferFieldsSafe(inputData, inputData),
      }
    case 'excelExport': {
      // 导出节点：保留各上游输出为独立 sheet，供上层 UI 生成多 sheet Excel
      const inputs = allInputs && allInputs.length > 0 ? allInputs : [inputData]
      const srcNodes = sourceNodes && sourceNodes.length > 0 ? sourceNodes : []

      const sheets = inputs.map((rows, i) => {
        const srcNode = srcNodes[i]
        const label = (srcNode?.data?.label as string) || nodeTypeLabel(srcNode?.type) || `输入${i + 1}`
        const fields = inferFieldsSafe(rows, rows)
        return {
          name: label,
          rows: rows.map((r) => ({ ...r })),
          fields,
        }
      })

      // 合并行用于画布预览（sheet 明细仍保留在 sheets 中）
      return {
        rows: sheets.flatMap((s) => s.rows),
        fields: sheets[0]?.fields ?? inferFieldsSafe(inputData, inputData),
        sheets,
      }
    }
    case 'pptExport': {
      // PPT 导出节点：与 excelExport 一致，保留各上游输出为独立数据区块（sheet）
      const inputs = allInputs && allInputs.length > 0 ? allInputs : [inputData]
      const srcNodes = sourceNodes && sourceNodes.length > 0 ? sourceNodes : []

      const sheets = inputs.map((rows, i) => {
        const srcNode = srcNodes[i]
        const label = (srcNode?.data?.label as string) || nodeTypeLabel(srcNode?.type) || `输入${i + 1}`
        const fields = inferFieldsSafe(rows, rows)
        return {
          name: label,
          rows: rows.map((r) => ({ ...r })),
          fields,
        }
      })

      return {
        rows: sheets.flatMap((s) => s.rows),
        fields: sheets[0]?.fields ?? inferFieldsSafe(inputData, inputData),
        sheets,
      }
    }
    default:
      // 未知节点类型：原样透传
      return {
        rows: inputData.map((r) => ({ ...r })),
        fields: inferFieldsSafe(inputData, inputData),
      }
  }
}

// ---------------------------------------------------------------------------
// 3. 执行整个流水线
// ---------------------------------------------------------------------------

/**
 * 执行整个流水线：
 *  1. 对节点做拓扑排序
 *  2. 按序执行每个节点；非 dataSource 节点从上游节点输出获取输入
 *  3. 返回每个节点 id -> 输出结果 的 Map
 *
 * @param nodes React Flow 节点列表
 * @param edges React Flow 边列表
 * @returns Map<nodeId, { rows, fields }>
 */
export async function executePipeline(
  nodes: PipelineNode[],
  edges: Edge[],
): Promise<Map<string, NodeOutput>> {
  const sorted = topologicalSort(nodes, edges)
  const results = new Map<string, NodeOutput>()
  const nodeMap = new Map<string, PipelineNode>(nodes.map((n) => [n.id, n]))

  // 构建入边索引：target -> source[]
  const incoming = new Map<string, string[]>()
  for (const edge of edges) {
    if (!incoming.has(edge.target)) incoming.set(edge.target, [])
    incoming.get(edge.target)!.push(edge.source)
  }

  for (const node of sorted) {
    const sources = incoming.get(node.id) || []
    // 为多输入节点（join/union）保留各上游的独立输出
    const allInputs: Record<string, any>[][] = sources.map(
      (src) => results.get(src)?.rows ?? [],
    )
    // 上游节点列表（excelExport 用于生成 sheet 名）
    const sourceNodes: (PipelineNode | undefined)[] = sources.map((src) => nodeMap.get(src))
    // 单输入节点使用扁平化后的数据
    const inputData: Record<string, any>[] = allInputs.flat()
    const output = await executeNode(node, inputData, allInputs, sourceNodes)
    results.set(node.id, output)
  }

  return results
}
