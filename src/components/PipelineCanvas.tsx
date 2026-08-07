import { useCallback, useEffect, useRef, useState } from 'react'
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
 *
 * 多输入时（result.sheets 存在）每个 sheet 对应一路上游数据，
 * 全部写入同一个工作簿。
 */
function exportNodeToExcel(
  node: Node,
  result: NodeOutput,
  defaults?: { label?: string },
): string | null {
  if (!result) return null

  const nodeConfig = (node.data?.config as any) ?? {}
  const customName = (nodeConfig.filename as string) || ''
  const addTimestamp = (nodeConfig.addTimestamp as boolean) ?? true
  const base = (
    customName ||
    defaults?.label ||
    (node.data?.label as string) ||
    'export'
  ).slice(0, 25) || 'export'
  const ts = addTimestamp ? `_${formatTimestamp()}` : ''
  const baseName = `${base}${ts}`

  // 收集所有待导出的 sheet（多输入时每路一个，单输入时一个）
  const sheets: { name: string; rows: Record<string, any>[]; fields: any[] }[] =
    result.sheets && result.sheets.length > 0
      ? result.sheets
      : [{ name: baseName, rows: result.rows, fields: result.fields }]

  const wb = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  let exportedCount = 0

  for (const sheet of sheets) {
    if (!sheet.rows || sheet.rows.length === 0) continue

    // 列：优先用字段元信息，其次从第一行推断
    const columns: string[] =
      sheet.fields && sheet.fields.length > 0
        ? sheet.fields.map((f) => f.name)
        : Object.keys(sheet.rows[0] ?? {})
    if (columns.length === 0) continue

    const aoa: any[][] = [columns]
    for (const row of sheet.rows) {
      aoa.push(columns.map((col) => row[col] ?? ''))
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = columns.map((col) => ({ wch: Math.max(col.length * 2, 12) }))

    // sheet 名去重 + 过滤 Excel 非法字符（上限 31 字符）
    let sheetName = sanitizeSheetName(sheet.name || baseName)
    if (usedNames.has(sheetName)) {
      let i = 2
      while (usedNames.has(`${sheetName}_${i}`)) i++
      sheetName = `${sheetName}_${i}`
    }
    usedNames.add(sheetName)

    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    exportedCount++
  }

  if (exportedCount === 0) return null

  const filename = `${baseName}.xlsx`
  XLSX.writeFile(wb, filename)
  return filename
}

/** 过滤 Excel sheet 名中的非法字符并截断到 31 字符 */
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, '_').slice(0, 31)
  return cleaned || 'Sheet'
}

/** 生成可读时间戳，如 20260807_152030 */
function formatTimestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

let nodeIdCounter = 0
function getNodeId(): string {
  nodeIdCounter++
  return `node_${Date.now()}_${nodeIdCounter}`
}

