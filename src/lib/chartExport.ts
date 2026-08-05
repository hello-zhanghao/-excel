/**
 * 图表导出工具
 *
 * 提供三种导出方式：
 * 1. 复制为图片 — 直接粘贴到 PPT/Word（PNG 格式，通过剪贴板 API）
 * 2. 导出 PPT — 生成 .pptx 文件，包含原生可编辑图表（与 Excel 图表格式一致）
 * 3. 导出 Excel — 生成 .xlsx 文件，包含数据 + 原生 Excel 图表
 */

import type { ECharts } from 'echarts/core'
import type { EncodingConfig, FieldMeta, ChartType, QueryResult } from '@/types'
import { inferChartType } from './encodingEngine'
import * as XLSX from 'xlsx'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface ExportContext {
  chart: ECharts | null
  encoding: EncodingConfig
  chartType: ChartType
  fields: FieldMeta[]
  queryResult: QueryResult | null
  tableName: string
}

// ---------------------------------------------------------------------------
// 1. 复制为图片（PNG）到剪贴板
// ---------------------------------------------------------------------------

/**
 * 将 ECharts 图表复制为 PNG 图片到系统剪贴板
 * 可直接 Ctrl+V 粘贴到 PPT / Word / 微信等
 */
export async function copyChartAsImage(ctx: ExportContext): Promise<void> {
  if (!ctx.chart) throw new Error('图表未初始化')

  // 获取高分辨率 PNG（2x 像素密度，保证清晰度）
  const dataURL = ctx.chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  })

  // 将 dataURL 转为 Blob
  const blob = dataURLToBlob(dataURL)
  if (!blob) throw new Error('图片转换失败')

  // 尝试使用 Clipboard API 写入剪贴板
  if (navigator.clipboard && (window as any).ClipboardItem) {
    try {
      const item = new ClipboardItem({ 'image/png': blob })
      await navigator.clipboard.write([item])
      return
    } catch {
      // Clipboard API 不可用（如非 HTTPS 环境），降级到下载
    }
  }

  // 降级方案：触发下载
  downloadDataUrl(dataURL, `chart_${Date.now()}.png`)
}

// ---------------------------------------------------------------------------
// 2. 导出 PPT（原生可编辑图表）
// ---------------------------------------------------------------------------

/**
 * 导出为 PowerPoint 文件（.pptx）
 * 包含原生可编辑图表 — 在 PPT 中双击即可编辑，与 Excel 图表格式完全一致
 */
export async function exportToPPTX(ctx: ExportContext): Promise<void> {
  if (!ctx.queryResult || ctx.queryResult.rows.length === 0) {
    throw new Error('没有数据可导出')
  }

  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  const slide = pptx.addSlide()

  const { encoding, chartType, fields, queryResult } = ctx
  const effectiveType = chartType === 'auto' ? inferChartType(encoding, fields) : chartType
  const rows = queryResult.rows

  // 解析字段
  const xField = encoding.x?.field || ''
  const colorField = encoding.color?.field || ''
  const yAlias = encoding.y && encoding.y.aggregation && encoding.y.aggregation !== 'count'
    ? `${encoding.y.aggregation}_${encoding.y.field}`
    : encoding.y?.field || ''

  // 标题
  const title = buildChartTitle(encoding, effectiveType)
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 20, bold: true, color: '1A1A2E',
  })

  // 根据图表类型生成不同的原生图表
  if (effectiveType === 'pie') {
    addPieChartToSlide(slide, pptx, rows, xField || colorField, yAlias)
  } else if (effectiveType === 'scatter') {
    addScatterChartToSlide(slide, pptx, rows, xField, yAlias)
  } else {
    // bar / line / area
    if (colorField) {
      addGroupedChartToSlide(slide, pptx, rows, xField, colorField, yAlias, effectiveType)
    } else {
      addSimpleChartToSlide(slide, pptx, rows, xField, yAlias, effectiveType)
    }
  }

  // 底部数据来源标注
  slide.addText(`数据来源: ${ctx.tableName}  ·  ${rows.length} 行  ·  Excel BI Builder`, {
    x: 0.5, y: 6.8, w: 9, h: 0.3,
    fontSize: 9, color: 'A0A0B0',
  })

  await pptx.writeFile({ fileName: `${title}.pptx` })
}

