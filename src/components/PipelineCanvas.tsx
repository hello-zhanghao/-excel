import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import '@/styles/pipeline.css'

import { nodeTypes } from '@/components/nodes'
import { NodeConfigProvider, useNodeConfig } from '@/components/nodes/NodeConfigContext'
import { NodeConfigPanel } from '@/components/nodes/NodeConfigPanel'
import { executePipeline } from '@/lib/pipelineEngine'
import { SAMPLE_DATASETS } from '@/data/sampleDatasets'
import { inferFieldsFromRows } from '@/data/sampleDatasets'
import type { PipelineNodeData, PipelineNodeType, NodeOutput } from '@/types/pipeline'
import { useStore } from '@/store/useStore'
import { TemplateManager } from '@/components/TemplateManager'
import * as XLSX from 'xlsx'

/** 组件面板中的可拖拽项 */
const PALETTE_ITEMS: { type: PipelineNodeType; label: string; icon: string }[] = [
  { type: 'dataSource', label: '数据源', icon: '📄' },
  { type: 'filter', label: '筛选', icon: '🔍' },
  { type: 'calculate', label: '计算字段', icon: '🧮' },
  { type: 'aggregate', label: '聚合', icon: '📊' },
  { type: 'bin', label: '分箱', icon: '📦' },
  { type: 'sort', label: '排序', icon: '↕️' },
  { type: 'selectColumns', label: '列筛选', icon: '☰' },
  { type: 'join', label: '关联', icon: '🔗' },
  { type: 'union', label: '合并', icon: '📋' },
  { type: 'output', label: '输出', icon: '🎯' },
  { type: 'excelExport', label: '导出 Excel', icon: '⤓' },
]

/** 各节点类型的默认配置 */
function getDefaultConfig(type: PipelineNodeType): Record<string, any> {
  switch (type) {
    case 'dataSource':
      return { datasetId: SAMPLE_DATASETS[0]?.id ?? 'sales' }
    case 'filter':
      return { conditions: [{ field: '', operator: 'gt', value: '' }] }
    case 'calculate':
      return { newField: 'new_field', expression: '' }
    case 'aggregate':
      return { groupBy: [], measures: [{ field: '', aggregation: 'sum' }] }
    case 'bin':
      return { field: '', bins: 4, method: 'equalWidth' }
    case 'sort':
      return { field: '', order: 'desc' }
    case 'selectColumns':
      return { fields: [] }
    case 'join':
      return { leftKey: '', rightKey: '', joinType: 'inner' }
    case 'union':
      return { distinct: false }
    case 'output':
      return {}
    case 'excelExport':
      return { filename: '' }
    default:
      return {}
  }
}

/** 各节点类型的默认标签 */
const NODE_LABELS: Record<PipelineNodeType, string> = {
  dataSource: '数据源',
  filter: '筛选',
  calculate: '计算字段',
  aggregate: '聚合',
  bin: '分箱',
  sort: '排序',
  selectColumns: '列筛选',
  join: '关联',
  union: '合并',
  output: '输出',
  excelExport: '导出 Excel',
}

/**
 * 将节点输出导出为 Excel 文件，返回导出文件名；无数据时返回 null。
 */
