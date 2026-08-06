import { useStore } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { SAMPLE_DATASETS, inferFieldsFromRows } from '@/data/sampleDatasets'
import type { PipelineNodeData } from '@/types/pipeline'

/**
 * 从某个节点解析出可用的字段名列表
 *
 * 优先级：
 * 1. 节点已执行过 → 使用缓存的 preview.fields
 * 2. 数据源节点 → 从内置数据集推断
 * 3. 其他情况 → 空列表
 */
function resolveNodeFields(node: Node<PipelineNodeData> | undefined): string[] {
  if (!node) return []

  const data = node.data as PipelineNodeData & {
    preview?: { fields?: { name: string }[] }
  }

  // 已执行的节点：直接读缓存字段
  if (data.preview?.fields?.length) {
    return data.preview.fields.map((f) => f.name)
  }

  // 数据源节点：优先从上传文件的行数据推断，其次从数据集推断
  if (node.type === 'dataSource') {
    const dsConfig = data.config as { datasetId?: string; rows?: Record<string, any>[] }
    if (dsConfig.rows && dsConfig.rows.length > 0) {
      return inferFieldsFromRows(dsConfig.rows).map((f) => f.name)
    }
    const dataset = SAMPLE_DATASETS.find((d) => d.id === dsConfig.datasetId)
    if (dataset) {
      return inferFieldsFromRows(dataset.rows).map((f) => f.name)
    }
  }

  return []
}

/**
 * 获取当前节点的所有上游节点字段（去重有序）
 *
 * 通过 React Flow 的 store 响应式读取边与节点：
 * - 找到所有连接到当前节点的边（target === nodeId）
 * - 收集这些上游节点的输出字段并去重
 *
 * 用于把节点配置里的字段输入改为「从入口数据下拉选择」。
 */
export function useUpstreamFields(nodeId: string): string[] {
  const edges = useStore((s) => s.edges)
  const nodes = useStore((s) => s.nodes)

  const sourceIds = edges
    .filter((e) => e.target === nodeId)
    .map((e) => e.source)

  const fields: string[] = []
  const seen = new Set<string>()

  for (const sid of sourceIds) {
    const node = nodes.find((n) => n.id === sid) as
      | Node<PipelineNodeData>
      | undefined
    for (const f of resolveNodeFields(node)) {
      if (!seen.has(f)) {
        seen.add(f)
        fields.push(f)
      }
    }
  }

  return fields
}