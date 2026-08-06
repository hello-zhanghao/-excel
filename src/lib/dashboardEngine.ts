import type { DashboardYField, DashboardMapConfig, FieldMeta, QueryResult } from '@/types'

/**
 * 仪表盘查询与图表生成引擎
 *
 * 与单图表引擎不同，仪表盘卡片支持：
 * - 独立数据源（多 X 轴字段分组）
 * - 多 Y 轴字段（每个字段独立聚合）
 * - 每个 Y 字段独立图表类型（柱状/折线/面积 组合图）
 *
 * 直接在原始行数组上做 JS 增量聚合，不依赖全局单一数据源的 SQL 引擎
 */

const AGG: Record<string, (values: number[], count: number, distinct: Set<string>) => number> = {
  sum: (v) => v.reduce((a, b) => a + b, 0),
  avg: (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0),
  count: (_v, count) => count,
  min: (v) => (v.length ? Math.min(...v) : 0),
  max: (v) => (v.length ? Math.max(...v) : 0),
  count_distinct: (_v, _c, distinct) => distinct.size,
}

/** 计算 Y 字段聚合后的列别名 */
export function dashboardYAlias(y: DashboardYField): string {
  return y.aggregation ? `${y.aggregation}_${y.field}` : y.field
}

/**
 * 对指定数据源执行多 X / 多 Y 聚合查询
 * 返回行：每行含 __x__（组合分类标签）、各 X 字段原值、各 Y 聚合别名值
 */
export function queryDashboard(
  rows: Record<string, any>[],
  xFields: string[],
  yFields: DashboardYField[]
): QueryResult {
  const columns: string[] = ['__x__', ...xFields, ...yFields.map(dashboardYAlias)]
  if (rows.length === 0 || yFields.length === 0) {
    return { columns, rows: [], elapsed: 0 }
  }

  const start = performance.now()

  interface Acc {
    sums: Record<string, number>
    counts: Record<string, number>
    mins: Record<string, number>
    maxs: Record<string, number>
    distincts: Record<string, Set<string>>
  }

  const makeAcc = (): Acc => ({
    sums: {}, counts: {}, mins: {}, maxs: {}, distincts: {},
  })

  const groups = new Map<string, Acc>()

  for (const row of rows) {
    const key = xFields.map((f) => String(row[f] ?? '')).join('\u0001')
    let acc = groups.get(key)
    if (!acc) {
      acc = makeAcc()
      groups.set(key, acc)
    }
    for (const y of yFields) {
      const raw = row[y.field]
      if (raw == null || raw === '') continue
      const num = Number(raw)
      if (!isNaN(num)) {
        acc.sums[y.id] = (acc.sums[y.id] ?? 0) + num
        acc.counts[y.id] = (acc.counts[y.id] ?? 0) + 1
        if (acc.mins[y.id] === undefined || num < acc.mins[y.id]) acc.mins[y.id] = num
        if (acc.maxs[y.id] === undefined || num > acc.maxs[y.id]) acc.maxs[y.id] = num
      }
      if (!acc.distincts[y.id]) acc.distincts[y.id] = new Set<string>()
      acc.distincts[y.id].add(String(raw))
    }
  }

  const resultRows: Record<string, any>[] = []
  for (const [key, acc] of groups) {
    const keyParts = key ? key.split('\u0001') : []
    const row: Record<string, any> = { __x__: keyParts.join(' / ') }
    xFields.forEach((f, i) => {
      row[f] = keyParts[i]
    })
    yFields.forEach((y) => {
      const values = acc.sums[y.id] !== undefined ? [acc.sums[y.id]] : []
      const count = acc.counts[y.id] ?? 0
      const distinct = acc.distincts[y.id] ?? new Set<string>()
      const finalize = AGG[y.aggregation]
      const value = finalize(values, count, distinct)
      row[dashboardYAlias(y)] = value
    })
    resultRows.push(row)
  }

  return {
    columns,
    rows: resultRows,
    elapsed: Math.round(performance.now() - start),
  }
}

/**
 * 生成组合图表 ECharts option
 * 每个 Y 字段对应一个独立系列，可混合柱状图 / 折线图 / 面积图
 */
export function generateDashboardOption(
  xFields: string[],
  yFields: DashboardYField[],
  result: QueryResult
): Record<string, any> {
  const rows = result.rows
  if (rows.length === 0) return {}

  const xData = rows.map((r) => String(r.__x__ ?? ''))

  const series = yFields.map((y) => {
    const type = y.chartType === 'area' ? 'line' : y.chartType
    const isLine = y.chartType !== 'bar'
    return {
      name: y.aggregation ? `${y.aggregation}(${y.field})` : y.field,
      type,
      data: rows.map((r) => Number(r[dashboardYAlias(y)] ?? 0)),
      smooth: isLine,
      areaStyle: y.chartType === 'area' ? { opacity: 0.25 } : undefined,
      itemStyle: y.chartType === 'bar' ? { borderRadius: [3, 3, 0, 0] } : undefined,
      sampling: isLine ? 'lttb' : undefined,
    }
  })

  return {
    tooltip: { trigger: 'axis' },
    legend: { data: series.map((s) => s.name), top: 8, type: 'scroll' },
    grid: { left: 60, right: 30, top: 40, bottom: 50 },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: xData.length > 8 ? 30 : 0 },
    },
    yAxis: { type: 'value' },
    series,
    animation: xData.length < 5000,
  }
}

/** 获取字段的默认聚合方式：度量 → sum，维度 → count */
export function defaultAggregation(fields: FieldMeta[], fieldName: string): DashboardYField['aggregation'] {
  const f = fields.find((x) => x.name === fieldName)
  return f && f.kind === 'measure' ? 'sum' : 'count'
}

/**
 * 生成地图打点 ECharts option（geo + scatter）
 * 直接取原始行，不聚合；经度落在 [-180,180]、纬度落在 [-90,90] 才作为有效点
 */
export function generateDashboardMapOption(
  map: DashboardMapConfig,
  rows: Record<string, any>[]
): Record<string, any> {
  const { lonField, latField, nameField, sizeField } = map
  const data: any[] = []
  for (const r of rows) {
    const lng = Number(r[lonField])
    const lat = Number(r[latField])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) continue
    const point: any = {
      name: nameField ? String(r[nameField] ?? '') : `${lng}, ${lat}`,
      value: [lng, lat],
      raw: r,
    }
    if (sizeField) {
      const s = Number(r[sizeField] ?? 0)
      point.value.push(Number.isFinite(s) ? s : 0)
    }
    data.push(point)
  }

  // 尺寸值域 → 气泡缩放
  const sizeValues = sizeField
    ? data.map((p) => Number(p.value[2])).filter((n) => Number.isFinite(n))
    : []
  const sizeMin = sizeValues.length ? Math.min(...sizeValues) : 0
  const sizeMax = sizeValues.length ? Math.max(...sizeValues) : 1
  const sizeSpan = sizeMax - sizeMin || 1
  const symbolSize = sizeField
    ? (val: any) => 6 + ((Number(val[2]) - sizeMin) / sizeSpan) * 22
    : 8

  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const raw = p.data && p.data.raw
        if (!raw) return `${p.name}`
        const lines = [`<b>${raw[nameField ?? ''] || p.name}</b>`]
        if (lonField) lines.push(`${lonField}: ${raw[lonField]}`)
        if (latField) lines.push(`${latField}: ${raw[latField]}`)
        if (sizeField) lines.push(`${sizeField}: ${raw[sizeField]}`)
        return lines.join('<br/>')
      },
    },
    geo: {
      map: 'china',
      roam: true,
      zoom: 1.1,
      scaleLimit: { min: 1, max: 12 },
      label: { show: false },
      itemStyle: {
        areaColor: '#eef0f6',
        borderColor: '#c5c9d6',
        borderWidth: 0.6,
      },
      emphasis: {
        label: { show: false },
        itemStyle: { areaColor: '#dfe3ee' },
      },
      select: { disabled: true },
    },
    series: [{
      type: 'scatter',
      coordinateSystem: 'geo',
      data,
      symbolSize,
      itemStyle: { color: '#f97316', opacity: 0.85 },
      emphasis: { scale: 1.4 },
    }],
    animation: data.length < 5000,
  }
}