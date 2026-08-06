import { useStore } from '@/store/useStore'
import { ChartCard } from './ChartCard'
import type { DashboardYField, DashboardMapConfig } from '@/types'

/**
 * 仪表盘 —— 多图表卡片网格
 * 每张卡片独立选数据源、下拉配置多X/多Y字段或地图，每Y独立图表类型
 */
export function Dashboard() {
  const dashboardCharts = useStore((s) => s.dashboardCharts)
  const addDashboardChart = useStore((s) => s.addDashboardChart)
  const updateDashboardChart = useStore((s) => s.updateDashboardChart)
  const removeDashboardChart = useStore((s) => s.removeDashboardChart)

  return (
    <div className="dashboard">
      <div className="dashboard-toolbar">
        <span className="dashboard-title">数据仪表盘</span>
        <span className="dashboard-sub">每张卡片独立选数据源，支持组合图或地图</span>
        <div style={{ flex: 1 }} />
        <button className="add-chart-btn" onClick={addDashboardChart}>
          + 添加图表卡片
        </button>
      </div>

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
            onTitleChange={(title) => updateDashboardChart(card.id, { title })}
            onDataSourceChange={(dataSource) => updateDashboardChart(card.id, { dataSource })}
            onChartTypeChange={(chartType) => updateDashboardChart(card.id, { chartType })}
            onMapConfigChange={(mapConfig: DashboardMapConfig) => updateDashboardChart(card.id, { mapConfig })}
            onXFieldsChange={(xFields) => updateDashboardChart(card.id, { xFields })}
            onYFieldsChange={(yFields: DashboardYField[]) => updateDashboardChart(card.id, { yFields })}
            onRemove={() => removeDashboardChart(card.id)}
          />
        ))}

        {dashboardCharts.length === 0 && (
          <div className="dashboard-empty">
            <div className="empty-icon">📊</div>
            <div>还没有图表卡片</div>
            <div className="hint">
              点击右上角「添加图表卡片」，每张卡片可独立选择数据源，下拉配置多个 X / Y 字段绘制组合图，或选择地图展示经纬度
            </div>
            <button className="add-chart-btn" onClick={addDashboardChart}>
              + 添加第一张图表卡片
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard