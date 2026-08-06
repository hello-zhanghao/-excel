/**
 * 字段类型枚举
 */
export enum FieldKind {
  Dimension = 'dimension',  // 维度（离散型：分类、文本、日期）
  Measure = 'measure',      // 度量（连续型：数值、可聚合）
}

/**
 * 字段的数据类型
 */
export type DataType = 'string' | 'number' | 'date' | 'boolean'

/**
 * 聚合方式
 */
export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct'

/**
 * 字段元信息
 */
export interface FieldMeta {
  name: string
  dataType: DataType
  kind: FieldKind
  /** 示例值（用于侧边栏预览） */
  sample?: string[]
}

/**
 * 编码槽类型 —— 对应 Tableau 的 Shelves 模型
 */
export type SlotName = 'x' | 'y' | 'color' | 'size' | 'filter'

/**
 * 编码槽配置：一个槽位上放置的字段及其聚合方式
 */
export interface EncodingItem {
  field: string
  aggregation: Aggregation
}

/**
 * 整体编码配置
 */
export interface EncodingConfig {
  x?: EncodingItem
  y?: EncodingItem
  color?: EncodingItem
  size?: EncodingItem
  filter?: { field: string; values: string[] }
}

/**
 * 图表类型
 */
export type ChartType = 'bar' | 'line' | 'scatter' | 'pie' | 'area' | 'map' | 'auto'

/**
 * 查询结果行
 */
export type QueryRow = Record<string, string | number | boolean | null>

/**
 * 查询结果集
 */
export interface QueryResult {
  columns: string[]
  rows: QueryRow[]
  /** 查询耗时 ms */
  elapsed?: number
}

/**
 * 仪表盘 Y 轴字段配置 —— 每个字段独立聚合方式与图表样式
 */
export interface DashboardYField {
  id: string
  field: string
  aggregation: Aggregation
  /** 每个 Y 字段独立的图表类型：柱状 / 折线 / 面积 */
  chartType: 'bar' | 'line' | 'area'
}

/**
 * 仪表盘数据源目录项
 * 卡片可在此目录中选择任意数据源进行绘制
 */
export interface CatalogTable {
  /** 数据源唯一键（对应表名） */
  key: string
  /** 展示名称 */
  name: string
  rows: Record<string, any>[]
  fields: FieldMeta[]
}

/**
 * 仪表盘图表卡片 —— 独立数据源、多 X 轴、多 Y 轴（每 Y 独立图表类型）
 */
export interface DashboardChart {
  id: string
  title: string
  /** 所选数据源 key（对应数据源目录） */
  dataSource: string
  /** 多 X 轴字段 */
  xFields: string[]
  /** 多 Y 轴字段（每项独立聚合 + 图表类型） */
  yFields: DashboardYField[]
}

/**
 * 数据源抽象接口
 * 桌面端走 Node DuckDB，Web 端走 SheetJS + JS 聚合
 */
export interface DataSource {
  /** 加载文件（桌面端传路径，Web 端传 File 对象） */
  loadFile(source: string | File): Promise<void>
  /** 直接加载行数组（用于内置示例数据集） */
  loadRows(rows: Record<string, any>[], name: string): Promise<void>
  /** 获取字段元信息 */
  getSchema(): Promise<FieldMeta[]>
  /** 执行 SQL 查询 */
  query(sql: string): Promise<QueryResult>
  /** 获取表名 */
  getTableName(): string
  /** 是否已加载 */
  isLoaded(): boolean
}

/**
 * 运行环境
 */
export type RuntimeEnv = 'electron' | 'web'

/**
 * 检测当前运行环境
 */
export function detectEnv(): RuntimeEnv {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return 'electron'
  }
  return 'web'
}
