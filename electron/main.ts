import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { DataService } from './dataService'
import {
  generatePpt,
  resolveFillerDir,
  type PptGenerateRequest,
} from './pptService'

let mainWindow: BrowserWindow | null = null
const dataService = new DataService()

// 开发模式下 Vite dev server 的热更新与源码映射依赖 unsafe-eval，
// 必然触发 Electron 的「Insecure Content-Security-Policy」安全警告。
// 该警告仅存在于开发环境（打包后不会出现），生产包已开启 contextIsolation
// 并关闭 nodeIntegration，故这里仅在开发模式关闭警告，避免控制台噪音。
if (!app.isPackaged) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'Excel BI Builder',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 开发模式加载 dev server，生产模式加载构建产物。
  // 支持通过 ELECTRON_DEV_URL 环境变量指定开发服务器地址（便于调试/多端口）。
  const isDev = !app.isPackaged || !!process.env.ELECTRON_DEV_URL
  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_DEV_URL || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC: 打开文件对话框
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择 Excel / CSV 文件',
    filters: [
      { name: '数据文件', extensions: ['xlsx', 'xls', 'csv'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }
  return { success: true, filePath: result.filePaths[0] }
})

// IPC: 加载文件到 DuckDB
ipcMain.handle('data:loadFile', async (_event, filePath: string) => {
  try {
    const { tableName, fields } = await dataService.loadFile(filePath)
    return { success: true, tableName, fields }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// IPC: 读取本地文件内容为 base64（供前端解析行数据）
ipcMain.handle('file:readBase64', async (_event, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath)
    return { success: true, base64: buffer.toString('base64') }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// IPC: 直接加载行数组到 DuckDB（用于内置示例数据集）
ipcMain.handle('data:loadRows', async (_event, rows: Record<string, any>[], name: string) => {
  try {
    const { tableName, fields } = await dataService.loadRows(rows, name)
    return { success: true, tableName, fields }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// IPC: 执行 SQL 查询
ipcMain.handle('data:query', async (_event, sql: string) => {
  try {
    const start = Date.now()
    const { columns, rows } = await dataService.query(sql)
    const elapsed = Date.now() - start
    return { success: true, columns, rows, elapsed }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// IPC: 获取表结构
ipcMain.handle('data:getSchema', async () => {
  try {
    const fields = await dataService.getSchema()
    return { success: true, fields }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// IPC: 获取应用版本信息
ipcMain.handle('app:getVersion', () => {
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
  }
})

// IPC: 选择 PPT 模板文件
ipcMain.handle('ppt:openTemplate', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择 PPT 模板文件',
    filters: [
      { name: 'PPT 模板', extensions: ['pptx'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true }
  }
  return {
    success: true,
    filePath: result.filePaths[0],
    fileName: path.basename(result.filePaths[0]),
  }
})

// IPC: 生成 PPT（调用本地 Python 模板填充引擎）
ipcMain.handle('ppt:generate', async (_event, request: PptGenerateRequest) => {
  return await generatePpt(request)
})

// IPC: 查询 PPT 模板填充引擎状态
ipcMain.handle('ppt:engineStatus', () => {
  const dir = resolveFillerDir()
  return {
    available: !!dir,
    dir,
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
