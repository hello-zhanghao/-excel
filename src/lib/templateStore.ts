/**
 * 流水线模板存储模块
 *
 * 提供以下能力：
 * 1. 保存当前画布为模板（存入 localStorage）
 * 2. 加载已有模板到画布
 * 3. 删除模板
 * 4. 导出模板为 JSON 文件（分享给他人）
 * 5. 从 JSON 文件导入模板
 *
 * 模板数据结构 = 序列化后的 React Flow 节点 + 边 + 元信息
 */

import type { Edge, Node } from '@xyflow/react'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

/**
 * 模板元信息 + 流水线数据
 */
export interface PipelineTemplate {
  /** 唯一 ID */
  id: string
  /** 模板名称 */
  name: string
  /** 模板描述 */
  description: string
  /** 创建时间 ISO 字符串 */
  createdAt: string
  /** 更新时间 ISO 字符串 */
  updatedAt: string
  /** 节点列表（已剥离运行时状态） */
  nodes: SerializableNode[]
  /** 边列表 */
  edges: SerializableEdge[]
  /** 模板版本号，用于未来兼容性迁移 */
  version: number
}

/**
 * 可序列化的节点数据（去除运行时状态如 status / preview）
 */
export interface SerializableNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label?: string
    config: Record<string, any>
  }
}

/**
 * 可序列化的边数据
 */
export interface SerializableEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  animated?: boolean
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'pipeline_templates'
const TEMPLATE_VERSION = 1

// ---------------------------------------------------------------------------
// 序列化 / 反序列化
// ---------------------------------------------------------------------------

/**
 * 将 React Flow 节点列表序列化为可存储的格式。
 *
 * 剥离运行时状态（status / preview），只保留结构 + 配置。
 */
function serializeNodes(nodes: Node[]): SerializableNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type ?? 'output',
    position: { x: n.position.x, y: n.position.y },
    data: {
      label: (n.data as any)?.label,
      config: (n.data as any)?.config ?? {},
    },
  }))
}

/**
 * 将 React Flow 边列表序列化为可存储的格式。
 */
function serializeEdges(edges: Edge[]): SerializableEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    animated: e.animated ?? false,
  }))
}

/**
 * 将序列化的节点恢复为 React Flow 节点格式。
 * 重新生成 id 避免与画布上已有节点冲突。
 */
function deserializeNodes(
  nodes: SerializableNode[],
  idMap: Map<string, string>,
): Node[] {
  return nodes.map((n) => {
    const newId = getNewId()
    idMap.set(n.id, newId)
    return {
      id: newId,
      type: n.type,
      position: n.position,
      data: {
        label: n.data.label,
        config: n.data.config,
      },
    }
  })
}

/**
 * 将序列化的边恢复为 React Flow 边格式。
 * 使用 idMap 重映射 source/target 到新 id。
 */
