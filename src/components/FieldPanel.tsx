import { useStore } from '@/store/useStore'
import { FieldKind } from '@/types'

/**
 * 字段侧边栏 —— 展示所有字段，分维度/度量两组
 * 桌面端：拖拽字段到编码槽
 * 移动端：点击选中字段 → 点击编码槽分配
 */
export function FieldPanel() {
  const fields = useStore((s) => s.fields)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const selectedField = useStore((s) => s.selectedField)
  const selectField = useStore((s) => s.selectField)

  const dimensions = fields.filter((f) => f.kind === FieldKind.Dimension)
  const measures = fields.filter((f) => f.kind === FieldKind.Measure)

  const handleDragStart = (e: React.DragEvent, fieldName: string, kind: FieldKind) => {
    e.dataTransfer.setData('field', fieldName)
    e.dataTransfer.setData('kind', kind)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleClick = (fieldName: string, kind: FieldKind) => {
    // 移动端：点击选中/取消选中字段
    if (selectedField?.name === fieldName) {
      selectField(null)
    } else {
      selectField({ name: fieldName, kind })
    }
  }

  const renderField = (f: { name: string; dataType: string; kind: FieldKind }) => {
    const isSelected = selectedField?.name === f.name
    return (
      <div
        key={f.name}
        className={`field-item ${isSelected ? 'selected' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, f.name, f.kind)}
        onClick={() => handleClick(f.name, f.kind)}
      >
        <span className={`field-icon ${f.kind === FieldKind.Dimension ? 'dimension' : 'measure'}`} />
        <span className="field-name">{f.name}</span>
        <span className="field-type">{f.dataType}</span>
      </div>
    )
  }

  return (
    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-section">
        <h3>数据字段</h3>
        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
          拖拽字段到编码槽
        </div>
      </div>
      <div className="field-list">
        {dimensions.length > 0 && (
          <div className="field-group">
            <div className="field-group-title">
              <span className="dot dimension" />
              维度 ({dimensions.length})
            </div>
            {dimensions.map(renderField)}
          </div>
        )}
        {measures.length > 0 && (
          <div className="field-group">
            <div className="field-group-title">
              <span className="dot measure" />
              度量 ({measures.length})
            </div>
            {measures.map(renderField)}
          </div>
        )}
        {fields.length === 0 && (
          <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--text-light)' }}>
            请先加载数据文件
          </div>
        )}
      </div>
    </div>
  )
}