function exportNodeToExcel(
  node: Node,
  result: NodeOutput,
  defaults?: { label?: string },
): string | null {
  if (!result || result.rows.length === 0) return null

  const columns = result.fields.map((f) => f.name)
  const aoa: any[][] = [columns]
  for (const row of result.rows) {
    aoa.push(columns.map((col) => row[col] ?? ''))
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = columns.map((col) => ({ wch: Math.max(col.length * 2, 12) }))

  // 文件名：优先 excelExport 节点配置的 filename，其次节点标签
  const nodeConfig = (node.data?.config as any) ?? {}
  const customName = (nodeConfig.filename as string) || ''
  const sheetName = (
    customName ||
    defaults?.label ||
    (node.data?.label as string) ||
    'export'
  ).slice(0, 25) || 'export'

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  const filename = `${sheetName}_${Date.now()}.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}

let nodeIdCounter = 0
function getNodeId(): string {
  nodeIdCounter++
  return `node_${Date.now()}_${nodeIdCounter}`
}

function PipelineCanvasInner() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const { selectNode } = useNodeConfig()
  // 最近一次运行的完整结果（供导出 Excel 使用）
  const lastResultsRef = useRef<Map<string, NodeOutput> | null>(null)
  const [previewData, setPreviewData] = useState<{
    rows: Record<string, any>[]
    fields: any[]
    nodeId: string
    nodeLabel?: string
    rowCount?: number
  } | null>(null)
  const [selectedOutputNodeId, setSelectedOutputNodeId] = useState<string | null>(null)
  const [showTemplateMgr, setShowTemplateMgr] = useState(false)

  const { setPipelineData } = useStore() as any

  /** 从组件面板拖拽开始 */
  const onDragStart = (event: React.DragEvent, nodeType: PipelineNodeType) => {
    event.dataTransfer.setData('application/pipeline-node', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  /** 创建一个新节点并添加到画布 */
  const createNode = useCallback(
    (type: PipelineNodeType, position?: { x: number; y: number }) => {
      if (!rfInstance) return

      // 如果未指定位置，放在画布中心
      const pos = position ?? rfInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })

      const newNode: Node = {
        id: getNodeId(),
        type,
        position: pos,
        data: {
          label: NODE_LABELS[type],
          config: getDefaultConfig(type),
        } as PipelineNodeData,
      }

      setNodes((nds) => [...nds, newNode])
    },
    [rfInstance, setNodes],
  )

  /** 点击组件面板项，在画布中心添加节点 */
  const onPaletteClick = useCallback(
    (type: PipelineNodeType) => {
      createNode(type)
    },
    [createNode],
  )

  /** 画布上拖放放置 */
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/pipeline-node') as PipelineNodeType
      if (!type || !rfInstance) return

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      createNode(type, position)
    },
    [rfInstance, createNode],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  /** 连接两个节点 */
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds))
    },
    [setEdges],
  )

  /** 运行整个流水线 */
  const onRun = useCallback(async () => {
    if (nodes.length === 0) return
    setIsRunning(true)

    // 标记所有节点为 running
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: 'running' } })),
    )

    try {
      const results = await executePipeline(nodes as any, edges)
      // 保存完整结果，供导出 Excel 使用
      lastResultsRef.current = results

      // 更新节点状态和预览
      setNodes((nds) =>
        nds.map((n) => {
          const result = results.get(n.id)
          if (result) {
            return {
              ...n,
              data: {
                ...n.data,
                status: 'success' as const,
                preview: {
                  rows: result.rows.slice(0, 20),
                  fields: result.fields,
                  rowCount: result.rows.length,
                },
              },
            }
          }
          return { ...n, data: { ...n.data, status: 'error' as const } }
        }),
      )

      // 找到 output 节点的结果，设为预览
      const outputNode = nodes.find((n) => n.type === 'output')
      if (outputNode) {
        const output = results.get(outputNode.id)
        if (output) {
          setPreviewData({
            rows: output.rows.slice(0, 50),
            fields: output.fields,
            nodeId: outputNode.id,
            nodeLabel: (outputNode.data.label as string) || '输出',
            rowCount: output.rows.length,
          })
          setSelectedOutputNodeId(outputNode.id)
          // 将结果传给全局 store，供可视化使用
          setPipelineData?.({
            rows: output.rows,
            fields: output.fields,
          })
        }
      } else {
        // 没有 output 节点，取最后一个节点的结果
        const lastNode = nodes[nodes.length - 1]
        const output = results.get(lastNode.id)
        if (output) {
          setPreviewData({
            rows: output.rows.slice(0, 50),
            fields: output.fields,
            nodeId: lastNode.id,
            nodeLabel: (lastNode.data.label as string) || '末节点',
            rowCount: output.rows.length,
          })
          setPipelineData?.({
            rows: output.rows,
            fields: output.fields,
          })
        }
      }

      // 自动导出所有 excelExport 节点的数据为 Excel
      const exportNodes = nodes.filter((n) => n.type === 'excelExport')
      if (exportNodes.length > 0) {
        const exportedNames: string[] = []
        for (const en of exportNodes) {
          const out = results.get(en.id)
          if (out && out.rows.length > 0) {
            const fn = exportNodeToExcel(en, out)
            if (fn) exportedNames.push(fn)
          }
        }
        if (exportedNames.length > 0) {
          setExportMsg(`✅ 导出节点完成，已生成 ${exportedNames.length} 个 Excel 文件：${exportedNames.join('、')}`)
          setTimeout(() => setExportMsg(null), 5000)
        }
      }
    } catch (err: any) {
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, status: 'error' as const } })),
      )
      console.error('Pipeline execution error:', err)
    } finally {
      setIsRunning(false)
    }
  }, [nodes, edges, setNodes, setPipelineData])

  /** 清空画布 */
  const onClear = useCallback(() => {
    setNodes([])
    setEdges([])
    setPreviewData(null)
  }, [setNodes, setEdges])

  /** 从模板加载到画布 */
  const onLoadTemplate = useCallback(
    (loadedNodes: Node[], loadedEdges: Edge[]) => {
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      setPreviewData(null)
      // 自动适配视图
      setTimeout(() => rfInstance?.fitView({ padding: 0.2 }), 100)
    },
    [setNodes, setEdges, rfInstance],
  )

  /** 快速搭建示例流水线：数据源 → 筛选 → 聚合 → 输出 */
  const onQuickDemo = useCallback(() => {
    if (!rfInstance) return

    const dsId = getNodeId()
    const filterId = getNodeId()
    const aggId = getNodeId()
    const outputId = getNodeId()

    const demoNodes: Node[] = [
      {
        id: dsId,
        type: 'dataSource',
        position: { x: 0, y: 100 },
        data: {
          label: '数据源',
          config: { datasetId: SAMPLE_DATASETS[0]?.id ?? 'sales' },
        } as PipelineNodeData,
      },
      {
        id: filterId,
        type: 'filter',
        position: { x: 300, y: 100 },
        data: {
          label: '筛选',
          config: {
            conditions: [{ field: 'sales', operator: 'gt', value: 0 }],
            logic: 'AND',
          },
        } as PipelineNodeData,
      },
      {
        id: aggId,
        type: 'aggregate',
        position: { x: 600, y: 100 },
        data: {
          label: '聚合',
          config: {
            groupBy: ['region'],
            measures: [{ field: 'sales', aggregation: 'sum', alias: 'total_sales' }],
          },
        } as PipelineNodeData,
      },
      {
        id: outputId,
        type: 'output',
        position: { x: 900, y: 100 },
        data: {
          label: '输出',
          config: { name: '区域销售汇总' },
        } as PipelineNodeData,
      },
    ]

    const demoEdges: Edge[] = [
      { id: `e-${dsId}-${filterId}`, source: dsId, target: filterId, animated: true },
      { id: `e-${filterId}-${aggId}`, source: filterId, target: aggId, animated: true },
      { id: `e-${aggId}-${outputId}`, source: aggId, target: outputId, animated: true },
    ]

    setNodes(demoNodes)
    setEdges(demoEdges)

    // 自动适配视图
    setTimeout(() => rfInstance.fitView({ padding: 0.2 }), 100)
  }, [rfInstance, setNodes, setEdges])

  /** 快速搭建 Join 示例：销售数据 + 区域信息 → 关联 → 聚合 → 输出 */
  const onJoinDemo = useCallback(() => {
    if (!rfInstance) return

    const salesId = getNodeId()
    const regionsId = getNodeId()
    const joinId = getNodeId()
    const aggId = getNodeId()
    const outputId = getNodeId()

    const demoNodes: Node[] = [
      {
        id: salesId,
        type: 'dataSource',
        position: { x: 0, y: 0 },
        data: {
          label: '数据源',
          config: { datasetId: 'sales' },
        } as PipelineNodeData,
      },
      {
        id: regionsId,
        type: 'dataSource',
        position: { x: 0, y: 200 },
        data: {
          label: '数据源',
          config: { datasetId: 'regions' },
        } as PipelineNodeData,
      },
      {
        id: joinId,
        type: 'join',
        position: { x: 350, y: 100 },
        data: {
          label: '关联',
          config: {
            leftKey: 'region',
            rightKey: 'region',
            joinType: 'left' as const,
          },
        } as PipelineNodeData,
      },
      {
        id: aggId,
        type: 'aggregate',
        position: { x: 650, y: 100 },
        data: {
          label: '聚合',
          config: {
            groupBy: ['region', 'consumeLevel'],
            measures: [
              { field: 'sales', aggregation: 'sum', alias: 'total_sales' },
              { field: 'population', aggregation: 'avg', alias: 'avg_population' },
            ],
          },
        } as PipelineNodeData,
      },
      {
        id: outputId,
        type: 'output',
        position: { x: 950, y: 100 },
        data: {
          label: '输出',
          config: { name: '区域销售+人口关联' },
        } as PipelineNodeData,
      },
    ]

    const demoEdges: Edge[] = [
      { id: `e-${salesId}-${joinId}`, source: salesId, target: joinId, targetHandle: 'left', animated: true },
      { id: `e-${regionsId}-${joinId}`, source: regionsId, target: joinId, targetHandle: 'right', animated: true },
      { id: `e-${joinId}-${aggId}`, source: joinId, target: aggId, animated: true },
      { id: `e-${aggId}-${outputId}`, source: aggId, target: outputId, animated: true },
    ]

    setNodes(demoNodes)
    setEdges(demoEdges)

    setTimeout(() => rfInstance.fitView({ padding: 0.2 }), 100)
  }, [rfInstance, setNodes, setEdges])

  /** 点击节点查看预览 */
  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      const data = node.data as PipelineNodeData
      const label = (data.label as string) || NODE_LABELS[node.type] || '节点'
      if (data.preview) {
        setPreviewData({
          rows: data.preview.rows,
          fields: data.preview.fields,
          nodeId: node.id,
          nodeLabel: label,
          rowCount: data.preview.rowCount,
        })
        setSelectedOutputNodeId(node.id)
      } else {
        // 有上游但未运行，提示先运行
        setPreviewData({
          rows: [],
          fields: [],
          nodeId: node.id,
          nodeLabel: label,
          rowCount: 0,
        })
        setSelectedOutputNodeId(node.id)
      }
    },
    [],
  )

  /** 预览面板关闭 */
  const onClosePreview = useCallback(() => {
    setPreviewData(null)
    setSelectedOutputNodeId(null)
  }, [])

  /** 导出当前预览节点为 Excel 文件 */
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const handleExportExcel = useCallback(() => {
    if (!previewData) return
    const result = lastResultsRef.current?.get(previewData.nodeId)
    if (!result || result.rows.length === 0) {
      setExportMsg('该节点暂无数据可导出，请先运行流水线')
      setTimeout(() => setExportMsg(null), 3000)
      return
    }

    setExporting(true)
    try {
      const node = nodes.find((n) => n.id === previewData.nodeId)
      const filename = exportNodeToExcel(node as Node, result, {
        label: previewData.nodeLabel,
      })
      if (filename) {
        setExportMsg(`✅ 已导出 ${result.rows.length} 行到 ${filename}`)
      } else {
        setExportMsg('该节点暂无数据可导出')
      }
      setTimeout(() => setExportMsg(null), 3000)
    } catch (err: any) {
      setExportMsg(`❌ 导出失败: ${err.message}`)
      setTimeout(() => setExportMsg(null), 3000)
    } finally {
      setExporting(false)
    }
  }, [previewData, nodes])

  return (
    <div className="pipeline-container">
      {/* 组件面板 */}
      <div className="pipeline-palette">
        <div className="palette-title">数据处理组件</div>
        <div style={{ fontSize: 10, color: 'var(--text-light)', padding: '0 12px 8px' }}>
          点击添加 · 或拖拽到画布
        </div>
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            onClick={() => onPaletteClick(item.type)}
            title={`点击添加${item.label}到画布`}
          >
            <span className="palette-icon">{item.icon}</span>
            <span className="palette-label">{item.label}</span>
          </div>
        ))}

        {/* 快速示例按钮 */}
        <div style={{ padding: '8px 12px', marginTop: 'auto' }}>
          <button
            className="quick-demo-btn"
            onClick={onQuickDemo}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
              marginBottom: 6,
            }}
          >
            ⚡ 快速搭建示例
          </button>
          <button
            className="quick-demo-btn"
            onClick={onJoinDemo}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
            }}
          >
            🔗 多表关联示例
          </button>
        </div>
      </div>

      {/* 画布区域 */}
      <div className="pipeline-main">
        {/* 工具栏 */}
        <div className="pipeline-toolbar">
          <button
            className="run-btn"
            onClick={onRun}
            disabled={isRunning || nodes.length === 0}
          >
            {isRunning ? '⏳ 执行中...' : '▶ 运行流水线'}
          </button>
          <button className="toolbar-btn" onClick={onClear} disabled={nodes.length === 0}>
            🗑 清空
          </button>
          <button className="toolbar-btn tpl-toolbar-btn" onClick={() => setShowTemplateMgr(true)}>
            📂 模板
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
            {nodes.length} 节点 · {edges.length} 连接
          </span>
        </div>

        {/* React Flow 画布 */}
        <div ref={wrapperRef} className="pipeline-canvas-wrapper">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setRfInstance}
            onNodeClick={onNodeClick}
            onPaneClick={() => selectNode(null)}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{
              style: { stroke: '#c0c0d0', strokeWidth: 2 },
              animated: true,
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d0d0e0" />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const status = (n.data as any)?.status
                if (status === 'success') return '#00b894'
                if (status === 'running') return '#6d5cff'
                if (status === 'error') return '#ff6b6b'
                return '#e0e0e6'
              }}
              style={{ borderRadius: 8 }}
            />
          </ReactFlow>
        </div>

        {/* 预览面板 */}
        {previewData && (
          <div className="pipeline-preview">
            <div className="preview-header">
              <span>📊 {previewData.nodeLabel || '数据预览'}</span>
              <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
                {previewData.rowCount != null
                  ? `共 ${previewData.rowCount} 行 · ${previewData.fields.length} 字段`
                  : `${previewData.fields.length} 字段`}
              </span>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exporting}
                title="导出该节点完整数据为 Excel"
                style={{
                  marginLeft: 'auto',
                  border: '1px solid #2f9e44',
                  background: '#2f9e44',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '0 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  lineHeight: '20px',
                  opacity: exporting ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                {exporting ? '⏳ 导出中...' : '⬇ 导出 Excel'}
              </button>
              <button
                type="button"
                onClick={onClosePreview}
                title="关闭预览"
                style={{
                  marginLeft: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-muted)',
                  borderRadius: 6,
                  padding: '0 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  lineHeight: '20px',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
            {exportMsg && (
              <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text)', background: 'var(--surface-muted)', borderBottom: '1px solid var(--border)' }}>
                {exportMsg}
              </div>
            )}
            {previewData.rows.length === 0 ? (
              <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                该节点暂无输出数据，请先点击「▶ 运行流水线」执行后再查看结果。
              </div>
            ) : (
              <div style={{ overflow: 'auto', maxHeight: 180 }}>
                <table className="preview-table">
                  <thead>
                    <tr>
                      {previewData.fields.map((f: any) => (
                        <th key={f.name}>{f.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.slice(0, 100).map((row, i) => (
                      <tr key={i}>
                        {previewData.fields.map((f: any) => (
                          <td key={f.name}>
                            {row[f.name] != null ? String(row[f.name]).substring(0, 30) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 右侧节点配置面板 */}
      <NodeConfigPanel />

      {/* 模板管理弹窗 */}
      {showTemplateMgr && (
        <TemplateManager
          nodes={nodes}
          edges={edges}
          onLoad={onLoadTemplate}
          onClose={() => setShowTemplateMgr(false)}
        />
      )}
    </div>
  )
}

export function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <NodeConfigProvider>
        <PipelineCanvasInner />
      </NodeConfigProvider>
    </ReactFlowProvider>
  )
}
