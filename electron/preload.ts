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

  // 读取本地文件内容为 base64（供前端解析行数据）
  readFileBase64: (filePath: string) => ipcRenderer.invoke('file:readBase64', filePath),

  // 获取本地文件大小（供前端判断是否需要全量解析）
  statFile: (filePath: string) => ipcRenderer.invoke('file:stat', filePath),

  // 直接加载行数组到 DuckDB（用于内置示例数据集）
  loadRows: (rows: Record<string, any>[], name: string) =>
    ipcRenderer.invoke('data:loadRows', rows, name),

  // 执行 SQL 查询
  query: (sql: string) => ipcRenderer.invoke('data:query', sql),

  // 获取表结构
  getSchema: () => ipcRenderer.invoke('data:getSchema'),

  // 获取应用版本信息
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 选择 PPT 模板文件
  openPptTemplate: () => ipcRenderer.invoke('ppt:openTemplate'),

  // 生成 PPT（调用本地 Python 模板填充引擎）
  generatePpt: (request: any) => ipcRenderer.invoke('ppt:generate', request),

  // 查询 PPT 模板填充引擎状态
  pptEngineStatus: () => ipcRenderer.invoke('ppt:engineStatus'),
})
