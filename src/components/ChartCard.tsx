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
import type { DashboardYField, DashboardMapConfig } from '@/types'
import { useStore } from '@/store/useStore'
import { queryDashboard, generateDashboardOption, generateDashboardMapOption, defaultAggregation } from '@/lib/dashboardEngine'
import { CHINA_GEOJSON } from '@/data/chinaGeo'

// 按需注册 ECharts 模块
echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, MapChart,
  GridComponent, TooltipComponent, LegendComponent, GeoComponent, VisualMapComponent,
  CanvasRenderer,
])
echarts.registerMap('china', CHINA_GEOJSON as any)

const AGG_OPTIONS: { value: DashboardYField['aggregation']; label: string }[] = [
  { value: 'sum', label: '求和 SUM' },
  { value: 'avg', label: '平均 AVG' },
  { value: 'count', label: '计数 COUNT' },
  { value: 'min', label: '最小 MIN' },
  { value: 'max', label: '最大 MAX' },
  { value: 'count_distinct', label: '去重 DISTINCT' },
]

const TYPE_OPTIONS: { value: DashboardYField['chartType']; label: string }[] = [
  { value: 'bar', label: '柱状图' },
  { value: 'line', label: '折线图' },
  { value: 'area', label: '面积图' },
]

interface ChartCardProps {
  id: string
  title: string
  dataSource: string
  chartType: 'combo' | 'map'
  mapConfig?: DashboardMapConfig
  xFields: string[]
  yFields: DashboardYField[]
  onTitleChange: (title: string) => void
  onDataSourceChange: (key: string) => void
  onChartTypeChange: (type: 'combo' | 'map') => void
  onMapConfigChange: (config: DashboardMapConfig) => void
  onXFieldsChange: (fields: string[]) => void
  onYFieldsChange: (fields: DashboardYField[]) => void
  onRemove: () => void
}

/**
 * 仪表盘图表卡片 —— 独立数据源、组合图（多X多Y）或地图
 */
