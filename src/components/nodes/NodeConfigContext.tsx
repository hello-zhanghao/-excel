import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * 节点配置面板上下文
 *
 * 实现思路：每个节点组件在渲染 BaseNode 时，把「配置表单」注册到全局注册表；
 * 点击节点时设置 selectedNodeId；右侧固定面板读取注册表，渲染选中节点的表单。
 *
 * 这样各节点组件的 children（配置表单）可以原样保留在节点组件树中创建，
 * 通过 renderForm 函数延迟渲染到右侧面板，React hooks 依然正常工作。
 */

/** 注册的节点信息 */
export interface RegisteredNodeInfo {
  /** 节点图标（emoji） */
  icon: string
  /** 节点标题 */
  title: string
  /** 主题色 */
  color: string
  /** 渲染配置表单（返回节点组件创建的 children JSX） */
  renderForm: () => ReactNode
}

interface NodeConfigContextValue {
  /** 当前在右侧面板打开的节点 id */
  selectedNodeId: string | null
  /** 打开 / 关闭节点配置面板 */
  selectNode: (id: string | null) => void
  /** 节点组件注册自己的配置表单 */
  registerNode: (id: string, info: RegisteredNodeInfo) => void
  /** 节点卸载时注销 */
  unregisterNode: (id: string) => void
  /** 读取某个节点的注册信息 */
  getRegistered: (id: string | null) => RegisteredNodeInfo | undefined
  /** 注册表版本号（注册/注销时自增，用于触发面板重渲染） */
  version: number
}

const NodeConfigContext = createContext<NodeConfigContextValue | null>(null)

export function NodeConfigProvider({ children }: { children: ReactNode }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const registryRef = useRef(new Map<string, RegisteredNodeInfo>())

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id)
  }, [])

  const registerNode = useCallback((id: string, info: RegisteredNodeInfo) => {
    registryRef.current.set(id, info)
    setVersion((v) => v + 1)
  }, [])

  const unregisterNode = useCallback((id: string) => {
    if (registryRef.current.delete(id)) {
      setVersion((v) => v + 1)
    }
  }, [])

  const getRegistered = useCallback((id: string | null) => {
    if (!id) return undefined
    return registryRef.current.get(id)
  }, [])

  const value = useMemo(
    () => ({
      selectedNodeId,
      selectNode,
      registerNode,
      unregisterNode,
      getRegistered,
      version,
    }),
    [selectedNodeId, selectNode, registerNode, unregisterNode, getRegistered, version],
  )

  return (
    <NodeConfigContext.Provider value={value}>{children}</NodeConfigContext.Provider>
  )
}

export function useNodeConfig(): NodeConfigContextValue {
  const ctx = useContext(NodeConfigContext)
  if (!ctx) {
    throw new Error('useNodeConfig 必须在 NodeConfigProvider 内使用')
  }
  return ctx
}
