import type { Node } from '@xyflow/react'
import type { Aggregation } from '@/types'

/**
 * 流水线节点类型枚举
 * 对应 React Flow 画布上不同种类的数据处理节点
 */
export type PipelineNodeType =
  | 'dataSource' // 数据源：从内置数据集加载
  | 'filter'     // 过滤：按条件筛除行
  | 'calculate'  // 计算：基于表达式派生新字段
  | 'aggregate'  // 聚合：分组 + 度量聚合
  | 'bin'        // 分箱：数值字段离散化
  | 'sort'       // 排序
  | 'selectColumns' // 列筛选：只保留选中的列
  | 'join'       // 关联：按字段连接两表（inner/left/right/full）
  | 'union'      // 合并：纵向堆叠多表行
  | 'output'     // 输出：透传结果
  | 'excelExport' // 导出 Excel：把上游数据导出为 .xlsx 文件
  | 'pptExport'  // 导出 PPT：基于 PPT 模板 + 上游数据,替换生成 .pptx 文件

/**
 * 过滤操作符
 */
export type FilterOperator = 'gt' | 'lt' | 'eq' | 'neq' | 'gte' | 'lte' | 'in' | 'contains'

/**
 * 单个过滤条件
 */
export interface FilterCondition {
  /** 字段名 */
  field: string
  /** 比较操作符 */
  operator: FilterOperator
  /** 比较目标值；in 操作符时为任意数组，contains 时为字符串/数字 */
  value: any
}

/**
 * 过滤节点配置
 */
export interface FilterConfig {
  /** 过滤条件列表 */
  conditions: FilterCondition[]
  /** 条件之间的逻辑关系，默认 AND */
  logic?: 'AND' | 'OR'
}

/**
 * 计算节点配置 —— 用表达式对每行数据派生新字段
 */
export interface CalculateConfig {
  /** 新字段名 */
  newField: string
  /** 表达式，如 "profit / sales * 100"，可用行内任意字段参与四则运算 */
  expression: string
}

/**
 * 聚合度量
 */
export interface AggregateMeasure {
  /** 度量字段名 */
  field: string
  /** 聚合方式 */
  aggregation: Aggregation
  /** 输出字段别名，默认 `${aggregation}_${field}` */
  alias?: string
}

/**
 * 聚合节点配置
 */
export interface AggregateConfig {
  /** 分组字段 */
  groupBy: string[]
  /** 待聚合的度量 */
  measures: AggregateMeasure[]
}

/**
 * 分箱方法
 * - equalWidth: 等宽分箱（按 min/max 等分）
 * - equalFreq:  等频分箱（按分位数划分）
 */
export type BinMethod = 'equalWidth' | 'equalFreq'

/**
 * 分箱节点配置
 */
export interface BinConfig {
  /** 待分箱的数值字段 */
  field: string
  /** 分箱数量 */
  bins: number
  /** 分箱方法 */
  method: BinMethod
}

/**
 * 排序方向
 */
export type SortOrder = 'asc' | 'desc'

/**
 * 排序节点配置
 */
export interface SortConfig {
  /** 排序字段 */
  field: string
  /** 升序 / 降序 */
  order: SortOrder
}

/**
 * 列筛选节点配置 —— 只保留选中的列
 *
 * 从上游数据字段中勾选要输出的列，未勾选的列会被丢弃。
 * fields 为空时表示保留全部列（透传）。
 */
export interface SelectColumnsConfig {
  /** 要保留的字段名列表；空数组表示透传全部列 */
  fields: string[]
}

/**
 * 数据源节点配置
 *
 * 两种数据来源（二选一）：
 * - datasetId: 选择内置示例数据集
 * - fileName + rows: 上传/拖拽的文件内容（rows 为解析后的行数组）
 */
export interface DataSourceConfig {
  /** SAMPLE_DATASETS 中的数据集 id */
  datasetId?: string
  /** 上传文件的文件名（如 sales.xlsx）；存在时表示使用文件数据 */
  fileName?: string
  /** 上传文件解析后的行数组（缓存于节点配置，供引擎直接使用） */
  rows?: Record<string, any>[]
}

