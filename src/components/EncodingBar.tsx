import { useStore } from '@/store/useStore'
import { FieldKind, type SlotName, type Aggregation } from '@/types'

const SLOT_LABELS: Record<string, string> = {
  x: 'X 轴',
  y: 'Y 轴',
  color: '颜色',
  size: '大小',
  filter: '筛选',
}

const SLOT_ORDER: SlotName[] = ['x', 'y', 'color', 'size', 'filter']

/**
 * 编码槽栏 —— 类 Tableau 的 Shelves
 * 桌面端：拖拽字段到对应槽位
 * 移动端：先点击字段选中 → 再点击槽位分配
 */
export function EncodingBar() {
  const { encoding, fields, setSlot, selectedField, selectField, setSidebarOpen } = useStore()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    e.currentTarget.classList.add('drag-over')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over')
  }

  const handleDrop = (e: React.DragEvent, slot: SlotName) => {
    e.preventDefault()
    e.currentTarget.classList.remove('drag-over')

    const fieldName = e.dataTransfer.getData('field')
    const kindStr = e.dataTransfer.getData('kind') as FieldKind

    if (!fieldName) return

    // 根据字段类型设置默认聚合方式
    const isMeasure = kindStr === FieldKind.Measure
    const aggregation: Aggregation = isMeasure ? 'sum' : 'count'

    setSlot(slot, { field: fieldName, aggregation })
  }

  // 移动端：点击槽位分配选中的字段
  const handleSlotClick = (slot: SlotName) => {
    if (!selectedField) return

    const isMeasure = selectedField.kind === FieldKind.Measure
    const aggregation: Aggregation = isMeasure ? 'sum' : 'count'

    setSlot(slot, { field: selectedField.name, aggregation })
    selectField(null)      // 清除选中状态
    setSidebarOpen(false)  // 关闭侧边栏
  }

  const handleRemove = (slot: SlotName) => {
    setSlot(slot, null)
  }

  const handleAggChange = (slot: SlotName, agg: Aggregation) => {
    const item = encoding[slot]
    if (item && 'field' in (item as any)) {
      setSlot(slot, { field: (item as any).field, aggregation: agg })
    }
  }

  const AGG_OPTIONS: Aggregation[] = ['sum', 'avg', 'count', 'min', 'max', 'count_distinct']

  return (
    <div className="encoding-bar">
      {SLOT_ORDER.map((slot) => {
        const item = encoding[slot]
        const isFilled = !!item

        return (
          <div
            key={slot}
            className={`slot ${isFilled ? 'filled' : ''} ${selectedField ? 'clickable' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, slot)}
            onClick={() => handleSlotClick(slot)}
          >
            <span className="slot-label">{SLOT_LABELS[slot]}</span>
            {isFilled && item && 'field' in (item as any) && (
              <div className="slot-content">
                <span
                  className={`chip ${
                    fields.find((f) => f.name === (item as any).field)?.kind === FieldKind.Measure
                      ? 'measure'
                      : ''
                  }`}
                >
                  {(item as any).field}
                  {fields.find((f) => f.name === (item as any).field)?.kind === FieldKind.Measure && (
                    <select
                      className="agg-select"
                      value={(item as any).aggregation}
                      onChange={(e) => handleAggChange(slot, e.target.value as Aggregation)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {AGG_OPTIONS.map((agg) => (
                        <option key={agg} value={agg}>
                          {agg === 'count_distinct' ? 'distinct' : agg}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="remove" onClick={(e) => { e.stopPropagation(); handleRemove(slot) }}>
                    ×
                  </span>
                </span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
