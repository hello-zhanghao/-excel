import { create } from 'zustand'
import { getDataSource, DataSource } from '@/lib/dataSource'
import { XLSX } from '@/lib/xlsx'
import { SAMPLE_DATASETS } from '@/data/sampleDatasets'
import type { FieldMeta, RuntimeEnv } from '@/types'
import { FieldKind } from '@/types'

interface CatalogTable {
  key: string
  name: string
  rows: Record<string, any>[]
  fields: FieldMeta[]
}

/** 已上传文件的数据（供数据流模式的数据源节点复用） */
export interface UploadedFile {
  fileName: string
  rows: Record<string, any>[]
}

interface AppState {
  env: RuntimeEnv
  loaded: boolean
  loading: boolean
  error: string | null
  fields: FieldMeta[]
  tableName: string
  encoding: Record<string, string>
  queryResult: any
  g2Spec: any
  uploadedFile: UploadedFile | null
  sidebarOpen: boolean
  selectedField: string
  appMode: 'visualize' | 'pipeline'
  catalog: CatalogTable[]
  registerCatalog: (key: string, name: string, rows: Record<string, any>[], fields: FieldMeta[]) => void
  loadFileWeb: (file: File) => Promise<void>
  loadFileElectron: () => Promise<void>
  loadSampleData: (datasetId: string) => Promise<void>
  loadFile: (source: string | File) => Promise<void>
  getSchema: () => Promise<FieldMeta[]>
  query: (sql: string) => Promise<any>
  getTableName: () => string
  setSelectedField: (field: string) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setAppMode: (mode: 'visualize' | 'pipeline') => void
  setFields: (fields: FieldMeta[]) => void
}

// 初始 catalog：内置示例数据集
const initialCatalog = SAMPLE_DATASETS.map((d) => ({
  key: d.id,
  name: d.name,
  rows: d.rows,
  fields: d.fields,
}))

export const useStore = create<AppState>((set, get) => ({
  env: (window as any).electronAPI ? 'electron' : 'web',
  loaded: false,
  loading: false,
  error: null,
  fields: [],
  tableName: '',
  encoding: {},
  queryResult: null,
  g2Spec: null,
  uploadedFile: null,
  sidebarOpen: false,
  selectedField: '',
  appMode: 'visualize',
  catalog: initialCatalog,

  registerCatalog: (key, name, rows, fields) => {
    const catalog = get().catalog.filter((c) => c.key !== key)
    catalog.push({ key, name, rows, fields })
    set({ catalog })
  },

  loadFileWeb: async (file: File) => {
    set({ loading: true, error: null })
    try {
      const ds = getDataSource()
      await ds.loadFile(file)
      const fields = await ds.getSchema()
      let uploadedFile: UploadedFile | null = null
      try {
        const rows = await parseFileToRows(file)
        uploadedFile = { fileName: file.name, rows }
      } catch {
        // 解析失败不影响主流程加载
      }
      set({
        fields,
        tableName: ds.getTableName(),
        loaded: true,
        loading: false,
        encoding: {},
        queryResult: null,
        g2Spec: null,
        uploadedFile,
      })
      if (uploadedFile) {
        get().registerCatalog(ds.getTableName(), uploadedFile.fileName, uploadedFile.rows, fields)
      }
    } catch (err: any) {
      set({ loading: false, error: err.message })
    }
  },

  loadFileElectron: async () => {
    set({ loading: true, error: null })
    try {
      const api = (window as any).electronAPI
      const fileResult = await api.openFile()
      if (!fileResult.success || fileResult.canceled) {
        set({ loading: false })
        return
      }
      const ds = getDataSource()
      await ds.loadFile(fileResult.filePath)
      const fields = await ds.getSchema()
      // 读取文件内容并保存，供数据流模式的数据源节点复用
      // 注意：大文件用 base64 + SheetJS 全量解析会同步阻塞渲染进程主线程导致 UI 卡死。
      // 因此仅对较小文件做全量解析；超大文件跳过该步骤，避免卡顿（可视化模式不受影响，
      // 它走 DuckDB 查询；数据流模式对超大文件可改用 DuckDB 查询而非全量内存行）。
      let uploadedFile: UploadedFile | null = null
      const MAX_PARSE_BYTES = 20 * 1024 * 1024 // 20 MB 以上不做全量 JS 解析
      try {
        const statResult = await api.statFile?.(fileResult.filePath)
        const fileSize = statResult?.success ? statResult.size : 0
        if (fileSize <= MAX_PARSE_BYTES) {
          const readResult = await api.readFileBase64?.(fileResult.filePath)
          if (readResult?.success && readResult.base64) {
            const workbook = XLSX.read(readResult.base64, { type: 'base64', cellDates: true })
            const sheet = workbook.Sheets[workbook.SheetNames[0]]
            if (sheet) {
              const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, any>[]
              const fileName = String(fileResult.filePath).split(/[\\/]/).pop() ?? 'data'
              uploadedFile = { fileName, rows }
            }
          }
        }
      } catch {
        // 读取失败不影响主流程加载
      }
      set({
        fields,
        tableName: ds.getTableName(),
        loaded: true,
        loading: false,
        encoding: {},
        queryResult: null,
        g2Spec: null,
        uploadedFile,
      })
      // 注册到仪表盘数据源目录
      if (uploadedFile) {
        get().registerCatalog(ds.getTableName(), uploadedFile.fileName, uploadedFile.rows, fields)
      }
    } catch (err: any) {
      set({ loading: false, error: err.message })
    }
  },

  loadSampleData: async (datasetId: string) => {
    const dataset = SAMPLE_DATASETS.find((d) => d.id === datasetId)
    if (!dataset) {
      set({ error: `未找到示例数据集: ${datasetId}` })
      return
    }
    set({ loading: true, error: null })
    try {
      const ds = getDataSource()
      await ds.loadRows(dataset.rows, `sample_${dataset.id}`)
      const fields = await ds.getSchema()
      set({
        fields,
        tableName: ds.getTableName(),
        loaded: true,
        loading: false,
        encoding: {},
        queryResult: null,
        g2Spec: null,
      })
      get().registerCatalog(ds.getTableName(), dataset.name, dataset.rows, fields)
    } catch (err: any) {
      set({ loading: false, error: err.message })
    }
  },

  loadFile: async (source) => {
    if (typeof source === 'string') {
      await get().loadFileElectron()
    }
  },

  getSchema: async () => get().fields,

  query: async (sql) => {
    const ds = getDataSource()
    return ds.query(sql)
  },

  getTableName: () => get().tableName,

  setSelectedField: (field) => set({ selectedField: field }),

  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setAppMode: (mode) => set({ appMode: mode }),

  setFields: (fields) => set({ fields }),
}))field }),\n\n  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),\n\n  setSidebarOpen: (open) => set({ sidebarOpen: open }),\n\n  setAppMode: (mode) => set({ appMode: mode }),\n\n  setFields: (fields) => set({ fields }),\n}))\n"}]