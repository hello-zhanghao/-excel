import { create } from 'zustand'
import type { FieldMeta, EncodingConfig, EncodingItem, QueryResult, ChartType, RuntimeEnv, FieldKind } from '@/types'
import { getDataSource, getEnv } from '@/lib/dataSourceFactory'
import { generateSQL, inferChartType, generateG2Spec } from '@/lib/encodingEngine'
import { SAMPLE_DATASETS } from '@/data/sampleDatasets'

interface SelectedField {
  name: string
  kind: FieldKind
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

  // 编码配置
  encoding: EncodingConfig
  chartType: ChartType

  // 查询结果
  queryResult: QueryResult | null
  queryElapsed: number | null
  g2Spec: Record<string, any> | null

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
}

const defaultEncoding: EncodingConfig = {}

export const useStore = create<AppState>((set, get) => ({
  env: getEnv(),
  appMode: 'visualize',
  pipelineData: null,
  fields: [],
  tableName: '',
  loaded: false,
  loading: false,
  error: null,
  encoding: defaultEncoding,
  chartType: 'auto',
  queryResult: null,
  queryElapsed: null,
  g2Spec: null,
  sidebarOpen: false,
  selectedField: null,
  sqlPreviewOpen: false,

  loadFileWeb: async (file: File) => {
    set({ loading: true, error: null })
    try {
      const ds = getDataSource()
      await ds.loadFile(file)
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
      set({
        fields,
        tableName: ds.getTableName(),
        loaded: true,
        loading: false,
        encoding: {},
        queryResult: null,
        g2Spec: null,
      })
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
    })
  },
}))