function deserializeEdges(
  edges: SerializableEdge[],
  idMap: Map<string, string>,
): Edge[] {
  return edges
    .map((e) => {
      const source = idMap.get(e.source)
      const target = idMap.get(e.target)
      if (!source || !target) return null
      return {
        id: `e-${source}-${target}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source,
        target,
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        animated: e.animated ?? true,
      }
    })
    .filter((e): e is Edge => e !== null)
}

// ---------------------------------------------------------------------------
// ID 生成
// ---------------------------------------------------------------------------

let idCounter = 0
function getNewId(): string {
  idCounter++
  return `node_${Date.now()}_${idCounter}`
}

function generateTemplateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// localStorage 读写
// ---------------------------------------------------------------------------

function readFromStorage(): PipelineTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeToStorage(templates: PipelineTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch (err) {
    console.error('Failed to save templates to localStorage:', err)
  }
}

// ---------------------------------------------------------------------------
// 公共 API
// ---------------------------------------------------------------------------

/**
 * 获取所有已保存的模板
 */
export function listTemplates(): PipelineTemplate[] {
  return readFromStorage().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

/**
 * 将当前画布保存为模板
 *
 * @param name        模板名称
 * @param description 模板描述
 * @param nodes       当前画布节点
 * @param edges       当前画布边
 * @returns 新创建的模板
 */
export function saveTemplate(
  name: string,
  description: string,
  nodes: Node[],
  edges: Edge[],
): PipelineTemplate {
  const templates = readFromStorage()
  const now = new Date().toISOString()

  const template: PipelineTemplate = {
    id: generateTemplateId(),
    name: name.trim() || '未命名模板',
    description: description.trim(),
    createdAt: now,
    updatedAt: now,
    nodes: serializeNodes(nodes),
    edges: serializeEdges(edges),
    version: TEMPLATE_VERSION,
  }

  templates.push(template)
  writeToStorage(templates)
  return template
}

/**
 * 更新已有模板
 */
export function updateTemplate(
  id: string,
  patch: Partial<Pick<PipelineTemplate, 'name' | 'description'>> & {
    nodes?: Node[]
    edges?: Edge[]
  },
): PipelineTemplate | null {
  const templates = readFromStorage()
  const idx = templates.findIndex((t) => t.id === id)
  if (idx === -1) return null

  const existing = templates[idx]
  const updated: PipelineTemplate = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    updatedAt: new Date().toISOString(),
    nodes: patch.nodes ? serializeNodes(patch.nodes) : existing.nodes,
    edges: patch.edges ? serializeEdges(patch.edges) : existing.edges,
  }

  templates[idx] = updated
  writeToStorage(templates)
  return updated
}

/**
 * 删除模板
 */
export function deleteTemplate(id: string): boolean {
  const templates = readFromStorage()
  const filtered = templates.filter((t) => t.id !== id)
  if (filtered.length === templates.length) return false
  writeToStorage(filtered)
  return true
}

/**
 * 加载模板到画布格式。
 *
 * 重新生成节点/边 ID 避免冲突。
 *
 * @returns { nodes, edges } 可直接 setNodes / setEdges 的数据
 */
export function loadTemplate(
  template: PipelineTemplate,
): { nodes: Node[]; edges: Edge[] } {
  const idMap = new Map<string, string>()
  const nodes = deserializeNodes(template.nodes, idMap)
  const edges = deserializeEdges(template.edges, idMap)
  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// 文件导出 / 导入（JSON）
// ---------------------------------------------------------------------------

/**
 * 将模板导出为 JSON 文件，触发浏览器下载。
 *
 * 导出的 JSON 可直接分享给他人，对方通过 importTemplateFromFile 导入。
 */
export function exportTemplateToFile(template: PipelineTemplate): void {
  const json = JSON.stringify(template, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${template.name.replace(/[^\w\u4e00-\u9fa5-]/g, '_')}.pipeline.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 从 JSON 文件导入模板。
 *
 * @param file 用户选择的 .json 文件
 * @returns 导入的模板（已存入 localStorage）
 */
export function importTemplateFromFile(file: File): Promise<PipelineTemplate> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)

        // 基本校验
        if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
          throw new Error('无效的模板文件：缺少 nodes 字段')
        }
        if (!parsed.edges || !Array.isArray(parsed.edges)) {
          throw new Error('无效的模板文件：缺少 edges 字段')
        }

        // 构建完整的模板对象
        const now = new Date().toISOString()
        const template: PipelineTemplate = {
          id: generateTemplateId(),
          name: parsed.name || '导入的模板',
          description: parsed.description || '',
          createdAt: parsed.createdAt || now,
          updatedAt: now,
          nodes: parsed.nodes,
          edges: parsed.edges,
          version: parsed.version || TEMPLATE_VERSION,
        }

        // 存入 localStorage
        const templates = readFromStorage()
        templates.push(template)
        writeToStorage(templates)

        resolve(template)
      } catch (err) {
        reject(new Error(`模板解析失败: ${(err as Error).message}`))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}
