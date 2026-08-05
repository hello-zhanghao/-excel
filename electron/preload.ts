import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload 脚本 —— 安全地暴露 IPC 接口给渲染进程
 * 通过 contextBridge 隔离，渲染进程不直接访问 Node API
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // 打开原生文件选择对话框
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  // 加载数据文件到 DuckDB
  loadFile: (filePath: string) => ipcRenderer.invoke('data:loadFile', filePath),

  // 直接加载行数组到 DuckDB（用于内置示例数据集）
  loadRows: (rows: Record<string, any>[], name: string) =>
    ipcRenderer.invoke('data:loadRows', rows, name),

  // 执行 SQL 查询
  query: (sql: string) => ipcRenderer.invoke('data:query', sql),

  // 获取表结构
  getSchema: () => ipcRenderer.invoke('data:getSchema'),

  // 获取应用版本信息
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})
