import { useCallback, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  exportTemplateToFile,
  importTemplateFromFile,
  updateTemplate,
  type PipelineTemplate,
} from '@/lib/templateStore'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TemplateManagerProps {
  /** 当前画布的节点（用于保存为模板） */
  nodes: Node[]
  /** 当前画布的边（用于保存为模板） */
  edges: Edge[]
  /** 加载模板到画布的回调 */
  onLoad: (nodes: Node[], edges: Edge[]) => void
  /** 关闭弹窗 */
  onClose: () => void
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

/**
 * 模板管理弹窗
 *
 * 功能：
 * - 保存当前画布为模板（输入名称 + 描述）
 * - 查看已保存的模板列表
 * - 加载模板到画布
 * - 导出模板为 JSON 文件（分享）
 * - 导入 JSON 文件为模板
 * - 删除模板
 * - 更新已有模板（覆盖为当前画布内容）
 */
export function TemplateManager({ nodes, edges, onLoad, onClose }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<PipelineTemplate[]>(() => listTemplates())
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /** 显示短暂提示 */
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  /** 刷新模板列表 */
  const refresh = useCallback(() => {
    setTemplates(listTemplates())
  }, [])

  /** 保存当前画布为模板 */
  const handleSave = useCallback(() => {
    if (nodes.length === 0) {
      showToast('画布为空，无法保存')
      return
    }
    if (!templateName.trim()) {
      showToast('请输入模板名称')
      return
    }

    saveTemplate(templateName, templateDesc, nodes, edges)
    setTemplateName('')
    setTemplateDesc('')
    setShowSaveForm(false)
    refresh()
    showToast(`模板"${templateName}"已保存`)
  }, [nodes, edges, templateName, templateDesc, refresh, showToast])

  /** 加载模板到画布 */
  const handleLoad = useCallback(
    (template: PipelineTemplate) => {
      // 动态导入避免循环依赖
      import('@/lib/templateStore').then(({ loadTemplate }) => {
        const { nodes: loadedNodes, edges: loadedEdges } = loadTemplate(template)
        onLoad(loadedNodes, loadedEdges)
        onClose()
      })
    },
    [onLoad, onClose],
  )

  /** 导出模板为 JSON 文件 */
  const handleExport = useCallback(
    (template: PipelineTemplate) => {
      exportTemplateToFile(template)
      showToast(`正在导出"${template.name}"...`)
    },
    [showToast],
  )

  /** 删除模板 */
  const handleDelete = useCallback(
    (template: PipelineTemplate) => {
      if (!confirm(`确定要删除模板"${template.name}"吗？`)) return
      deleteTemplate(template.id)
      refresh()
      showToast(`已删除"${template.name}"`)
    },
    [refresh, showToast],
  )

  /** 更新模板为当前画布内容 */
  const handleUpdate = useCallback(
    (template: PipelineTemplate) => {
      if (nodes.length === 0) {
        showToast('画布为空，无法更新')
        return
      }
      if (!confirm(`用当前画布内容覆盖模板"${template.name}"？`)) return
      updateTemplate(template.id, { nodes, edges })
      refresh()
      showToast(`已更新"${template.name}"`)
    },
    [nodes, edges, refresh, showToast],
  )

  /** 导入 JSON 文件 */
  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const tpl = await importTemplateFromFile(file)
        refresh()
        showToast(`已导入模板"${tpl.name}"`)
      } catch (err) {
        showToast((err as Error).message)
      }
      e.target.value = ''
    },
    [refresh, showToast],
  )

  /** 格式化日期 */
  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    } catch {
      return iso
    }
  }

  return (
    <div className="tpl-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="tpl-modal-header">
          <span className="tpl-modal-title">📂 流水线模板管理</span>
          <button className="tpl-close-btn" onClick={onClose}>×</button>
        </div>

        {/* 操作区 */}
        <div className="tpl-actions">
          {!showSaveForm ? (
            <button className="tpl-btn tpl-btn-primary" onClick={() => setShowSaveForm(true)}>
              💾 保存当前画布为模板
            </button>
          ) : (
            <div className="tpl-save-form">
              <input
                type="text"
                className="tpl-input"
                placeholder="模板名称"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
              />
              <input
                type="text"
                className="tpl-input"
                placeholder="模板描述（可选）"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
              />
              <div className="tpl-save-buttons">
                <button className="tpl-btn tpl-btn-primary" onClick={handleSave}>
                  确认保存
                </button>
                <button className="tpl-btn tpl-btn-secondary" onClick={() => setShowSaveForm(false)}>
                  取消
                </button>
              </div>
            </div>
          )}

          <button className="tpl-btn tpl-btn-secondary" onClick={() => fileInputRef.current?.click()}>
            📥 导入 JSON 模板
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>

        {/* 当前画布信息 */}
        <div className="tpl-canvas-info">
          当前画布: {nodes.length} 节点 · {edges.length} 连接
        </div>

        {/* 模板列表 */}
        <div className="tpl-list-container">
          {templates.length === 0 ? (
            <div className="tpl-empty">
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div>暂无已保存的模板</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                搭建好流水线后点击"保存当前画布为模板"
              </div>
            </div>
          ) : (
            templates.map((tpl) => (
              <div key={tpl.id} className="tpl-card">
                <div className="tpl-card-header">
                  <span className="tpl-card-name">{tpl.name}</span>
                  <span className="tpl-card-meta">
                    {tpl.nodes.length} 节点 · {tpl.edges.length} 连接
                  </span>
                </div>
                {tpl.description && (
                  <div className="tpl-card-desc">{tpl.description}</div>
                )}
                <div className="tpl-card-time">
                  更新于 {formatDate(tpl.updatedAt)}
                </div>
                <div className="tpl-card-actions">
                  <button className="tpl-btn tpl-btn-sm tpl-btn-primary" onClick={() => handleLoad(tpl)}>
                    📦 加载
                  </button>
                  <button className="tpl-btn tpl-btn-sm tpl-btn-secondary" onClick={() => handleUpdate(tpl)}>
                    🔄 更新
                  </button>
                  <button className="tpl-btn tpl-btn-sm tpl-btn-secondary" onClick={() => handleExport(tpl)}>
                    📤 导出
                  </button>
                  <button className="tpl-btn tpl-btn-sm tpl-btn-danger" onClick={() => handleDelete(tpl)}>
                    🗑 删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Toast 提示 */}
        {toast && (
          <div className="tpl-toast">{toast}</div>
        )}
      </div>
    </div>
  )
}

export default TemplateManager
