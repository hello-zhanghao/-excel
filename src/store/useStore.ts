import { create } from 'zustand'
import type { FieldMeta, EncodingConfig, EncodingItem, QueryResult, ChartType, RuntimeEnv, DashboardChart, CatalogTable } from '@/types'
import { FieldKind } from '@/types'
import { getDataSource, getEnv } from '@/lib/dataSourceFactory'
import { generateSQL, inferChartType, generateG2Spec } from '@/lib/encodingEngine'
import { SAMPLE_DATASETS, inferFieldsFromRows } from '@/data/sampleDatasets'
import * as XLSX from 'xlsx'

interface SelectedField {
  name: string
  kind: FieldKind
}

/** 已上传文件的数据（供数据流模式的数据源节点复用） */
export interface UploadedFile {
  fileName: string
  rows: Record<string, any>[]
}

/** 将文件解析为行数组（与 WebDataSource / DataSourceNode 一致的解析行为） */
export function parseFileToRows(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        if (!sheet) {
          reject(new Error('文件中没有可读取的工作表'))
          return
        }
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, any>[])
      } catch (err: any) {
        reject(new Error('文件解析失败: ' + err.message))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

interface AppState {
  // 环境
  env: RuntimeEnv

  // 模式：可视化模式 | 流水线模式
  appMode: 'visualize' | 'pipeline'
  pipelineData: { rows: Record<string, any>[]; fields: FieldMeta[] } | null

  // 数据状态
  fields: FieldMeta[]
  tableName: string
  loaded: boolean
  loading: boolean
  error: string | null
  /** 最近上传的本地文件（含解析后的行数据），供数据流模式的数据源节点复用 */
  uploadedFile: UploadedFile | null

  // 编码配置
  encoding: EncodingConfig
  chartType: ChartType

  // 查询结果
  queryResult: QueryResult | null
  queryElapsed: number | null
  g2Spec: Record<string, any> | null

  // 仪表盘：多图表卡片
  dashboardCharts: DashboardChart[]
  /** 仪表盘数据源目录 —— 所有可用的数据源（示例/上传/流水线输出） */
  catalog: CatalogTable[]

  // 移动端 UI 状态
  sidebarOpen: boolean
  selectedField: SelectedField | null
  sqlPreviewOpen: boolean

  // 操作
  loadFileWeb: (file: File) => Promise<void>
  loadFileElectron: () => Promise<void>
  loadSampleData: (datasetId: string) => Promise<void>
  setSlot: (slot: keyof EncodingConfig, item: EncodingItem | null) => void
  setChartType: (type: ChartType) => void
  runQuery: () => Promise<void>
  clearEncoding: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  selectField: (field: SelectedField | null) => void
  toggleSqlPreview: () => void
  setAppMode: (mode: 'visualize' | 'pipeline') => void
  setPipelineData: (data: { rows: Record<string, any>[]; fields: FieldMeta[] }) => void
  addDashboardChart: () => void
  updateDashboardChart: (id: string, patch: Partial<DashboardChart>) => void
  removeDashboardChart: (id: string) => void
  /** 注册一个数据源到仪表盘目录 */
  registerCatalog: (key: string, name: string, rows: Record<string, any>[], fields: FieldMeta[]) => void
}

const defaultEncoding: EncodingConfig = {}

export const useStore = create<AppState>((set, get) => ({
  env: getEnv(),
  appMode: 'pipeline',
  pipelineData: null,
  fields: [],
  tableName: '',
  loaded: false,
  loading: false,
  error: null,
  uploadedFile: null,
  encoding: defaultEncoding,
  chartType: 'auto',
  queryResult: null,
  queryElapsed: null,
  g2Spec: null,
  dashboardCharts: [],
  catalog: SAMPLE_DATASETS.map((d) => ({
    key: `sample_${d.id}`,
    name: d.name,
    rows: d.rows,
    fields: inferFieldsFromRows(d.rows),
  })),
  sidebarOpen: false,
  selectedField: null,
  sqlPreviewOpen: false,

  loadFileWeb: async (file: File) => {
    set({ loading: true, error: null })
    try {
      const ds = getDataSource()
      await ds.loadFile(file)
      const fields = await ds.getSchema()
      // 保存文件数据，供数据流模式的数据源节点复用
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
      // 注册到仪表盘数据源目录
      if (uploadedFile) {
        get().registerCatalog(ds.getTableName(), file.name, uploadedFile.rows, fields)
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
      let uploadedFile: UploadedFile | null = null
      try {
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
      // 注册到仪表盘数据源目录
      get().registerCatalog(ds.getTableName(), dataset.name, dataset.rows, fields)
    } catch (err: any) {
      set({ loading: false, error: err.message })
    }
  },

  setSlot: (slot, item) => {
    const encoding = { ...get().encoding }
    if (item === null) {
      delete encoding[slot]
    } else {
      encoding[slot] = item as any
    }
    set({ encoding })

    // 自动推断图表类型
    const { fields } = get()
    const inferred = inferChartType(encoding, fields)
    set({ chartType: inferred })

    // 自动执行查询
    get().runQuery()
  },

  setChartType: (type) => {
    set({ chartType: type })
    // 重新生成 G2 spec
    const { encoding, fields } = get()
    const spec = generateG2Spec(encoding, type, fields)
    set({ g2Spec: spec })
  },

  runQuery: async () => {
    const { encoding, fields, tableName, chartType } = get()
    if (!tableName) return

    try {
      const ds = getDataSource()
      const sql = generateSQL(encoding, tableName, fields)
      const result = await ds.query(sql)
      const effectiveChartType = chartType === 'auto' ? inferChartType(encoding, fields) : chartType
      const spec = generateG2Spec(encoding, effectiveChartType, fields)
      set({
        queryResult: result,
        queryElapsed: result.elapsed ?? null,
        g2Spec: spec,
      })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  clearEncoding: () => {
    set({ encoding: {}, queryResult: null, g2Spec: null, chartType: 'auto' })
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  selectField: (field: SelectedField | null) => set({ selectedField: field }),
  toggleSqlPreview: () => set((s) => ({ sqlPreviewOpen: !s.sqlPreviewOpen })),
  setAppMode: (mode) => set({ appMode: mode }),
  setPipelineData: (data) => {
    // 将流水线输出注入数据源，供可视化模式使用
    const ds = getDataSource()
    ds.loadRows(data.rows, 'pipeline_output').then(() => {
      const fields = data.fields.length > 0 ? data.fields : data.rows.length > 0
        ? Object.keys(data.rows[0]).map((name) => ({
            name,
            dataType: typeof data.rows[0][name] === 'number' ? 'number' as const : 'string' as const,
            kind: typeof data.rows[0][name] === 'number' ? FieldKind.Measure : FieldKind.Dimension,
            sample: [],
          }))
        : []
      set({
        pipelineData: data,
        fields,
        tableName: 'pipeline_output',
        loaded: true,
        encoding: {},
        queryResult: null,
        g2Spec: null,
      })
      // 注册到仪表盘数据源目录
      get().registerCatalog('pipeline_output', '流水线输出', data.rows, fields)
    }).catch((err: any) => {
      set({ error: err.message })
    })
  },

  addDashboardChart: () => {
    const id = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const charts = [...get().dashboardCharts]
    // 默认数据源：优先当前激活的数据源，否则用目录第一个
    const activeKey = get().tableName
    const dataSource = get().catalog.some((c) => c.key === activeKey)
      ? activeKey
      : (get().catalog[0]?.key ?? '')
    charts.push({
      id,
      title: `图表 ${charts.length + 1}`,
      dataSource,
      xFields: [],
      yFields: [],
    })
    set({ dashboardCharts: charts })
  },

  updateDashboardChart: (id, patch) => {
    set({
      dashboardCharts: get().dashboardCharts.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      ),
    })
  },

  removeDashboardChart: (id) => {
    set({
      dashboardCharts: get().dashboardCharts.filter((c) => c.id !== id),
    })
  },

  registerCatalog: (key, name, rows, fields) => {
    const catalog = get().catalog.filter((c) => c.key !== key)
    catalog.push({ key, name, rows, fields })
    set({ catalog })
  },
}))
