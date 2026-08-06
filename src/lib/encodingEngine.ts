import type { EncodingConfig, FieldMeta, ChartType, Aggregation } from '@/types'
import { FieldKind } from '@/types'

/**
 * 编码映射引擎 —— 整个工具的灵魂
 *
 * 职责：
 * 1. 根据编码槽配置 + 字段元信息 → 推断图表类型
 * 2. 根据编码槽配置 → 生成 SQL 查询语句
 * 3. 根据编码槽配置 + 查询结果 → 生成 G2 图表 spec
 */

const AGG_SQL: Record<Aggregation, string> = {
  sum: 'SUM',
  avg: 'AVG',
  count: 'COUNT',
  min: 'MIN',
  max: 'MAX',
  count_distinct: 'COUNT(DISTINCT',
}

/**
 * 推断图表类型
 * 规则：
 * - X=维度, Y=度量       → 柱状图 (bar)
 * - X=日期维度, Y=度量   → 折线图 (line)
 * - X=度量, Y=度量       → 散点图 (scatter)
 * - 仅 Color=维度 + Y=度量 → 饼图 (pie)
 * - X=维度, Y=度量, Color=维度 → 分组柱状图
 * - X=经度, Y=纬度       → 地图 (map)
 */
export function inferChartType(
  config: EncodingConfig,
  fields: FieldMeta[]
): ChartType {
  const xField = config.x ? fields.find((f) => f.name === config.x!.field) : undefined
  const yField = config.y ? fields.find((f) => f.name === config.y!.field) : undefined
  const hasColor = !!config.color

  if (!xField && !yField) return 'auto'
  if (!yField) return 'auto'

  // 经纬度对 → 地图散点
  if (xField && yField && isLonLatPair(xField.name, yField.name)) {
    return 'map'
  }

  if (!xField && hasColor) return 'pie'
  if (!xField) return 'auto'

  // X 是日期 → 折线/面积
  if (xField.dataType === 'date') {
    return hasColor ? 'line' : 'line'
  }

  // X 和 Y 都是度量 → 散点
  if (xField.kind === FieldKind.Measure && yField.kind === FieldKind.Measure) {
    return 'scatter'
  }

  // 默认：维度 × 度量 → 柱状图
  return 'bar'
}

/** 常见的经度 / 纬度字段名 */
const LON_NAMES = ['longitude', 'lng', 'lon', '经度']
const LAT_NAMES = ['latitude', 'lat', '纬度']

/**
 * 判断两个字段名是否构成"经度 × 纬度"对
 * 同时校验字段值域：经度应在 [-180, 180]，纬度应在 [-90, 90]
 */
export function isLonLatPair(xName: string, yName: string): boolean {
  const x = xName.toLowerCase()
  const y = yName.toLowerCase()
  const xLon = LON_NAMES.some((n) => x.includes(n))
  const yLat = LAT_NAMES.some((n) => y.includes(n))
  const xLat = LAT_NAMES.some((n) => x.includes(n))
  const yLon = LON_NAMES.some((n) => y.includes(n))
  return (xLon && yLat) || (xLat && yLon)
}

/**
 * 生成 SQL 查询
 * 根据编码槽配置，生成带 GROUP BY 和聚合的 SQL
 */