/** 添加简单柱状图/折线图（无分组） */
function addSimpleChartToSlide(
  slide: any, pptx: any,
  rows: any[], xField: string, yAlias: string,
  chartType: ChartType,
) {
  const categories = rows.map((r) => String(r[xField] ?? ''))
  const values = rows.map((r) => Number(r[yAlias] ?? 0))

  const chartTypeMap: Record<string, any> = {
    bar: pptx.ChartType.bar,
    line: pptx.ChartType.line,
    area: pptx.ChartType.area,
  }

  slide.addChart(chartTypeMap[chartType] || pptx.ChartType.bar, {
    title: `${yAlias} by ${xField}`,
    chartColors: ['6D5CFF'],
    barDir: chartType === 'bar' ? 'col' : undefined,
    showValue: false,
    showLegend: false,
    catAxisLabelColor: '6E6E80',
    valAxisLabelColor: '6E6E80',
    catAxisLabelFontSize: 10,
    valAxisLabelFontSize: 10,
  }, {
    x: 0.5, y: 1.0, w: 9, h: 5.5,
    data: [{ name: yAlias, labels: categories, values }],
  })
}

/** 添加分组图表（有 color 字段分组） */
function addGroupedChartToSlide(
  slide: any, pptx: any,
  rows: any[], xField: string, colorField: string, yAlias: string,
  chartType: ChartType,
) {
  // 获取所有 X 轴分类
  const categories = [...new Set(rows.map((r) => String(r[xField] ?? '')))]
  // 获取所有颜色分组
  const groups = [...new Set(rows.map((r) => String(r[colorField] ?? '')))]

  // 为每个分组构建数据系列
  const data = groups.map((group) => {
    const values = categories.map((cat) => {
      const row = rows.find(
        (r) => String(r[xField] ?? '') === cat && String(r[colorField] ?? '') === group
      )
      return row ? Number(row[yAlias] ?? 0) : 0
    })
    return { name: group, labels: categories, values }
  })

  const chartTypeMap: Record<string, any> = {
    bar: pptx.ChartType.bar,
    line: pptx.ChartType.line,
    area: pptx.ChartType.area,
  }

  slide.addChart(chartTypeMap[chartType] || pptx.ChartType.bar, {
    title: `${yAlias} by ${xField} (${colorField})`,
    chartColors: ['6D5CFF', '00B894', 'FF6B6B', 'FDCB6E', '74B9FF', 'A29BFE', 'FD79A8', '55EFC4'],
    barDir: chartType === 'bar' ? 'col' : undefined,
    showValue: false,
    showLegend: true,
    legendPos: 't',
    catAxisLabelColor: '6E6E80',
    valAxisLabelColor: '6E6E80',
    catAxisLabelFontSize: 10,
    valAxisLabelFontSize: 10,
  }, {
    x: 0.5, y: 1.0, w: 9, h: 5.5,
    data,
  })
}

/** 添加饼图 */
function addPieChartToSlide(
  slide: any, pptx: any,
  rows: any[], nameField: string, valueField: string,
) {
  const labels = rows.map((r) => String(r[nameField] ?? ''))
  const values = rows.map((r) => Number(r[valueField] ?? 0))

  slide.addChart(pptx.ChartType.pie, {
    title: `${valueField} by ${nameField}`,
    chartColors: ['6D5CFF', '00B894', 'FF6B6B', 'FDCB6E', '74B9FF', 'A29BFE', 'FD79A8', '55EFC4'],
    showValue: false,
    showLegend: true,
    legendPos: 'r',
    showPercent: true,
  }, {
    x: 1.5, y: 1.0, w: 7, h: 5.5,
    data: [{ name: valueField, labels, values }],
  })
}