export function ChartCard({
  id, title, dataSource, chartType, mapConfig, xFields, yFields,
  onTitleChange, onDataSourceChange, onChartTypeChange, onMapConfigChange,
  onXFieldsChange, onYFieldsChange, onRemove,
}: ChartCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [result, setResult] = useState<any>(null)

  const catalog = useStore((s) => s.catalog)
  const table = catalog.find((c) => c.key === dataSource)
  const fields = table?.fields ?? []
  const rows = table?.rows ?? []

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

  // 当数据源 / 图表类型 / 字段变化时自动查询并重绘
  useEffect(() => {
    const chart = chartRef.current
    if (!table) {
      setResult(null)
      if (chart) chart.clear()
      return
    }

    // 地图模式
    if (chartType === 'map') {
      const mc = mapConfig
      if (mc && mc.lonField && mc.latField) {
        const option = generateDashboardMapOption(mc, rows)
        setResult({ rows, map: true })
        if (chart) chart.setOption(option, true)
      } else {
        setResult(null)
        if (chart) chart.clear()
      }
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

  // 已选 X 字段集合（用于下拉过滤）
  const availableXFields = fields.filter((f) => !xFields.includes(f.name))
  const availableYFields = fields.filter((f) => !yFields.some((y) => y.field === f.name))

  const addXField = (name: string) => {
    if (!name || xFields.includes(name)) return
    onXFieldsChange([...xFields, name])
  }

  const addYField = (name: string) => {
    if (!name || yFields.some((y) => y.field === name)) return
    const yf: DashboardYField = {
      id: `y_${id}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      field: name,
      aggregation: defaultAggregation(fields, name),
      chartType: 'bar',
    }
    onYFieldsChange([...yFields, yf])
  }

  const patchYField = (yId: string, patch: Partial<DashboardYField>) => {
    onYFieldsChange(yFields.map((y) => (y.id === yId ? { ...y, ...patch } : y)))
  }

  const removeYField = (yId: string) => {
    onYFieldsChange(yFields.filter((y) => y.id !== yId))
  }

  const patchMapConfig = (patch: Partial<DashboardMapConfig>) => {
    onMapConfigChange({ ...(mapConfig ?? { lonField: '', latField: '' }), ...patch })
  }

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

      {/* 配置区（默认收起） */}
      <div className={`chart-card-config ${expanded ? 'open' : ''}`}>
        {/* 数据源选择 */}
        <div className="cfg-row">
          <label className="cfg-label">数据源</label>
          <select
            className="cfg-select"
            value={dataSource}
            onChange={(e) => onDataSourceChange(e.target.value)}
          >
            {catalog.map((c) => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* 图表类型 */}
        <div className="cfg-row">
          <label className="cfg-label">类型</label>
          <div className="cfg-seg">
            <button
              className={`seg-btn ${chartType === 'combo' ? 'active' : ''}`}
              onClick={() => onChartTypeChange('combo')}
            >
              组合图
            </button>
            <button
              className={`seg-btn ${chartType === 'map' ? 'active' : ''}`}
              onClick={() => onChartTypeChange('map')}
            >
              地图
            </button>
          </div>
        </div>

        {chartType === 'combo' ? (
          <>
            {/* X 轴多选 */}
            <div className="cfg-row">
              <label className="cfg-label">X 轴</label>
              <div className="cfg-multi">
                {xFields.map((f) => (
                  <span key={f} className="tag">
                    {f}
                    <span
                      className="tag-remove"
                      onClick={() => onXFieldsChange(xFields.filter((x) => x !== f))}
                    >
                      ×
                    </span>
                  </span>
                ))}
                <select
                  className="cfg-select cfg-add"
                  value=""
                  onChange={(e) => addXField(e.target.value)}
                >
                  <option value="">+ 添加 X 字段</option>
                  {availableXFields.map((f) => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Y 轴多选（每个独立聚合 + 图表类型） */}
            <div className="cfg-row cfg-row-y">
              <label className="cfg-label">Y 轴</label>
              <div className="cfg-y-list">
                {yFields.map((y) => (
                  <div className="cfg-y-item" key={y.id}>
                    <select
                      className="cfg-select"
                      value={y.field}
                      onChange={(e) => patchYField(y.id, { field: e.target.value })}
                    >
                      {fields.map((f) => (
                        <option key={f.name} value={f.name}>{f.name}</option>
                      ))}
                    </select>
                    <select
                      className="cfg-select cfg-agg"
                      value={y.aggregation}
                      onChange={(e) => patchYField(y.id, { aggregation: e.target.value as DashboardYField['aggregation'] })}
                    >
                      {AGG_OPTIONS.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                    <select
                      className="cfg-select cfg-type"
                      value={y.chartType}
                      onChange={(e) => patchYField(y.id, { chartType: e.target.value as DashboardYField['chartType'] })}
                    >
                      {TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button className="cfg-remove" onClick={() => removeYField(y.id)}>×</button>
                  </div>
                ))}
                <select
                  className="cfg-select cfg-add"
                  value=""
                  onChange={(e) => addYField(e.target.value)}
                >
                  <option value="">+ 添加 Y 字段</option>
                  {availableYFields.map((f) => (
                    <option key={f.name} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 地图配置：经度 / 纬度 / 名称 / 大小 */}
            <div className="cfg-row">
              <label className="cfg-label">经度</label>
              <select
                className="cfg-select"
                value={mapConfig?.lonField ?? ''}
                onChange={(e) => patchMapConfig({ lonField: e.target.value })}
              >
                <option value="">请选择经度字段</option>
                {fields.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="cfg-row">
              <label className="cfg-label">纬度</label>
              <select
                className="cfg-select"
                value={mapConfig?.latField ?? ''}
                onChange={(e) => patchMapConfig({ latField: e.target.value })}
              >
                <option value="">请选择纬度字段</option>
                {fields.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="cfg-row">
              <label className="cfg-label">名称</label>
              <select
                className="cfg-select"
                value={mapConfig?.nameField ?? ''}
                onChange={(e) => patchMapConfig({ nameField: e.target.value || undefined })}
              >
                <option value="">（可选）气泡名称</option>
                {fields.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="cfg-row">
              <label className="cfg-label">大小</label>
              <select
                className="cfg-select"
                value={mapConfig?.sizeField ?? ''}
                onChange={(e) => patchMapConfig({ sizeField: e.target.value || undefined })}
              >
                <option value="">（可选）气泡大小</option>
                {fields.map((f) => (
                  <option key={f.name} value={f.name}>{f.name}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* 图表区 */}
      <div className="chart-card-body">
        <div
          ref={containerRef}
          className="chart-card-canvas"
          style={{ width: '100%', height: '100%' }}
        />
        {!result || result.rows.length === 0 ? (
          <div className="chart-empty">
            <div>展开卡片，{chartType === 'map' ? '选择经度和纬度字段' : '下拉选择 X 轴和 Y 轴字段'}</div>
            <div className="hint">
              {chartType === 'map'
                ? '选择含经纬度的数据源，配置经度/纬度即可在地图上打点'
                : 'X 轴可选多个字段，Y 轴每个字段可独立设置柱状图或折线图'}
            </div>
          </div>
        ) : null}
      </div>

      {expanded && result && result.rows.length > 0 && (
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
    </div>
  )
}

export default ChartCard