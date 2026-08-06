import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart, ScatterChart, MapChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GeoComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECharts } from 'echarts/core'
import { useStore } from '@/store/useStore'
import { generateSQL, inferChartType } from '@/lib/encodingEngine'
import { generateEChartsOption } from '@/lib/echartsGenerator'
import { copyChartAsImage, exportToPPTX, exportToExcel, type ExportContext } from '@/lib/chartExport'
import { CHINA_GEOJSON } from '@/data/chinaGeo'
import type { ChartType } from '@/types'

// 按需注册 ECharts 模块，显著减小包体积
echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, MapChart,
  GridComponent, TooltipComponent, LegendComponent, GeoComponent, VisualMapComponent,
  CanvasRenderer,
])

// 注册中国地图（离线内嵌 GeoJSON）
echarts.registerMap('china', CHINA_GEOJSON as any)

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'auto', label: '自动' },
  { type: 'bar', label: '柱状图' },
  { type: 'line', label: '折线图' },
  { type: 'scatter', label: '散点图' },
  { type: 'pie', label: '饼图' },
  { type: 'area', label: '面积图' },
  { type: 'map', label: '地图' },
]

/**
 * 图表画布 —— 使用 ECharts 渲染
 * 当编码槽配置或查询结果变化时自动重绘
 * 移动端：SQL 预览可折叠，图表最小高度适配
 *
 * 导出功能：
 * - 复制图片：将图表复制为 PNG 到剪贴板，可直接 Ctrl+V 粘贴到 PPT
 * - 导出 PPT：生成 .pptx 文件，包含原生可编辑图表（与 Excel 图表格式一致）
 * - 导出 Excel：生成 .xlsx 文件，包含数据 + 图表配置
 */
export function ChartCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)

  const { queryResult, chartType, setChartType, encoding, fields, tableName, queryElapsed, sqlPreviewOpen, toggleSqlPreview } =
    useStore()

  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // 初始化 / 销毁 ECharts 实例
  useEffect(() => {
    if (!containerRef.current) return

    const chart = echarts.init(containerRef.current)
    chartRef.current = chart

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  // 数据或配置变化时重绘
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !queryResult || queryResult.rows.length === 0) return

    const effectiveType = chartType === 'auto' ? inferChartType(encoding, fields) : chartType
    const option = generateEChartsOption(encoding, effectiveType, fields, queryResult)
    chart.setOption(option, true)
  }, [queryResult, chartType, encoding, fields])

  // 生成 SQL 预览
  const sqlPreview = tableName ? generateSQL(encoding, tableName, fields) : ''
  const inferredType = inferChartType(encoding, fields)

  // 构建导出上下文
  const buildExportContext = (): ExportContext => ({
    chart: chartRef.current,
    encoding,
    chartType,
    fields,
    queryResult,
    tableName,
  })

  // 复制图表为图片
  const handleCopyImage = async () => {
    setExporting(true)
    setExportStatus(null)
    try {
      await copyChartAsImage(buildExportContext())
      setExportStatus('✅ 已复制到剪贴板，可直接 Ctrl+V 粘贴到 PPT')
    } catch (err: any) {
      setExportStatus(`❌ ${err.message}`)
    } finally {
      setExporting(false)
      setExportMenuOpen(false)
      setTimeout(() => setExportStatus(null), 4000)
    }
  }

  // 导出 PPT
  const handleExportPPT = async () => {
    setExporting(true)
    setExportStatus(null)
    try {
      await exportToPPTX(buildExportContext())
      setExportStatus('✅ PPT 文件已下载，图表为原生可编辑格式')
    } catch (err: any) {
      setExportStatus(`❌ ${err.message}`)
    } finally {
      setExporting(false)
      setExportMenuOpen(false)
      setTimeout(() => setExportStatus(null), 4000)
    }
  }

  // 导出 Excel
  const handleExportExcel = async () => {
    setExporting(true)
    setExportStatus(null)
    try {
      await exportToExcel(buildExportContext())
      setExportStatus('✅ Excel 文件已下载')
    } catch (err: any) {
      setExportStatus(`❌ ${err.message}`)
    } finally {
      setExporting(false)
      setExportMenuOpen(false)
      setTimeout(() => setExportStatus(null), 4000)
    }
  }

  return (
    <div className="chart-area">
      <div className="chart-toolbar">
        {CHART_TYPES.map((ct) => (
          <button
            key={ct.type}
            className={`chart-type-btn ${chartType === ct.type ? 'active' : ''}`}
            onClick={() => setChartType(ct.type)}
          >
            {ct.label}
          </button>
        ))}
        {chartType === 'auto' && inferredType !== 'auto' && (
          <span style={{ fontSize: 11, color: 'var(--text-light)', marginLeft: 8, flexShrink: 0 }}>
            (推断: {inferredType})
          </span>
        )}
        <div style={{ flex: 1 }} />

        {/* 导出菜单 */}
        {queryResult && queryResult.rows.length > 0 && (
          <div className="export-dropdown">
            <button
              className="export-btn"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={exporting}
            >
              {exporting ? '⏳ 导出中...' : '📥 导出图表'}
            </button>
            {exportMenuOpen && (
              <>
                <div className="export-menu-overlay" onClick={() => setExportMenuOpen(false)} />
                <div className="export-menu">
                  <button className="export-menu-item" onClick={handleCopyImage}>
                    <span className="export-icon">📋</span>
                    <div className="export-item-content">
                      <div className="export-item-title">复制为图片</div>
                      <div className="export-item-desc">粘贴到 PPT/Word（Ctrl+V）</div>
                    </div>
                  </button>
                  <button className="export-menu-item" onClick={handleExportPPT}>
                    <span className="export-icon">📊</span>
                    <div className="export-item-content">
                      <div className="export-item-title">导出 PPT（可编辑图表）</div>
                      <div className="export-item-desc">原生图表格式，双击可编辑</div>
                    </div>
                  </button>
                  <button className="export-menu-item" onClick={handleExportExcel}>
                    <span className="export-icon">📗</span>
                    <div className="export-item-content">
                      <div className="export-item-title">导出 Excel</div>
                      <div className="export-item-desc">数据 + 图表配置</div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {queryResult && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
            {queryResult.rows.length} 行
            {queryElapsed != null && ` · ${queryElapsed}ms`}
          </span>
        )}
      </div>

      {/* 导出状态提示 */}
      {exportStatus && (
        <div className="export-status-toast">
          {exportStatus}
        </div>
      )}

      <div className="chart-canvas-container" style={{ position: 'relative' }}>
        {/* 容器始终渲染，保证 ECharts 能初始化 */}
        <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
        {!queryResult || queryResult.rows.length === 0 ? (
          <div className="chart-empty" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div>将字段拖到编码槽开始可视化</div>
            <div className="hint">
              X 轴放维度、Y 轴放度量 → 自动出柱状图<br />
              X 轴放日期维度 → 折线图<br />
              两个度量 → 散点图
            </div>
          </div>
        ) : null}
      </div>

      {sqlPreview && (
        <div className={`sql-preview ${sqlPreviewOpen ? '' : 'collapsed'}`}>
          <div className="label" onClick={toggleSqlPreview}>
            SQL 预览
            {queryElapsed != null && (
              <span className="elapsed">{queryElapsed}ms</span>
            )}
            <span className="toggle-icon">▼</span>
          </div>
          <code>{sqlPreview}</code>
        </div>
      )}
    </div>
  )
}
