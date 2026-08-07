import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { FieldKind } from '@/types'

/**
 * 数据源概览侧边栏 —— 只读展示所有可用的数据源及其字段
 *
 * 可视化采用多卡片仪表盘：每张卡片在右侧栏通过下拉选择数据源与字段。
 * 本侧边栏只做只读概览，帮助用户快速查看当前有哪些数据源、各自包含哪些字段，
 * 不参与卡片配置（不拖拽、不点选）。
 */
export function FieldPanel() {
  const catalog = useStore((s) => s.catalog)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (key: string) =>
    setExpanded((cur) => ({ ...cur, [key]: !cur[key] }))

  return (
    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-section">
        <h3>数据源概览</h3>
        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
          {catalog.length} 个数据源 · 只读
        </div>
      </div>

      <div className="field-list">
        {catalog.length === 0 && (
          <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text-light)' }}>
            暂无数据源，请先上传文件或运行数据流
          </div>
        )}

        {catalog.map((ct) => {
          const isOpen = expanded[ct.key]
          const dimensions = ct.fields.filter((f) => f.kind === FieldKind.Dimension)
          const measures = ct.fields.filter((f) => f.kind === FieldKind.Measure)

          return (
            <div className="field-group" key={ct.key}>
              {/* 数据源标题：可点击展开/收起字段 */}
              <div
                className="ds-overview-header"
                onClick={() => toggleExpand(ct.key)}
                title={isOpen ? '收起字段' : '展开字段'}
              >
                <span className={`ds-caret ${isOpen ? 'open' : ''}`}>▸</span>
                <span className="ds-name">{ct.name}</span>
                <span className="ds-meta">
                  {ct.rows.length} 行 · {ct.fields.length} 字段
                </span>
              </div>

              {isOpen && (
                <div className="ds-overview-fields">
                  {dimensions.length > 0 && (
                    <div className="ds-field-group">
                      <div className="field-group-title">
                        <span className="dot dimension" />
                        维度 ({dimensions.length})
                      </div>
                      {dimensions.map((f) => (
                        <div className="ds-field-item" key={f.name}>
                          <span className="field-icon dimension" />
                          <span className="field-name">{f.name}</span>
                          <span className="field-type">{f.dataType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {measures.length > 0 && (
                    <div className="ds-field-group">
                      <div className="field-group-title">
                        <span className="dot measure" />
                        度量 ({measures.length})
                      </div>
                      {measures.map((f) => (
                        <div className="ds-field-item" key={f.name}>
                          <span className="field-icon measure" />
                          <span className="field-name">{f.name}</span>
                          <span className="field-type">{f.dataType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ct.fields.length === 0 && (
                    <div className="ds-empty-fields">无字段</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FieldPanel