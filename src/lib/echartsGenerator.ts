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

  // Y 字段别名
  const yAlias = config.y && config.y.aggregation && config.y.aggregation !== 'count'
    ? `${config.y.aggregation}_${config.y.field}`
    : config.y?.field || ''

  const xField = config.x?.field || ''
  const colorField = config.color?.field || ''

  // 获取 X 轴数据
  const xData = rows.map((r) => String(r[xField] ?? ''))

  // 有颜色分组 → 系列拆分
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

  // 散点图
  if (chartType === 'scatter') {
    const xAlias = config.x?.field || ''
    return {
      tooltip: { trigger: 'item', formatter: (p: any) => `${xField}: ${p.value[0]}<br/>${yAlias}: ${p.value[1]}` },
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
      xAxis: { type: 'value', name: xField },
      yAxis: { type: 'value', name: yAlias },
      series: [{
        type: 'scatter',
        data: rows.map((r) => [Number(r[xAlias] ?? 0), Number(r[yAlias] ?? 0)]),
        symbolSize: 10,
        // 大数渲染模式：十万点级流畅
        large: rows.length > 5000,
        largeThreshold: 5000,
      }],
      animation: rows.length < 5000,
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
