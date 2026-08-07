import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { ChartCard } from './ChartCard'
import { ChartCardConfig } from './ChartCardConfig'
import type { DashboardYField, DashboardMapConfig } from '@/types'

/**
 * 仪表盘 —— 多图表卡片网格 + 右侧配置栏
 * 点击卡片后在右侧栏编辑其配置（数据源、图表类型、X/Y 或地图字段），
 * 右侧栏支持拖拽调整宽度与折叠展开，与流水线节点配置面板交互一致。
 */
export function Dashboard() {
  const dashboardCharts = useStore((s) => s.dashboardCharts)
  const addDashboardChart = useStore((s) => s.addDashboardChart)
  const updateDashboardChart = useStore((s) => s.updateDashboardChart)
  const removeDashboardChart = useStore((s) => s.removeDashboardChart)
  const catalog = useStore((s) => s.catalog)

  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 右侧配置栏：可拖拽调整宽度 + 可折叠
  const [configWidth, setConfigWidth] = useState(320)
  const [configCollapsed, setConfigCollapsed] = useState(false)
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null)
  const [resizing, setResizing] = useState(false)

  const onResizeMove = useCallback((e: MouseEvent) => {
    const r = resizeRef.current
    if (!r) return
    // 分隔条位于面板左侧，向左拉变宽（反向）
    setConfigWidth(Math.min(Math.max(r.startW - (e.clientX - r.startX), 260), 560))
  }, [])

  const onResizeEnd = useCallback(() => {
    resizeRef.current = null
    setResizing(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onResizeMove)
    window.removeEventListener('mouseup', onResizeEnd)
  }, [onResizeMove])

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = { startX: e.clientX, startW: configWidth }
      setResizing(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onResizeMove)
      window.addEventListener('mouseup', onResizeEnd)
    },
    [configWidth, onResizeMove, onResizeEnd],
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [onResizeMove, onResizeEnd])

  // 选中卡片被删除时自动关闭配置栏
  useEffect(() => {
    if (selectedId && !dashboardCharts.some((c) => c.id === selectedId)) {
      setSelectedId(null)
    }
  }, [selectedId, dashboardCharts])

  const selectedChart = dashboardCharts.find((c) => c.id === selectedId) ?? null
  const selectedTable = selectedChart
    ? catalog.find((c) => c.key === selectedChart.dataSource)
    : null
  const selectedFields = selectedTable?.fields ?? []

  const toggleSelect = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id))
  }

  const handleRemove = (id: string) => {
    removeDashboardChart(id)
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  return (
    <div className="dashboard">
      <div className="dashboard-toolbar">
        <span className="dashboard-title">数据仪表盘</span>
        <span className="dashboard-sub">每张卡片独立选数据源，点击卡片在右侧栏编辑</span>
        <div style={{ flex: 1 }} />
        <button className="add-chart-btn" onClick={addDashboardChart}>
          + 添加图表卡片
        </button>
      </div>

      <div className="dashboard-body">
        <div className="dashboard-grid">
          {dashboardCharts.map((card) => (
            <ChartCard
              key={card.id}
              id={card.id}
              title={card.title}
              dataSource={card.dataSource}
              chartType={card.chartType}
              mapConfig={card.mapConfig}
              xFields={card.xFields}
              yFields={card.yFields}
              selected={selectedId === card.id}
              size={card.size}
              onSelect={() => toggleSelect(card.id)}
              onRemove={() => handleRemove(card.id)}
              onResize={(size) => updateDashboardChart(card.id, { size })}
            />
          ))}

          {dashboardCharts.length === 0 && (
            <div className="dashboard-empty">
              <div className="empty-icon">📊</div>
              <div>还没有图表卡片</div>
              <div className="hint">
                点击右上角「添加图表卡片」，点击卡片后在右侧栏配置数据源、X/Y 轴或地图字段
              </div>
              <button className="add-chart-btn" onClick={addDashboardChart}>
                + 添加第一张图表卡片
              </button>
            </div>
          )}
        </div>

        {/* 右侧配置栏（可折叠、可拖拽调整宽度） */}
        {selectedChart && (
          <aside
            className="node-config-panel"
            style={{ width: configCollapsed ? 36 : configWidth }}
          >
            {configCollapsed ? (
              <div
                className="panel-collapsed-v"
                onClick={() => setConfigCollapsed(false)}
                title="展开配置面板"
              >
                <span className="panel-collapse-mark">配置</span>
                <button className="panel-collapse-btn" type="button">«</button>
              </div>
            ) : (
              <>
                {/* 左边缘分隔条（拖拽调整宽度） */}
                <div
                  className={`panel-divider panel-divider-v${resizing ? ' active' : ''}`}
                  onMouseDown={onResizeStart}
                  title="拖拽调整面板宽度"
                  style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }}
                />

                {/* 标题栏 */}
                <div
                  className="node-config-header"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 14px',
                    background: 'transparent',
                    color: 'var(--text)',
                    borderBottom: '1px solid var(--border)',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--brand)',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    图表配置
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfigCollapsed(true)}
                    title="收起面板"
                    style={{
                      border: 'none', background: 'transparent', color: 'var(--text-muted)',
                      borderRadius: 6, width: 26, height: 26, fontSize: 14, lineHeight: 1,
                      cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    »
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    title="关闭配置面板"
                    style={{
                      border: 'none', background: 'transparent', color: 'var(--text-muted)',
                      borderRadius: 6, width: 26, height: 26, fontSize: 15, lineHeight: 1,
                      cursor: 'pointer', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* 配置表单 */}
                <div
                  className="node-config-body"
                  style={{ flex: 1, overflowY: 'auto', padding: 14 }}
                >
                  <ChartCardConfig
                    card={selectedChart}
                    fields={selectedFields}
                    catalog={catalog}
                    onTitleChange={(title) => updateDashboardChart(selectedChart.id, { title })}
                    onDataSourceChange={(dataSource) => updateDashboardChart(selectedChart.id, { dataSource, xFields: [], yFields: [], mapConfig: undefined })}
                    onChartTypeChange={(chartType) => updateDashboardChart(selectedChart.id, { chartType })}
                    onMapConfigChange={(mapConfig: DashboardMapConfig) => updateDashboardChart(selectedChart.id, { mapConfig })}
                    onXFieldsChange={(xFields) => updateDashboardChart(selectedChart.id, { xFields })}
                    onYFieldsChange={(yFields: DashboardYField[]) => updateDashboardChart(selectedChart.id, { yFields })}
                  />
                </div>

                {/* 底部操作：删除卡片 */}
                <div
                  className="node-config-footer"
                  style={{
                    padding: '10px 14px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleRemove(selectedChart.id)}
                    style={{
                      border: '1px solid #fecaca', background: '#ffffff', color: '#dc2626',
                      borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ef4444'
                      e.currentTarget.style.color = '#ffffff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff'
                      e.currentTarget.style.color = '#dc2626'
                    }}
                  >
                    删除此卡片
                  </button>
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

export default Dashboard