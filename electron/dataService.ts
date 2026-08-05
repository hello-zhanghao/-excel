import * as duckdb from 'duckdb'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import type { FieldMeta, DataType, QueryRow } from '../src/types'
import { FieldKind } from '../src/types'

/**
 * DuckDB 数据服务 —— 运行在 Electron 主进程
 * 利用 DuckDB 的向量化执行引擎处理大数据
 */
export class DataService {
  private db: duckdb.Database
  private tableName = ''
  private fields: FieldMeta[] = []
  private loaded = false

  constructor() {
    // 使用内存数据库，也可用持久化文件 ':memory:' or filepath
    this.db = new duckdb.Database(':memory:')
  }

  /**
   * 加载 Excel/CSV 文件到 DuckDB
   * DuckDB 原生支持直接读取 .csv / .parquet
   * Excel (.xlsx) 需要先安装 spatial 扩展或转 CSV
   */
  async loadFile(filePath: string): Promise<{ tableName: string; fields: FieldMeta[] }> {
    const ext = path.extname(filePath).toLowerCase()
    // 表名：文件名去后缀，清洗非法字符
    const baseName = path.basename(filePath, ext).replace(/[^a-zA-Z0-9_]/g, '_')
    this.tableName = `t_${baseName}`

    if (ext === '.csv') {
      await this.loadCSV(filePath)
    } else if (ext === '.xlsx' || ext === '.xls') {
      await this.loadExcel(filePath)
    } else if (ext === '.parquet') {
      await this.loadParquet(filePath)
    } else {
      throw new Error(`不支持的文件格式: ${ext}`)
    }

    this.fields = await this.inferSchema()
    this.loaded = true
    return { tableName: this.tableName, fields: this.fields }
  }

  /**
   * 直接加载行数组到 DuckDB（用于内置示例数据集）
   * 将行数据写入临时 JSON 文件，再用 read_json_auto 导入
   */
  async loadRows(rows: Record<string, any>[], name: string): Promise<{ tableName: string; fields: FieldMeta[] }> {
    this.tableName = `t_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`

    if (rows.length === 0) {
      // 空数据：创建一个空表
      await this.runSql(`CREATE TABLE ${this.tableName} (placeholder VARCHAR)`)
    } else {
      // 序列化行数据为 JSON（Date 对象转为 ISO 字符串）
      const serialized = rows.map((row) => {
        const obj: Record<string, any> = {}
        for (const [k, v] of Object.entries(row)) {
          if (v instanceof Date) {
            obj[k] = v.toISOString()
          } else {
            obj[k] = v
          }
        }
        return obj
      })

      // 写入临时 JSON 文件
      const tmpPath = path.join(os.tmpdir(), `duckdb_load_${Date.now()}.json`)
      fs.writeFileSync(tmpPath, JSON.stringify(serialized))

      try {
        await this.runSql(
          `CREATE TABLE ${this.tableName} AS SELECT * FROM read_json_auto('${tmpPath}', auto_detect=true)`
        )
      } finally {
        // 清理临时文件
        try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
      }
    }

    this.fields = await this.inferSchema()
    this.loaded = true
    return { tableName: this.tableName, fields: this.fields }
  }

  /**
   * 直接用 DuckDB 读取 CSV（最快）
   */
  private loadCSV(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `CREATE TABLE ${this.tableName} AS SELECT * FROM read_csv_auto('${filePath}', header=true)`
      this.db.run(sql, (err) => {
        if (err) reject(new Error(`CSV 加载失败: ${err.message}`))
        else resolve()
      })
    })
  }

  /**
   * Excel 需要先安装 spatial 扩展来读取 xlsx
   * 或者用 SheetJS 先转 CSV 再导入（更稳定）
   */
  private async loadExcel(filePath: string): Promise<void> {
    // 方案：用 DuckDB 的 spatial 扩展读取 xlsx
    // 如果扩展不可用，回退到临时 CSV
    try {
      await this.runSql(`INSTALL spatial; LOAD spatial;`)
      await this.runSql(
        `CREATE TABLE ${this.tableName} AS SELECT * FROM st_read('${filePath}')`
      )
    } catch {
      // 回退：用 xlsx 包转 CSV（在主进程也可用）
      const XLSX = require('xlsx')
      const workbook = XLSX.readFile(filePath, { cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const csvPath = filePath.replace(/\.xlsx?$/i, '.tmp.csv')
      const csv = XLSX.utils.sheet_to_csv(sheet)
      fs.writeFileSync(csvPath, csv)
      await this.loadCSV(csvPath)
      fs.unlinkSync(csvPath) // 清理临时文件
    }
  }

  private loadParquet(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `CREATE TABLE ${this.tableName} AS SELECT * FROM read_parquet('${filePath}')`
      this.db.run(sql, (err) => {
        if (err) reject(new Error(`Parquet 加载失败: ${err.message}`))
        else resolve()
      })
    })
  }

  /**
   * 推断字段类型和维度/度量分类
   */
  private inferSchema(): Promise<FieldMeta[]> {
    return new Promise((resolve, reject) => {
      this.db.all(`DESCRIBE ${this.tableName}`, (err, rows: any[]) => {
        if (err) {
          reject(err)
          return
        }

        const fields: FieldMeta[] = rows.map((row) => {
          const name = row.column_name
          const duckType: string = row.column_type.toUpperCase()
          let dataType: DataType = 'string'
          let kind: FieldKind = FieldKind.Dimension

          if (duckType.includes('INT') || duckType.includes('FLOAT') || duckType.includes('DOUBLE') || duckType.includes('DECIMAL')) {
            dataType = 'number'
            kind = FieldKind.Measure
          } else if (duckType.includes('DATE') || duckType.includes('TIME') || duckType.includes('TIMESTAMP')) {
            dataType = 'date'
            kind = FieldKind.Dimension
          } else if (duckType.includes('BOOL')) {
            dataType = 'boolean'
            kind = FieldKind.Dimension
          } else {
            dataType = 'string'
            kind = FieldKind.Dimension
          }

          return { name, dataType, kind }
        })

        // 异步获取示例值
        this.db.all(
          `SELECT * FROM ${this.tableName} LIMIT 5`,
          (err2, sampleRows: any[]) => {
            if (!err2 && sampleRows.length > 0) {
              fields.forEach((f) => {
                f.sample = sampleRows.map((r) => String(r[f.name] ?? '')).filter((v) => v)
              })
            }
            resolve(fields)
          }
        )
      })
    })
  }

  /**
   * 执行 SQL 查询
   */
  query(sql: string): Promise<{ columns: string[]; rows: QueryRow[] }> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, (err, rows: any[]) => {
        if (err) {
          reject(err)
          return
        }
        if (rows.length === 0) {
          resolve({ columns: [], rows: [] })
          return
        }
        const columns = Object.keys(rows[0])
        const typedRows: QueryRow[] = rows.map((r) => {
          const obj: QueryRow = {}
          for (const [k, v] of Object.entries(r)) {
            if (v instanceof Date) {
              obj[k] = v.toISOString().split('T')[0]
            } else {
              obj[k] = v as any
            }
          }
          return obj
        })
        resolve({ columns, rows: typedRows })
      })
    })
  }

  async getSchema(): Promise<FieldMeta[]> {
    if (!this.loaded) {
      this.fields = await this.inferSchema()
      this.loaded = true
    }
    return this.fields
  }

  private runSql(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}
