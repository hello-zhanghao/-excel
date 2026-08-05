import type { DataSource, FieldMeta, QueryResult, DataType, QueryRow } from '@/types'
import { FieldKind } from '@/types'

/**
 * 桌面端数据源 —— 通过 Electron IPC 调用主进程的 DuckDB
 * 所有 SQL 查询在 Node 侧执行，只把聚合结果传回前端
 */
export class ElectronDataSource implements DataSource {
  private tableName = ''
  private loaded = false
  private fields: FieldMeta[] = []

  constructor() {
    // 确保 electronAPI 存在
    if (!(window as any).electronAPI) {
      throw new Error('Electron API 不可用，请在 Electron 环境中运行')
    }
  }

  private get api() {
    return (window as any).electronAPI
  }

  async loadFile(source: string): Promise<void> {
    const result = await this.api.loadFile(source)
    if (!result.success) {
      throw new Error(result.error)
    }
    this.tableName = result.tableName
    this.loaded = true
    this.fields = result.fields
  }

  /**
   * 直接加载行数组（内置示例数据）
   * 桌面端通过 IPC 将数据写入 DuckDB 内存表
   */
  async loadRows(rows: Record<string, any>[], name: string): Promise<void> {
    const result = await this.api.loadRows(rows, name)
    if (!result.success) {
      throw new Error(result.error)
    }
    this.tableName = result.tableName
    this.loaded = true
    this.fields = result.fields
  }

  async getSchema(): Promise<FieldMeta[]> {
    if (!this.loaded) return []
    return this.fields
  }

  async query(sql: string): Promise<QueryResult> {
    const result = await this.api.query(sql)
    if (!result.success) {
      throw new Error(result.error)
    }
    return {
      columns: result.columns,
      rows: result.rows as QueryRow[],
      elapsed: result.elapsed,
    }
  }

  getTableName(): string {
    return this.tableName
  }

  isLoaded(): boolean {
    return this.loaded
  }
}
