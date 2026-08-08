import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeInputStyle, nodeLabelStyle, nodeButtonStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import type { PipelineNode, PptExportConfig } from '@/types/pipeline'

/** PPT 导出节点主题色：靛蓝紫 */
const PPT_COLOR = '#7c3aed'

/** 是否为桌面端（存在 electronAPI） */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI
}

/** 从 node.data.preview 提取行数 */
function getPreviewRowCount(preview: unknown): number | null {
  if (preview == null) return null
  if (
    typeof preview === 'object' &&
    !Array.isArray(preview) &&
    Array.isArray((preview as any).rows)
  ) {
    return (preview as any).rows.length
  }
  if (Array.isArray(preview)) return preview.length
  return null
}

/** 从 node.data.preview 提取多输入摘要（{ name, rowCount }[]），无则返回 null */
function getPreviewSheets(preview: unknown): { name: string; rowCount: number }[] | null {
  if (preview == null || typeof preview !== 'object') return null
  const sheets = (preview as any).sheets
  if (Array.isArray(sheets) && sheets.length > 0) {
    return sheets.map((s) => ({
      name: String(s?.name ?? '区块'),
      rowCount: Number(s?.rowCount ?? 0),
    }))
  }
  return null
}

/**
 * 从 node.data.preview 提取已生成 PPT 的信息（{ name, path } | null）
 */
function getPreviewPpt(preview: unknown): { name: string; path?: string } | null {
  if (preview == null || typeof preview !== 'object') return null
  const ppt = (preview as any).ppt
  if (!ppt || typeof ppt !== 'object') return null
  return { name: String(ppt.name ?? ''), path: ppt.path ? String(ppt.path) : undefined }
}

/**
 * 导出 PPT 节点
 *
 * - 流水线终点,基于一个 PPT 模板把上游数据替换到占位符中生成 .pptx
 * - 支持多个上游同时接入：每路数据作为模板的一个数据区块（区块名=上游节点标签）
 * - 只有输入 Handle，没有输出 Handle
 * - 桌面端：通过 Electron 调用本地 Python(excel2ppt template_filler) 真正替换
 * - 网页端：可上传模板并配置，实际替换需桌面端
 */
export function PptExportNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()
  const envElectron = isElectron()

  const config = (data.config as PptExportConfig) ?? {}
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const rowCount = getPreviewRowCount(data.preview)
  const hasPreview = rowCount != null
  const sheets = getPreviewSheets(data.preview)
  const pptInfo = getPreviewPpt(data.preview)

  const hasTemplate = !!(config.templatePath || config.templateFile)

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, outputName: e.target.value } })
  }

  const handleTimestampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, addTimestamp: e.target.checked } })
  }

  const handleMarkMissingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { config: { ...config, markMissing: e.target.checked } })
  }

  /** 桌面端：选择本地 PPT 模板文件 */
  const handlePickTemplate = async () => {
    const api = (window as any).electronAPI
    if (!api?.openPptTemplate) return
    const res = await api.openPptTemplate()
    if (res?.success && res.filePath) {
      updateNodeData(id, {
        config: {
          ...config,
          templatePath: res.filePath,
          templateName: res.fileName || undefined,
          templateFile: undefined,
        },
      })
    }
  }

  /** 网页端：上传模板文件 */
  const handleUploadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    updateNodeData(id, {
      config: {
        ...config,
        templateFile: file,
        templateName: file.name,
        templatePath: undefined,
      },
    })
    e.target.value = ''
  }

  const templateInputId = `ppt-tpl-input-${id}`

  return (
    <BaseNode
      icon="📽"
      title={config.outputName && config.outputName.trim() !== '' ? config.outputName : '导出 PPT'}
      color={PPT_COLOR}
      status={status}
      selected={selected}
      hasInput={true}
      hasOutput={false}
      nodeId={id}
      summary={
        pptInfo
          ? `已生成 ${pptInfo.name}`
          : sheets && sheets.length > 0
            ? `${sheets.length} 个区块 · ${rowCount ?? 0} 行`
            : hasPreview
              ? `${rowCount} 行`
              : hasTemplate
                ? (config.templateName ?? '已选模板')
                : '导出 PPT'
      }
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 模板选择 */}
        <label style={nodeLabelStyle}>PPT 模板</label>
        {envElectron ? (
          <button
            type="button"
            onClick={handlePickTemplate}
            style={{ ...nodeButtonStyle, textAlign: 'left', color: hasTemplate ? '#111827' : '#6b7280' }}
          >
            {config.templateName ? `📄 ${config.templateName}` : '📂 选择 .pptx 模板'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => document.getElementById(templateInputId)?.click()}
              style={{ ...nodeButtonStyle, textAlign: 'left', color: hasTemplate ? '#111827' : '#6b7280' }}
            >
              {config.templateName ? `📄 ${config.templateName}` : '📤 上传 .pptx 模板'}
            </button>
            <input
              id={templateInputId}
              type="file"
              accept=".pptx"
              style={{ display: 'none' }}
              onChange={handleUploadTemplate}
            />
          </>
        )}

        {/* 输出文件名 */}
        <label style={nodeLabelStyle}>输出文件名（可选）</label>
        <input
          type="text"
          value={config.outputName ?? ''}
          placeholder="默认取节点标签"
          onChange={handleNameChange}
          style={nodeInputStyle}
          className="nodrag"
        />

        {/* 时间戳 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#374151',
            cursor: 'pointer',
          }}
          className="nodrag"
        >
          <input
            type="checkbox"
            checked={config.addTimestamp ?? true}
            onChange={handleTimestampChange}
            style={{ width: 14, height: 14, cursor: 'pointer' }}
          />
          文件名追加时间戳
        </label>

        {/* 缺失标注 */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#374151',
            cursor: 'pointer',
          }}
          className="nodrag"
        >
          <input
            type="checkbox"
            checked={config.markMissing ?? true}
            onChange={handleMarkMissingChange}
            style={{ width: 14, height: 14, cursor: 'pointer' }}
          />
          未替换占位符黄底标注
        </label>

        {/* 状态区 */}
        {pptInfo ? (
          <div
            style={{
              padding: '6px 8px',
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: 6,
              fontSize: 11,
              color: '#6d28d9',
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>✅ 已生成 PPT</div>
            <div style={{ fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pptInfo.name}
            </div>
            {pptInfo.path && (
              <div style={{ fontSize: 10, color: '#8b5cf6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pptInfo.path}
              </div>
            )}
          </div>
        ) : sheets && sheets.length > 0 ? (
          <div
            style={{
              padding: '6px 8px',
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              borderRadius: 6,
              fontSize: 11,
              color: '#6d28d9',
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              已连接 {sheets.length} 个数据区块 · 共 {rowCount ?? 0} 行
            </div>
            {sheets.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10.5 }}>
                <span style={{ color: '#5b21b6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📊 {s.name}
                </span>
                <span style={{ flexShrink: 0, color: '#6d28d9' }}>{s.rowCount} 行</span>
              </div>
            ))}
          </div>
        ) : hasPreview ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>已连接</span>
            <span>{rowCount} 行</span>
          </div>
        ) : (
          <div
            style={{
              padding: '6px 8px',
              background: '#f3f4f6',
              borderRadius: 6,
              fontSize: 11,
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            选择模板并连接上游数据后运行流水线
          </div>
        )}

        {!envElectron && (
          <div style={{ fontSize: 10.5, color: '#f59e0b', lineHeight: 1.5 }}>
            ⚠ 网页端仅支持配置与预览，实际生成 PPT 需在桌面版运行（内置 Python 模板填充引擎）。
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default PptExportNode