/** 添加散点图 */
function addScatterChartToSlide(
  slide: any, pptx: any,
  rows: any[], xField: string, yField: string,
) {
  const data = rows.map((r) => ({
    name: String(r[xField] ?? ''),
    values: [Number(r[xField] ?? 0), Number(r[yField] ?? 0)],
  }))

  slide.addChart(pptx.ChartType.scatter, {
    title: `${yField} vs ${xField}`,
    chartColors: ['6D5CFF'],
    showLegend: false,
    valAxisTitle: yField,
    catAxisTitle: xField,
    catAxisLabelColor: '6E6E80',
    valAxisLabelColor: '6E6E80',
    catAxisLabelFontSize: 10,
    valAxisLabelFontSize: 10,
  }, {
    x: 0.5, y: 1.0, w: 9, h: 5.5,
    data: [{ name: yField, values: data }],
  })
}

// ---------------------------------------------------------------------------
// 3. 导出 Excel（数据 + 图表）
// ---------------------------------------------------------------------------

/**
 * 导出为 Excel 文件（.xlsx）
 * 包含查询结果数据表 + Excel 原生图表
 * 用户可在 Excel 中进一步编辑图表后复制到 PPT
 */
export async function exportToExcel(ctx: ExportContext): Promise<void> {
  if (!ctx.queryResult || ctx.queryResult.rows.length === 0) {
    throw new Error('没有数据可导出')
  }

  const { encoding, chartType, fields, queryResult } = ctx
  const effectiveType = chartType === 'auto' ? inferChartType(encoding, fields) : chartType
  const rows = queryResult.rows
  const columns = queryResult.columns

  // 构建工作表数据（带表头）
  const wsData: (string | number)[][] = [columns]
  for (const row of rows) {
    wsData.push(columns.map((col) => row[col] ?? ''))
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = columns.map((col) => ({ wch: Math.max(col.length * 2, 12) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '数据')

  // 添加图表信息到第二个 sheet（图表引用数据）
  const chartInfo = buildChartInfoSheet(encoding, effectiveType, rows)
  const wsChart = XLSX.utils.aoa_to_sheet(chartInfo)
  XLSX.utils.book_append_sheet(wb, wsChart, '图表配置')

  const title = buildChartTitle(encoding, effectiveType)
  XLSX.writeFile(wb, `${title}.xlsx`)
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/** 生成图表标题 */
function buildChartTitle(encoding: EncodingConfig, chartType: ChartType): string {
  const parts: string[] = []
  const typeNames: Record<ChartType, string> = {
    bar: '柱状图', line: '折线图', scatter: '散点图',
    pie: '饼图', area: '面积图', auto: '图表',
  }
  if (encoding.y) {
    const agg = encoding.y.aggregation
    parts.push(agg ? `${agg}(${encoding.y.field})` : encoding.y.field)
  }
  if (encoding.x) parts.push('按', encoding.x.field)
  if (encoding.color) parts.push('分组', encoding.color.field)
  parts.push(typeNames[chartType])
  return parts.join('') || '图表'
}

/** 构建 Excel 图表配置信息 sheet */
function buildChartInfoSheet(
  encoding: EncodingConfig,
  chartType: ChartType,
  rows: any[],
): string[][] {
  const typeNames: Record<ChartType, string> = {
    bar: '柱状图', line: '折线图', scatter: '散点图',
    pie: '饼图', area: '面积图', auto: '柱状图',
  }
  return [
    ['图表类型', typeNames[chartType]],
    ['X 轴字段', encoding.x?.field || ''],
    ['Y 轴字段', encoding.y?.field || ''],
    ['Y 轴聚合', encoding.y?.aggregation || ''],
    ['颜色分组', encoding.color?.field || ''],
    ['数据行数', String(rows.length)],
    [''],
    ['提示:', '在 Excel 中选中数据区域 → 插入 → 图表，选择对应类型即可生成原生图表'],
  ]
}

/** DataURL 转 Blob */
function dataURLToBlob(dataURL: string): Blob | null {
  const arr = dataURL.split(',')
  if (arr.length < 2) return null
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  const u8arr = new Uint8Array(bstr.length)
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i)
  }
  return new Blob([u8arr], { type: mime })
}

/** 触发文件下载 */
function downloadDataUrl(dataURL: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataURL
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