export function generateSQL(
  config: EncodingConfig,
  tableName: string,
  fields: FieldMeta[]
): string {
  const selectParts: string[] = []
  const groupByParts: string[] = []
  const whereParts: string[] = []

  // 经纬度对 → 地图：直接取原始行，保留每个点的完整信息（站名/城市/指标）
  if (config.x && config.y && isLonLatPair(config.x.field, config.y.field)) {
    return rawSelectSql(tableName, config)
  }

  // 散点图：X、Y 都是度量 → 不聚合，直接取原始数据点
  const xMeta = config.x ? fields.find((f) => f.name === config.x!.field) : undefined
  const yMeta = config.y ? fields.find((f) => f.name === config.y!.field) : undefined
  if (
    config.x && config.y &&
    xMeta?.kind === FieldKind.Measure && yMeta?.kind === FieldKind.Measure
  ) {
    return rawSelectSql(tableName, config)
  }

  // Filter
  if (config.filter && config.filter.values.length > 0) {
    const vals = config.filter.values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')
    whereParts.push(`${config.filter.field} IN (${vals})`)
  }

  // X 槽
  if (config.x) {
    const field = fields.find((f) => f.name === config.x!.field)
    if (field?.kind === FieldKind.Measure && config.x.aggregation) {
      const aggFn = AGG_SQL[config.x.aggregation]
      const suffix = config.x.aggregation === 'count_distinct' ? ')' : ''
      selectParts.push(`${aggFn}("${config.x.field}")${suffix} AS "${config.x.field}"`)
    } else {
      selectParts.push(`"${config.x.field}"`)
      groupByParts.push(`"${config.x.field}"`)
    }
  }

  // Y 槽
  if (config.y) {
    const field = fields.find((f) => f.name === config.y!.field)
    if (field?.kind === FieldKind.Measure && config.y.aggregation) {
      const aggFn = AGG_SQL[config.y.aggregation]
      const suffix = config.y.aggregation === 'count_distinct' ? ')' : ''
      const alias = `${config.y.aggregation}_${config.y.field}`
      selectParts.push(`${aggFn}("${config.y.field}")${suffix} AS "${alias}"`)
    } else {
      selectParts.push(`"${config.y.field}"`)
      groupByParts.push(`"${config.y.field}"`)
    }
  }

  // Color 槽（额外分组维度）
  if (config.color) {
    selectParts.push(`"${config.color.field}"`)
    groupByParts.push(`"${config.color.field}"`)
  }

  // Size 槽（额外度量）
  if (config.size) {
    const field = fields.find((f) => f.name === config.size!.field)
    if (field?.kind === FieldKind.Measure && config.size.aggregation) {
      const aggFn = AGG_SQL[config.size.aggregation]
      const suffix = config.size.aggregation === 'count_distinct' ? ')' : ''
      const alias = `${config.size.aggregation}_${config.size.field}`
      selectParts.push(`${aggFn}("${config.size.field}")${suffix} AS "${alias}"`)
    }
  }

  if (selectParts.length === 0) {
    return `SELECT * FROM ${tableName} LIMIT 100`
  }

  let sql = `SELECT ${selectParts.join(', ')} FROM ${tableName}`
  if (whereParts.length > 0) {
    sql += ` WHERE ${whereParts.join(' AND ')}`
  }
  if (groupByParts.length > 0) {
    sql += ` GROUP BY ${groupByParts.join(', ')}`
  }
  sql += ` LIMIT ${MAX_SQL_RESULT_ROWS}`

  return sql
}

/** SQL 查询结果最大返回行数（十万行级） */
export const MAX_SQL_RESULT_ROWS = 100000

/**
 * 生成"取原始行"的 SQL（用于散点图 / 地图等需要逐点数据的图表）
 * 保留所有字段，仅应用筛选，不聚合
 */
function rawSelectSql(tableName: string, config: EncodingConfig): string {
  let sql = `SELECT * FROM ${tableName}`
  if (config.filter && config.filter.values.length > 0) {
    const vals = config.filter.values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')
    sql += ` WHERE ${config.filter.field} IN (${vals})`
  }
  sql += ` LIMIT ${MAX_SQL_RESULT_ROWS}`
  return sql
}

/**
 * 生成 G2 图表配置
 * 将编码槽配置映射为 G2 的 mark + encode 模型
 */
export function generateG2Spec(
  config: EncodingConfig,
  chartType: ChartType,
  fields: FieldMeta[]
): Record<string, any> {
  const encode: Record<string, string> = {}

  // Y 字段别名
  const yAlias = config.y && config.y.aggregation && config.y.aggregation !== 'count'
    ? `${config.y.aggregation}_${config.y.field}`
    : config.y?.field

  if (config.x) encode.x = config.x.field
  if (yAlias) encode.y = yAlias
  if (config.color) encode.color = config.color.field

  // Size 槽
  if (config.size) {
    const sizeAlias = config.size.aggregation
      ? `${config.size.aggregation}_${config.size.field}`
      : config.size.field
    encode.size = sizeAlias
  }

  // G2 v5 mark 类型映射
  // bar → interval, scatter → point, 其他保持原名
  const G2_MARK_MAP: Record<string, string> = {
    bar: 'interval',
    scatter: 'point',
    line: 'line',
    area: 'area',
    pie: 'interval',
  }
  const rawType = chartType === 'auto' ? 'bar' : chartType
  const markType = G2_MARK_MAP[rawType] || rawType

  const spec: Record<string, any> = {
    type: markType,
    encode,
  }

  // 柱状图样式
  if (rawType === 'bar') {
    spec.style = { fillOpacity: 0.85, radius: 4 }
  }

  // 折线图样式
  if (rawType === 'line') {
    spec.style = { lineWidth: 2 }
    spec.encode = { ...encode, shape: 'smooth' }
  }

  // 饼图：G2 中用 interval + theta 坐标系
  if (rawType === 'pie') {
    spec.type = 'interval'
    spec.transform = [{ type: 'stackY' }]
    spec.coordinate = { type: 'theta', outerRadius: 0.8 }
    spec.style = { stroke: 'white', lineWidth: 2 }
    // 饼图时 color 编码就是分类，y 是值
    if (config.color) {
      spec.encode = {
        y: yAlias,
        color: config.color.field,
      }
    }
  }

  return spec
}