function PipelineCanvasInner() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  // 节点/边状态提升到全局 store，切换模式（可视化↔数据流）时画布不丢失
  const pipelineNodes = useStore((s) => s.pipelineNodes)
  const pipelineEdges = useStore((s) => s.pipelineEdges)
  const setPipelineNodes = useStore((s) => s.setPipelineNodes)
  const setPipelineEdges = useStore((s) => s.setPipelineEdges)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(pipelineNodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(pipelineEdges || [])
  // 节点/边变化时同步回 store，保证切换模式后画布状态保留
  useEffect(() => {
    setPipelineNodes(nodes)
  }, [nodes, setPipelineNodes])
  useEffect(() => {
    setPipelineEdges(edges)
  }, [edges, setPipelineEdges])
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

  // ---- 面板布局：可拖拽调整大小 + 可折叠展开 ----
  const [paletteWidth, setPaletteWidth] = useState(170)
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)
  const [previewHeight, setPreviewHeight] = useState(170)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [configWidth, setConfigWidth] = useState(320)
  const [configCollapsed, setConfigCollapsed] = useState(false)

  type ResizeMode = 'palette' | 'preview' | 'config'
  const resizeRef = useRef<{
    mode: ResizeMode
    startX: number
    startY: number
    startW: number
    startH: number
  } | null>(null)
  const [resizing, setResizing] = useState(false)

  const onResizeMove = useCallback((e: MouseEvent) => {
    const r = resizeRef.current
    if (!r) return
    if (r.mode === 'palette') {
      // 向右拉变宽
      setPaletteWidth(Math.min(Math.max(r.startW + (e.clientX - r.startX), 140), 420))
    } else if (r.mode === 'config') {
      // 向左拉变宽（分隔条位于面板左侧，因此反向）
      setConfigWidth(Math.min(Math.max(r.startW - (e.clientX - r.startX), 260), 560))
    } else if (r.mode === 'preview') {
      // 向上拉变高（分隔条位于预览面板顶部，因此反向）
      setPreviewHeight(Math.min(Math.max(r.startH - (e.clientY - r.startY), 60), 420))
    }
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
    (e: React.MouseEvent, mode: ResizeMode) => {
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startW: mode === 'palette' ? paletteWidth : mode === 'config' ? configWidth : 0,
        startH: mode === 'preview' ? previewHeight : 0,
      }
      setResizing(true)
      document.body.style.cursor = mode === 'preview' ? 'row-resize' : 'col-resize'
      document.body.style.userSelect = 'none'
      window.addEventListener('mousemove', onResizeMove)
      window.addEventListener('mouseup', onResizeEnd)
    },
    [onResizeMove, onResizeEnd, paletteWidth, configWidth, previewHeight],
  )

  // 组件卸载时清理拖拽监听
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onResizeEnd)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [onResizeMove, onResizeEnd])

  const { setPipelineData } = useStore() as any

  /** 从组件面板拖拽开始 */
  const onDragStart = (event: React.DragEvent, nodeType: PipelineNodeType) => {
    event.dataTransfer.setData('application/pipeline-node', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  /** 组件面板点击添加节点时的级联偏移计数（避免新节点全部堆叠在画布中心） */
  const palettePlaceRef = useRef(0)

  /** 生成一个彼此错开的放置位置：从画布中心向右下级联，超过一列后换行 */
  const getCascadePosition = useCallback(
    (): { x: number; y: number } => {
      const center = rfInstance!.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      const step = 48
      const i = palettePlaceRef.current++
      // 每行最多放 5 个，超过则换到下一行，避免无限向右/向下偏移
      return {
        x: center.x + (i % 5) * step * 2,
        y: center.y + Math.floor(i / 5) * step * 2,
      }
    },
    [rfInstance],
  )

  /** 创建一个新节点并添加到画布 */
  const createNode = useCallback(
    (type: PipelineNodeType, position?: { x: number; y: number }) => {
      if (!rfInstance) return

      // 拖放到画布时使用拖放位置；点击组件面板时使用级联错开的位置
      const pos = position ?? getCascadePosition()

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
    [rfInstance, setNodes, getCascadePosition],
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
                  sheets: result.sheets?.map((s) => ({
                    name: s.name,
                    rowCount: s.rows.length,
                  })),
                },
              },
            }
          }
          return { ...n, data: { ...n.data, status: 'error' as const } }
        }),
      )

      // 找到所有 output 节点的结果，全部传给可视化（每个输出独立成一个数据源）
      const outputNodes = nodes.filter((n) => n.type === 'output')
      const outputs: { id?: string; name?: string; rows: Record<string, any>[]; fields: any[] }[] = []
      if (outputNodes.length > 0) {
        for (const on of outputNodes) {
          const out = results.get(on.id)
          if (out) {
            outputs.push({
              id: on.id,
              name: ((on.data as any)?.config?.name as string) || ((on.data.label as string) || '输出'),
              rows: out.rows,
              fields: out.fields,
            })
          }
        }
        // 预览显示第一个输出
        const firstNode = outputNodes[0]
        const firstOut = results.get(firstNode.id)
        if (firstOut) {
          setPreviewData({
            rows: firstOut.rows.slice(0, 50),
            fields: firstOut.fields,
            nodeId: firstNode.id,
            nodeLabel: ((firstNode.data as any)?.config?.name as string) || ((firstNode.data.label as string) || '输出'),
            rowCount: firstOut.rows.length,
          })
          setSelectedOutputNodeId(firstNode.id)
        }
      } else {
        // 没有 output 节点，取最后一个节点的结果
        const lastNode = nodes[nodes.length - 1]
        const output = results.get(lastNode.id)
        if (output) {
          outputs.push({
            name: (lastNode.data.label as string) || '末节点',
            rows: output.rows,
            fields: output.fields,
          })
          setPreviewData({
            rows: output.rows.slice(0, 50),
            fields: output.fields,
            nodeId: lastNode.id,
            nodeLabel: (lastNode.data.label as string) || '末节点',
            rowCount: output.rows.length,
          })
        }
      }
      if (outputs.length > 0) {
        setPipelineData?.(outputs)
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
      const label = (data.label as string) || NODE_LABELS[node.type as PipelineNodeType] || '节点'
      if (data.preview) {
        const preview = data.preview as {
          rows?: Record<string, any>[]
          fields?: any[]
          rowCount?: number
        }
        setPreviewData({
          rows: preview.rows ?? [],
          fields: preview.fields ?? [],
          nodeId: node.id,
          nodeLabel: label,
          rowCount: preview.rowCount ?? 0,
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
      {/* 组件面板（可折叠、可拖拽调整宽度） */}
      <div
        className="pipeline-palette"
        style={{ width: paletteCollapsed ? 36 : paletteWidth }}
      >
        {paletteCollapsed ? (
          <div
            className="panel-collapsed-v"
            onClick={() => setPaletteCollapsed(false)}
            title="展开组件面板"
          >
            <span className="panel-collapse-mark">组件</span>
            <button className="panel-collapse-btn" type="button">
              »
            </button>
          </div>
        ) : (
          <>
            <div
              className="palette-title"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              组件
              <button
                type="button"
                className="panel-collapse-btn"
                onClick={() => setPaletteCollapsed(true)}
                title="收起面板"
              >
                «
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-light)', padding: '0 14px 8px' }}>
              点击或拖拽到画布
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
                <span className="palette-dot" />
                <span className="palette-label">{item.label}</span>
              </div>
            ))}

            {/* 快速示例按钮 */}
            <div style={{ padding: '8px 14px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                className="quick-demo-btn"
                onClick={onQuickDemo}
                title="快速搭建示例流水线"
              >
                快速搭建示例
              </button>
              <button
                className="quick-demo-btn"
                onClick={onJoinDemo}
                title="多表关联示例"
              >
                多表关联示例
              </button>
            </div>
          </>
        )}
      </div>

      {/* 左侧面板分隔条（拖拽调整宽度） */}
      {!paletteCollapsed && (
        <div
          className={`panel-divider panel-divider-v${resizing ? ' active' : ''}`}
          onMouseDown={(e) => onResizeStart(e, 'palette')}
          title="拖拽调整组件面板宽度"
        />
      )}

      {/* 画布区域 */}
      <div className="pipeline-main">
        {/* 工具栏 */}
        <div className="pipeline-toolbar">
          <button
            className="run-btn"
            onClick={onRun}
            disabled={isRunning || nodes.length === 0}
          >
            {isRunning ? '执行中…' : '运行'}
          </button>
          <button className="toolbar-btn" onClick={onClear} disabled={nodes.length === 0}>
            清空
          </button>
          <button className="toolbar-btn tpl-toolbar-btn" onClick={() => setShowTemplateMgr(true)}>
            模板
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

        {/* 预览面板分隔条（拖拽调整高度） */}
        {previewData && (
          <div
            className={`panel-divider panel-divider-h${resizing ? ' active' : ''}`}
            onMouseDown={(e) => onResizeStart(e, 'preview')}
            title="拖拽调整预览高度"
          />
        )}

        {/* 预览面板（可折叠、可拖拽调整高度） */}
        {previewData && (
          <div
            className="pipeline-preview"
            style={{ height: previewCollapsed ? 30 : previewHeight }}
          >
            <div className="preview-header">
              <span>{previewData.nodeLabel || '数据预览'}</span>
              {!previewCollapsed && (
                <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
                  {previewData.rowCount != null
                    ? `共 ${previewData.rowCount} 行 · ${previewData.fields.length} 字段`
                    : `${previewData.fields.length} 字段`}
                </span>
              )}
              {!previewCollapsed && (
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
                  {exporting ? '导出中…' : '导出 Excel'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreviewCollapsed((c) => !c)}
                title={previewCollapsed ? '展开预览' : '收起预览'}
                style={{
                  marginLeft: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-muted)',
                  borderRadius: 6,
                  padding: '0 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                  lineHeight: '20px',
                  flexShrink: 0,
                }}
              >
                {previewCollapsed ? '▲ 展开' : '▼ 收起'}
              </button>
              {!previewCollapsed && (
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
              )}
            </div>
            {!previewCollapsed && exportMsg && (
              <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--text)', background: 'var(--surface-muted)', borderBottom: '1px solid var(--border)' }}>
                {exportMsg}
              </div>
            )}
            {!previewCollapsed &&
              (previewData.rows.length === 0 ? (
                <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  该节点暂无输出数据，请先点击「▶ 运行流水线」执行后再查看结果。
                </div>
              ) : (
                <div style={{ overflow: 'auto', maxHeight: previewHeight - 38, minHeight: 30 }}>
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
              ))}
          </div>
        )}
      </div>

      {/* 右侧节点配置面板（可折叠、可拖拽调整宽度） */}
      <NodeConfigPanel
        width={configWidth}
        collapsed={configCollapsed}
        onToggleCollapsed={() => setConfigCollapsed((c) => !c)}
        onResizeStart={(e) => onResizeStart(e, 'config')}
        resizing={resizing}
      />

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
