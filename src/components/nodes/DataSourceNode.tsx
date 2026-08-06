import { useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import { BaseNode, nodeSelectStyle } from './BaseNode'
import type { NodeStatus } from './BaseNode'
import { SAMPLE_DATASETS } from '@/data/sampleDatasets'
import type { PipelineNode, DataSourceConfig } from '@/types/pipeline'
import { useStore, parseFileToRows } from '@/store/useStore'

/** 数据源节点主题色：靛蓝 */
const DATA_SOURCE_COLOR = '#6366f1'

/** 支持的文件类型 */
const ACCEPTED_EXT = ['.xlsx', '.xls', '.csv']

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext))
}

/**
 * 数据源节点
 *
 * - 从内置示例数据集中选择一个，或拖拽/选择本地 Excel/CSV 文件
 * - 文件内容解析后缓存到 config（rows），供数据流引擎直接读取
 * - 只有输出 Handle（无输入），是流水线的起点
 */
export function DataSourceNode({ id, data, selected }: NodeProps<PipelineNode>) {
  const { updateNodeData } = useReactFlow()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const uploadedFile = useStore((s) => s.uploadedFile)

  const config = (data.config ?? {}) as DataSourceConfig
  const datasetId = config.datasetId ?? ''
  const fileName = config.fileName ?? ''
  const fileRows = config.rows ?? []
  const status = (data.status as NodeStatus | undefined) ?? 'idle'

  const dataset = SAMPLE_DATASETS.find((d) => d.id === datasetId)

  const handleDatasetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setFileError(null)
    if (val) {
      // 选择内置数据集：清空文件数据
      updateNodeData(id, { config: { datasetId: val, fileName: undefined, rows: undefined } })
    } else {
      updateNodeData(id, { config: { ...config, datasetId: '' } })
    }
  }

  /** 统一处理文件：校验 → 解析 → 写入 config */
  const handleFile = async (file: File) => {
    setFileError(null)
    if (!isAcceptedFile(file)) {
      setFileError('仅支持 .xlsx / .xls / .csv 文件')
      return
    }
    try {
      const rows = await parseFileToRows(file)
      if (rows.length === 0) {
        setFileError('文件中没有数据行')
        return
      }
      updateNodeData(id, {
        config: { datasetId: '', fileName: file.name, rows },
      })
    } catch (err: any) {
      setFileError(err.message || '文件解析失败')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  /** 节点区域拖入文件时高亮 */
  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const onDragOverFile = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const onDragLeaveFile = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  /** 移除文件，回到未选择状态 */
  const handleRemoveFile = () => {
    setFileError(null)
    updateNodeData(id, { config: { ...config, fileName: undefined, rows: undefined } })
  }

  return (
    <BaseNode
      icon="🗃️"
      title="数据源"
      color={DATA_SOURCE_COLOR}
      status={status}
      selected={selected}
      hasInput={false}
      hasOutput={true}
      nodeId={id}
      summary={
        fileName
          ? `📄 ${fileName} · ${fileRows.length} 行`
          : dataset
            ? `${dataset.name} · ${dataset.rows.length} 行`
            : '未选择数据源'
      }
    >
      <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 文件拖拽区 */}
        <div
          onDrop={onDropFile}
          onDragOver={onDragOverFile}
          onDragLeave={onDragLeaveFile}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? DATA_SOURCE_COLOR : '#c7c9d9'}`,
            borderRadius: 8,
            padding: '14px 10px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(99,102,241,0.08)' : '#fafbfe',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          title="将 Excel/CSV 文件拖到这里，或点击选择文件"
        >
          <div style={{ fontSize: 20, lineHeight: 1.2 }}>{dragOver ? '📥' : '📤'}</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 4, fontWeight: 500 }}>
            {dragOver ? '松开鼠标，导入文件' : '拖拽文件到此处'}
          </div>
          <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 2 }}>
            或点击选择 · 支持 xlsx / xls / csv
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* 文件解析错误提示 */}
        {fileError && (
          <div style={{ fontSize: 11, color: '#ef4444', lineHeight: 1.4 }}>
            ⚠️ {fileError}
          </div>
        )}

        {/* 已加载文件信息 */}
        {fileName && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 8px',
              background: '#eef2ff',
              border: '1px solid #c7d2fe',
              borderRadius: 6,
              fontSize: 11,
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#3730a3' }}>
              📄 {fileName}
            </span>
            <span style={{ color: '#6366f1', fontWeight: 600, flexShrink: 0 }}>{fileRows.length} 行</span>
            <button
              type="button"
              onClick={handleRemoveFile}
              title="移除文件"
              style={{
                border: '1px solid #c7d2fe',
                background: '#ffffff',
                color: '#ef4444',
                borderRadius: 4,
                padding: '0 6px',
                fontSize: 12,
                cursor: 'pointer',
                flexShrink: 0,
                lineHeight: '18px',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* 可视化模式已上传文件快捷入口 */}
        {uploadedFile && !fileName && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 8px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 6,
              fontSize: 11,
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#065f46' }}>
              📥 已上传: {uploadedFile.fileName}（{uploadedFile.rows.length} 行）
            </span>
            <button
              type="button"
              onClick={() => {
                setFileError(null)
                updateNodeData(id, {
                  config: { datasetId: '', fileName: uploadedFile.fileName, rows: uploadedFile.rows },
                })
              }}
              title="使用该文件作为本节点数据源"
              style={{
                border: '1px solid #10b981',
                background: '#10b981',
                color: '#fff',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 11,
                cursor: 'pointer',
                flexShrink: 0,
                lineHeight: '18px',
              }}
            >
              使用
            </button>
          </div>
        )}

        {/* 分隔线 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 10, color: '#9ca3af' }}>或使用内置数据集</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        <select
          value={datasetId}
          onChange={handleDatasetChange}
          style={nodeSelectStyle}
          className="nodrag"
        >
          <option value="">请选择...</option>
          {SAMPLE_DATASETS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.icon} {d.name}
            </option>
          ))}
        </select>

        {dataset && !fileName && (
          <div
            style={{
              marginTop: 2,
              padding: '6px 8px',
              background: '#f3f4f6',
              borderRadius: 6,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, color: '#111827' }}>{dataset.name}</div>
            <div style={{ color: '#6b7280' }}>{dataset.rows.length} 行</div>
            <div style={{ color: '#9ca3af', fontSize: 10 }}>{dataset.description}</div>
          </div>
        )}

        {!fileName && !dataset && (
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            拖拽文件或选择数据集作为流水线入口
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export default DataSourceNode
