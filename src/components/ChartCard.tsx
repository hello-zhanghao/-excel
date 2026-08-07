import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ECharts } from 'echarts/core'
import type { DashboardYField, DashboardMapConfig } from '@/types'
import { useStore } from '@/store/useStore'
import { queryDashboard, generateDashboardOption } from '@/lib/dashboardEngine'
import { LeafletMap } from './LeafletMap'

// 按需注册 ECharts 模块
echarts.use([
  BarChart, LineChart, PieChart, ScatterChart,
  GridComponent, TooltipComponent, LegendComponent,
  CanvasRenderer,
])

interface ChartCardProps {
  id: string
  title: string
  dataSource: string
  chartType: 'combo' | 'map'
  mapConfig?: DashboardMapConfig
  xFields: string[]
  yFields: DashboardYField[]
  /** 当前是否被选中（在右侧栏显示配置） */
  selected: boolean
  /** 自定义大小（缺省时网格自适应） */
  size?: { w?: number; h?: number }
  onSelect: () => void
  onRemove: () => void
  /** 拖动右下角调整大小 */
  onResize?: (size: { w?: number; h?: number }) => void
}

/**
 * 仪表盘图表卡片 —— 独立数据源、组合图（多X多Y）或地图。
 * 卡片本身只负责渲染图表；配置在右侧栏（ChartCardConfig）中编辑。
 */
export function ChartCard({
  id, title, dataSource, chartType, mapConfig, xFields, yFields,
  selected, size, onSelect, onRemove, onResize,
}: ChartCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const [result, setResult] = useState<any>(null)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

  const catalog = useStore((s) => s.catalog)
  const table = catalog.find((c) => c.key === dataSource)
  const rows = table?.rows ?? []

  const isMap = chartType === 'map'
  const isMapReady = isMap && !!(mapConfig?.lonField && mapConfig?.latField)

  // 初始化 / 销毁 ECharts 实例，并监听容器尺寸变化以便卡片缩放后自适应重绘
  useEffect(() => {
    if (isMap) {
      if (chartRef.current) {
        chartRef.current.dispose()
        chartRef.current = null
      }
      return
    }
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)
    // ResizeObserver：卡片被拖拽缩放时同步重绘
    const ro = window.ResizeObserver
      ? new ResizeObserver(() => chart.resize())
      : null
    if (ro) ro.observe(containerRef.current)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (ro) ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [isMap])

  // 当数据源 / 图表类型 / 字段变化时自动查询并重绘
  useEffect(() => {
    const chart = chartRef.current

    // 地图模式：交由 LeafletMap 渲染
    if (isMap) {
      setResult(isMapReady ? { rows, map: true } : null)
      return
    }
    if (!table) {
      setResult(null)
      if (chart) chart.clear()
      return
    }

    // 组合图模式
    if (yFields.length === 0) {
      setResult(null)
      if (chart) chart.clear()
      return
    }
    const q = queryDashboard(rows, xFields, yFields)
    setResult(q)
    if (!chart) return
    if (q.rows.length === 0) {
      chart.clear()
      return
    }
    const option = generateDashboardOption(xFields, yFields, q)
    chart.setOption(option, true)
  }, [dataSource, chartType, mapConfig, xFields, yFields, table, rows])

  // 右下角拖拽调整卡片大小
  const onResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // 用卡片根元素自身尺寸作为拖拽起点（地图模式下 containerRef 不渲染，不能依赖它）
    const startW = cardRef.current?.clientWidth ?? 360
    const startH = cardRef.current?.clientHeight ?? 300
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW, startH }
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      const r = resizeRef.current
      if (!r) return
      ev.stopPropagation()
      onResize?.({
        w: Math.max(280, r.startW + (ev.clientX - r.startX)),
        h: Math.max(200, r.startH + (ev.clientY - r.startY)),
      })
    }
    const onUp = () => {
      resizeRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={cardRef}
      className={`chart-card${selected ? ' selected' : ''}`}
      onClick={onSelect}
      title="点击在右侧栏编辑该卡片"
      style={size?.w || size?.h
        ? { width: size.w ?? undefined, height: size.h ?? undefined }
        : undefined}
    >
      <div className="chart-card-header">
        <span className="chart-card-title-text">{title || '未命名图表'}</span>
        <div className="spacer" />
        <button
          className="card-btn danger"
          title="删除卡片"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ×
        </button>
      </div>

      {/* 图表区 */}
      <div className="chart-card-body">
        {isMapReady && !mapFullscreen ? (
          <>
            <LeafletMap rows={rows} config={mapConfig!} />
            <button
              className="map-fullscreen-btn"
              title="全屏"
              onClick={(e) => {
                e.stopPropagation()
                setMapFullscreen(true)
              }}
            >
              ⛶
            </button>
          </>
        ) : !isMapReady ? (
          <div
            ref={containerRef}
            className="chart-card-canvas"
            style={{ width: '100%', height: '100%' }}
          />
        ) : null}
        {!result || result.rows.length === 0 ? (
          <div className="chart-empty">
            <div>{chartType === 'map' ? '选择经度和纬度字段' : '下拉选择 X 轴和 Y 轴字段'}</div>
            <div className="hint">
              {chartType === 'map'
                ? '在右侧栏配置经度/纬度即可在 OpenStreetMap 上打点'
                : '在右侧栏选择 X 轴、Y 轴字段并设置图表类型'}
            </div>
          </div>
        ) : null}
      </div>

      {/* 数据摘要 */}
      {result && result.rows.length > 0 && (
        <div className="sql-preview">
          <div className="label">
            {chartType === 'map' ? (
              <>数据源 {table?.name ?? dataSource} · 地图打点 {result.rows.length} 点</>
            ) : (
              <>数据源 {table?.name ?? dataSource} · {xFields.join(' / ') || '全部'} · {result.rows.length} 行</>
            )}
          </div>
        </div>
      )}

      {/* 地图全屏覆盖层 */}
      {isMapReady && mapFullscreen && (
        <div className="map-fullscreen">
          <div className="map-fullscreen-bar">
            <span className="title">{title || '地图'}</span>
            <div style={{ flex: 1 }} />
            <button className="card-btn danger" onClick={() => setMapFullscreen(false)}>
              退出全屏
            </button>
          </div>
          <div className="map-fullscreen-canvas">
            <LeafletMap rows={rows} config={mapConfig!} />
          </div>
        </div>
      )}

      {/* 右下角拖拽调整大小手柄 */}
      <div className="card-resize-handle" onMouseDown={onResizeStart} title="拖拽调整大小" />
    </div>
  )
}

export default ChartCard