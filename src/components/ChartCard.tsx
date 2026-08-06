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
import type { EncodingItem, SlotName, ChartType } from '@/types'
import { useStore } from '@/store/useStore'
import { generateSQL, inferChartType } from '@/lib/encodingEngine'
import { generateEChartsOption } from '@/lib/echartsGenerator'
import { runQueryByEncoding } from '@/lib/queryEngine'
import { CHINA_GEOJSON } from '@/data/chinaGeo'
import { EncodingBar } from './EncodingBar'

// 按需注册 ECharts 模块（与 ChartCanvas 保持一致）
echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, MapChart,
  GridComponent, TooltipComponent, LegendComponent, GeoComponent, VisualMapComponent,
  CanvasRenderer,
])
echarts.registerMap('china', CHINA_GEOJSON as any)

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: 'auto', label: '自动' },
  { type: 'bar', label: '柱状' },
  { type: 'line', label: '折线' },
  { type: 'scatter', label: '散点' },
  { type: 'pie', label: '饼图' },
  { type: 'area', label: '面积' },
  { type: 'map', label: '地图' },
]

interface ChartCardProps {
  id: string
  title: string
  encoding: Record<string, any>
  chartType: ChartType
  onTitleChange: (title: string) => void
  onEncodingChange: (encoding: Record<string, any>) => void
  onChartTypeChange: (type: ChartType) => void
  onRemove: () => void
}

/**
 * 仪表盘图表卡片
 * 每张卡片独立承载一份编码配置，可独立选字段、选类型、出图
 */
export function ChartCard({
  id, title, encoding, chartType,
  onTitleChange, onEncodingChange, onChartTypeChange, onRemove,
}: ChartCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [queryResult, setQueryResult] = useState<any>(null)
  const [sqlPreview, setSqlPreview] = useState('')

  const fields = useStore((s) => s.fields)
  const tableName = useStore((s) => s.tableName)

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

  // 编码变化 → 自动查询并重绘
  useEffect(() => {
    if (!tableName) return
    if (!encoding || Object.keys(encoding).length === 0) {
      setQueryResult(null)
      setSqlPreview('')
      if (chartRef.current) chartRef.current.clear()
      return
    }
    const sql = generateSQL(encoding as any, tableName, fields)
    setSqlPreview(sql)
    runQueryByEncoding(encoding as any, fields, tableName)
      .then((result) => {
        setQueryResult(result)
        return result
      })
      .then((result) => {
        const chart = chartRef.current
        if (!chart || !result || result.rows.length === 0) return
        const effectiveType = chartType === 'auto' ? inferChartType(encoding as any, fields) : chartType
        const option = generateEChartsOption(encoding as any, effectiveType, fields, result)
        chart.setOption(option, true)
      })
      .catch(() => {
        setQueryResult(null)
        if (chartRef.current) chartRef.current.clear()
      })
  }, [encoding, chartType, fields, tableName])

  // 槽位变更回调（写入当前卡片自身的 encoding）
  const handleSlotChange = (slot: SlotName, item: EncodingItem | null) => {
    const next = { ...encoding }
    if (item === null) {
      delete next[slot]
    } else {
      next[slot] = item
    }
    onEncodingChange(next)
  }

  const inferredType = inferChartType(encoding as any, fields)

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <input
          className="chart-card-title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="图表标题"
        />
        <div className="chart-card-actions">
          <button
            className={`card-btn ${expanded ? 'active' : ''}`}
            title={expanded ? '收起配置' : '展开配置'}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▲' : '▼'}
          </button>
          <button className="card-btn danger" title="删除卡片" onClick={onRemove}>
            ×
          </button>
        </div>
      </div>

      {/* 编码配置区（默认收起，点击展开） */}
      <div className={`chart-card-config ${expanded ? 'open' : ''}`}>
        <EncodingBar
          encoding={encoding as any}
          fields={fields}
          onChange={handleSlotChange}
          compact
        />
        <div className="chart-card-type-row">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.type}
              className={`chart-type-btn ${chartType === ct.type ? 'active' : ''}`}
              onClick={() => onChartTypeChange(ct.type)}
            >
              {ct.label}
            </button>
          ))}
          {chartType === 'auto' && inferredType !== 'auto' && (
            <span className="inferred-hint">(推断: {inferredType})</span>
          )}
        </div>
      </div>

      {/* 图表区 */}
      <div className="chart-card-body">
        <div
          ref={containerRef}
          className="chart-card-canvas"
          style={{ width: '100%', height: '100%' }}
        />
        {!queryResult || queryResult.rows.length === 0 ? (
          <div className="chart-empty">
            <div>展开卡片，将字段拖入编码槽</div>
            <div className="hint">X 轴放维度、Y 轴放度量 → 自动出图</div>
          </div>
        ) : null}
      </div>

      {sqlPreview && expanded && (
        <div className="sql-preview">
          <div className="label">SQL 预览</div>
          <code>{sqlPreview}</code>
        </div>
      )}
    </div>
  )
}

export default ChartCard