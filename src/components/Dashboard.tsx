import { useStore } from '@/store/useStore'
import { ChartCard } from './ChartCard'
import type { ChartType } from '@/types'

/**
 * 仪表盘 —— 多图表卡片网格
 * 每张卡片独立选字段、选类型、出图，可自由增删
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
        <span className="dashboard-sub">每张卡片独立配置一个图表</span>
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
            encoding={card.encoding as any}
            chartType={card.chartType}
            onTitleChange={(title) => updateDashboardChart(card.id, { title })}
            onEncodingChange={(encoding) => updateDashboardChart(card.id, { encoding })}
            onChartTypeChange={(chartType: ChartType) => updateDashboardChart(card.id, { chartType })}
            onRemove={() => removeDashboardChart(card.id)}
          />
        ))}

        {dashboardCharts.length === 0 && (
          <div className="dashboard-empty">
            <div className="empty-icon">📊</div>
            <div>还没有图表卡片</div>
            <div className="hint">点击右上角「添加图表卡片」，每张卡片可选择不同的字段绘制自己的图</div>
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