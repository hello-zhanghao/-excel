import type { EncodingConfig, FieldMeta, ChartType, QueryResult } from '@/types'
import { FieldKind } from '@/types'

/**
 * ECharts 配置生成器
 * 将编码槽配置 + 查询结果 → ECharts option
 */

export function generateEChartsOption(
  config: EncodingConfig,
  chartType: ChartType,
  fields: FieldMeta[],
  queryResult: QueryResult
): Record<string, any> {
  const rows = queryResult.rows
  if (rows.length === 0) return {}

  // 计算 X/Y/Size 槽聚合后的列别名（维度字段取原始列名，度量字段取 ${agg}_${field}）
  const yMeta = config.y ? fields.find((f) => f.name === config.y!.field) : undefined
  const yIsMeasure = !!yMeta && yMeta.kind === FieldKind.Measure
  const yAlias = config.y && yIsMeasure && config.y.aggregation
    ? `${config.y.aggregation}_${config.y.field}`
    : config.y?.field || ''

  const xField = config.x?.field || ''
  const colorField = config.color?.field || ''

  // 地图（geo 坐标系散点）：X=经度, Y=纬度
  if (chartType === 'map') {
    const lonField = xField
    const latField = config.y?.field || ''
    const nameField = colorField
    const sizeField = config.size?.field || ''
    const sizeKey = config.size?.aggregation
      ? `${config.size.aggregation}_${config.size.field}`
      : config.size?.field
    const sizeAlias = sizeKey || sizeField

    const data = rows.map((r, idx) => {
      const lng = Number(r[lonField] ?? 0)
      const lat = Number(r[latField] ?? 0)
      const point: any = {
        name: nameField ? String(r[nameField] ?? '') : (String(r[lonField] ?? '') + ',' + String(r[latField] ?? '')),
        value: [lng, lat],
        raw: r,
        idx,
      }
      if (sizeField) point.value.push(Number(r[sizeAlias] ?? r[sizeField] ?? 0))
      return point
    })

    // 尺寸字段值域 → 计算气泡缩放
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
          const lines = [`<b>${raw[nameField] || p.name}</b>`]
          if (lonField) lines.push(`${lonField}: ${raw[lonField]}`)
          if (latField) lines.push(`${latField}: ${raw[latField]}`)
          if (sizeField) lines.push(`${sizeField}: ${raw[sizeAlias] ?? raw[sizeField]}`)
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
      animation: rows.length < 5000,
    }
  }

  // 获取 X 轴数据
  const xData = rows.map((r) => String(r[xField] ?? ''))

  // 饼图
  if (chartType === 'pie') {
    const nameField = xField || colorField
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { top: 8, type: 'scroll' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '55%'],
        data: rows.map((r) => ({
          name: String(r[nameField] ?? ''),
          value: Number(r[yAlias] ?? 0),
        })),
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } },
      }],
    }
  }

  // 散点图（原始数据点：X/Y 直接取原始度量字段，不取聚合别名）
  if (chartType === 'scatter') {
    const xRaw = config.x?.field || ''
    const yRaw = config.y?.field || ''
    return {
      tooltip: { trigger: 'item', formatter: (p: any) => `${xRaw}: ${p.value[0]}<br/>${yRaw}: ${p.value[1]}` },
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
      xAxis: { type: 'value', name: xRaw },
      yAxis: { type: 'value', name: yRaw },
      series: [{
        type: 'scatter',
        data: rows.map((r) => [Number(r[xRaw] ?? 0), Number(r[yRaw] ?? 0)]),
        symbolSize: 10,
        // 大数渲染模式：十万点级流畅
        large: rows.length > 5000,
        largeThreshold: 5000,
      }],
      animation: rows.length < 5000,
    }
  }

  // 柱/折线/面积 且带颜色分组 → 系列拆分
  if (colorField) {
    const categories = [...new Set(rows.map((r) => String(r[colorField] ?? '')))]
    const type = mapChartType(chartType)
    const series = categories.map((cat) => ({
      name: cat,
      type,
      data: rows
        .filter((r) => String(r[colorField] ?? '') === cat)
        .map((r) => Number(r[yAlias] ?? 0)),
      smooth: chartType === 'line',
      areaStyle: chartType === 'area' ? {} : undefined,
      // 大数据降采样：十万点级流畅渲染
      sampling: type === 'line' ? 'lttb' : undefined,
    }))

    return {
      tooltip: { trigger: 'axis' },
      legend: { data: categories, top: 8 },
      grid: { left: 60, right: 30, top: 40, bottom: 50 },
      xAxis: { type: 'category', data: xData, axisLabel: { rotate: xData.length > 8 ? 30 : 0 } },
      yAxis: { type: 'value' },
      series,
      animation: xData.length < 5000, // 大数据关闭动画加速渲染
    }
  }

  // 柱状图 / 折线图 / 面积图（默认）
  const type = mapChartType(chartType)
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 30, top: 30, bottom: 50 },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: xData.length > 8 ? 30 : 0 },
    },
    yAxis: { type: 'value' },
    series: [{
      type,
      data: rows.map((r) => Number(r[yAlias] ?? 0)),
      smooth: type === 'line',
      areaStyle: type === 'line' && chartType === 'area' ? {} : undefined,
      itemStyle: type === 'bar' ? { borderRadius: [4, 4, 0, 0] } : undefined,
      // 大数据降采样：折线/面积图十万点级流畅
      sampling: type === 'line' ? 'lttb' : undefined,
    }],
    animation: xData.length < 5000,
  }
}

function mapChartType(chartType: ChartType): string {
  switch (chartType) {
    case 'bar': return 'bar'
    case 'line': return 'line'
    case 'area': return 'line'
    case 'scatter': return 'scatter'
    case 'pie': return 'pie'
    default: return 'bar'
  }
}