/**
 * Join 类型
 * - inner:  内连接，只保留两表都匹配的行
 * - left:   左连接，保留左表全部行 + 右表匹配行
 * - right:  右连接，保留右表全部行 + 左表匹配行
 * - full:   全外连接，保留两表全部行
 */
export type JoinType = 'inner' | 'left' | 'right' | 'full'

/**
 * Join 节点配置 —— 按字段关联两表
 *
 * 左表 = 第一个连入的上游节点输出
 * 右表 = 第二个连入的上游节点输出
 */
export interface JoinConfig {
  /** 左表关联字段 */
  leftKey: string
  /** 右表关联字段 */
  rightKey: string
  /** 关联类型 */
  joinType: JoinType
}

/**
 * Union 节点配置 —— 纵向合并多表
 *
 * 将所有上游节点的行堆叠在一起，字段取并集，
 * 缺失字段补 null。
 */
export interface UnionConfig {
  /** 是否去重（基于所有字段的完全匹配） */
  distinct?: boolean
}

/**
 * 输出节点配置
 */
export interface OutputConfig {
  /** 输出名称（可选，便于在 UI 上展示） */
  name?: string
}

/**
 * 导出 Excel 节点配置
 */
export interface ExcelExportConfig {
  /** 导出文件名（不含扩展名），默认用节点标签 */
  filename?: string
  /** 是否在文件名追加时间戳，默认 true */
  addTimestamp?: boolean
}

/**
 * 导出 PPT 节点配置
 *
 * 基于一个 PPT 模板，把上游数据(每个上游作为模板的一个数据区块/sheet)
 * 替换到模板占位符中，生成新的 .pptx。
 *
 * 执行引擎：
 * - 桌面端：通过 Electron IPC 调用本地 Python(excel2ppt 的 template_filler) 真正替换
 * - 网页端：仅配置与预览，实际替换需桌面端
 */
export interface PptExportConfig {
  /** PPT 模板文件路径（桌面端选择；网页端通过上传获得） */
  templatePath?: string
  /** 模板文件名（展示用） */
  templateName?: string
  /** 输出文件名（不含扩展名），默认用节点标签 */
  outputName?: string
  /** 是否在文件名追加时间戳，默认 true */
  addTimestamp?: boolean
  /** 图片/数据搜索目录（桌面端，可选；用于模板中的图片占位符） */
  imageDir?: string
  /** 网页端上传的模板文件（cache），桌面端不设置 */
  templateFile?: File
  /** 是否标记缺失占位符，默认 true */
  markMissing?: boolean
}

/**
 * 节点配置联合类型 —— 与节点 type 一一对应
 */
export type NodeConfig =
  | DataSourceConfig
  | FilterConfig
  | CalculateConfig
  | AggregateConfig
  | BinConfig
  | SortConfig
  | SelectColumnsConfig
  | JoinConfig
  | UnionConfig
  | OutputConfig
  | ExcelExportConfig
  | PptExportConfig

/**
 * 流水线节点携带的数据
 */
export interface PipelineNodeData extends Record<string, unknown> {
  /** 节点显示标签 */
  label?: string
  /** 与节点 type 对应的配置 */
  config: NodeConfig
}

/**
 * 流水线节点 —— 在 React Flow Node 基础上约束 data 与 type
 */
export type PipelineNode = Node<PipelineNodeData, PipelineNodeType>

/**
 * 单个导出 sheet 的数据（excelExport 节点多输入时，每个上游输出一个 sheet）
 */
export interface ExportSheet {
  /** sheet 名（默认取上游节点标签） */
  name: string
  rows: Record<string, any>[]
  fields: import('@/types').FieldMeta[]
}

/**
 * 单个节点执行后的输出
 */
export interface NodeOutput {
  rows: Record<string, any>[]
  fields: import('@/types').FieldMeta[]
  /** excelExport 节点多输入时，每路输入对应一个 sheet；其余节点不设置 */
  sheets?: ExportSheet[]
}
