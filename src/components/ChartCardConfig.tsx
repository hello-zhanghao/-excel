import type { DashboardYField, DashboardMapConfig, DashboardChart, FieldMeta, CatalogTable } from '@/types'
import { defaultAggregation } from '@/lib/dashboardEngine'

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

interface ChartCardConfigProps {
  card: DashboardChart
  /** 当前卡片数据源的字段（用于下拉选项） */
  fields: FieldMeta[]
  catalog: CatalogTable[]
  onTitleChange: (title: string) => void
  onDataSourceChange: (key: string) => void
  onChartTypeChange: (type: 'combo' | 'map') => void
  onMapConfigChange: (config: DashboardMapConfig) => void
  onXFieldsChange: (fields: string[]) => void
  onYFieldsChange: (fields: DashboardYField[]) => void
}

/**
 * 卡片配置表单 —— 渲染在右侧配置栏（复用流水线节点配置面板的模式）。
 * 支持数据源、图表类型、多 X / 多 Y 轴（每 Y 独立聚合与图表类型）或地图配置。
 */
export function ChartCardConfig({
  card,
  fields,
  catalog,
  onTitleChange,
  onDataSourceChange,
  onChartTypeChange,
  onMapConfigChange,
  onXFieldsChange,
  onYFieldsChange,
}: ChartCardConfigProps) {
  const { dataSource, chartType, mapConfig, xFields, yFields } = card

  const availableXFields = fields.filter((f) => !xFields.includes(f.name))
  const availableYFields = fields.filter((f) => !yFields.some((y) => y.field === f.name))

  const addXField = (name: string) => {
    if (!name || xFields.includes(name)) return
    onXFieldsChange([...xFields, name])
  }

  const addYField = (name: string) => {
    if (!name || yFields.some((y) => y.field === name)) return
    const yf: DashboardYField = {
      id: `y_${card.id}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
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
    <>
      {/* 标题 */}
      <div className="cfg-row">
        <label className="cfg-label">标题</label>
        <input
          className="cfg-input"
          value={card.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="图表标题"
        />
      </div>

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
            type="button"
            className={`seg-btn ${chartType === 'combo' ? 'active' : ''}`}
            onClick={() => onChartTypeChange('combo')}
          >
            组合图
          </button>
          <button
            type="button"
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
          {/* 地图配置：经度 / 纬度 / 名称 / 大小 / 分类 */}
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
          <div className="cfg-row">
            <label className="cfg-label">分类</label>
            <select
              className="cfg-select"
              value={mapConfig?.colorField ?? ''}
              onChange={(e) => patchMapConfig({ colorField: e.target.value || undefined })}
            >
              <option value="">（可选）按分类着色</option>
              {fields.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </>
  )
}

export default ChartCardConfig