import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import { DataService } from './dataService'

let mainWindow: BrowserWindow | null = null
const dataService = new DataService()

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

  // 开发模式加载 dev server，生产模式加载构建产物
  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
