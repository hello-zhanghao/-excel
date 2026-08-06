import type { NodeTypes } from '@xyflow/react'

export { BaseNode } from './BaseNode'
export type { BaseNodeProps, NodeStatus } from './BaseNode'
export {
  nodeInputStyle,
  nodeSelectStyle,
  nodeButtonStyle,
  nodeIconButtonStyle,
  nodeLabelStyle,
} from './BaseNode'

export { DataSourceNode } from './DataSourceNode'
export { FilterNode } from './FilterNode'
export { CalculateNode } from './CalculateNode'
export { AggregateNode } from './AggregateNode'
export { BinNode } from './BinNode'
export { SortNode } from './SortNode'
export { SelectColumnsNode } from './SelectColumnsNode'
export { JoinNode } from './JoinNode'
export { UnionNode } from './UnionNode'
export { OutputNode } from './OutputNode'
export { ExcelExportNode } from './ExcelExportNode'

import { DataSourceNode } from './DataSourceNode'
import { FilterNode } from './FilterNode'
import { CalculateNode } from './CalculateNode'
import { AggregateNode } from './AggregateNode'
import { BinNode } from './BinNode'
import { SortNode } from './SortNode'
import { SelectColumnsNode } from './SelectColumnsNode'
import { JoinNode } from './JoinNode'
import { UnionNode } from './UnionNode'
import { OutputNode } from './OutputNode'
import { ExcelExportNode } from './ExcelExportNode'

/**
 * React Flow 节点类型注册表
 *
 * 传给 <ReactFlow nodeTypes={nodeTypes} />。
 * 键名与 PipelineNodeType 一一对应（dataSource / filter / calculate /
 * aggregate / bin / sort / join / union / output / excelExport）。
 *
 * 注意：nodeTypes 对象需在组件外定义，避免每次渲染重新创建导致
 * React Flow 警告 "Only one instance of nodeTypes should be defined"。
 */
export const nodeTypes: NodeTypes = {
  dataSource: DataSourceNode,
  filter: FilterNode,
  calculate: CalculateNode,
  aggregate: AggregateNode,
  bin: BinNode,
  sort: SortNode,
  selectColumns: SelectColumnsNode,
  join: JoinNode,
  union: UnionNode,
  output: OutputNode,
  excelExport: ExcelExportNode,
}

export default nodeTypes
