import * as XLSX from 'xlsx'
import type { DataSource, FieldMeta, QueryResult, DataType, QueryRow } from '@/types'
import { FieldKind } from '@/types'

/**
 * Web 端数据源 —— 使用 SheetJS 解析 + JS 内存聚合
 * 支持十万行数据，通过增量聚合 + 结果截断控制内存
 *
 * 内部维护一个 JSON 行数组，query() 时做 GROUP BY 聚合
 */

/** 无聚合查询最多返回的行数（十万行级） */
const MAX_RESULT_ROWS = 100000

export class WebDataSource implements DataSource {
  private tableName = ''
  private loaded = false
  private fields: FieldMeta[] = []
  private rows: Record<string, any>[] = []

  async loadFile(source: File): Promise<void> {
    const buffer = await source.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
    const firstSheet = workbook.SheetNames[0]
    const sheet = workbook.Sheets[firstSheet]

    // 解析为 JSON 行数组
    this.rows = XLSX.utils.sheet_to_json(sheet, { defval: null })
    this.tableName = source.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_')
    this.loaded = true

    // 推断字段类型
    this.fields = this.inferSchema(this.rows)
  }

  /**
   * 直接从行数组加载数据（用于内置示例数据集）
   * 跳过文件解析步骤，直接注入内存
   */
  async loadRows(rows: Record<string, any>[], name: string): Promise<void> {
    this.rows = rows
    this.tableName = name.replace(/[^a-zA-Z0-9_]/g, '_')
    this.loaded = true
    this.fields = this.inferSchema(this.rows)
  }

  /**
   * 从数据行推断字段类型和分类
   */
  private inferSchema(rows: Record<string, any>[]): FieldMeta[] {
    if (rows.length === 0) return []

    const fieldNames = Object.keys(rows[0])
    const samples: Record<string, string[]> = {}

    return fieldNames.map((name) => {
      // 采样前 5 个非空值
      const values = rows.slice(0, 100).map((r) => r[name]).filter((v) => v != null && v !== '')
      const sample = values.slice(0, 5).map(String)
      samples[name] = sample

      let dataType: DataType = 'string'
      let kind: FieldKind = FieldKind.Dimension

      if (values.length > 0) {
        const firstVal = values[0]
        if (firstVal instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(String(firstVal))) {
          dataType = 'date'
          kind = FieldKind.Dimension
        } else if (typeof firstVal === 'number' || /^-?\d+(\.\d+)?$/.test(String(firstVal))) {
          dataType = 'number'
          kind = FieldKind.Measure
        } else if (typeof firstVal === 'boolean') {
          dataType = 'boolean'
          kind = FieldKind.Dimension
        }
      }

      return { name, dataType, kind, sample }
    })
  }

  async getSchema(): Promise<FieldMeta[]> {
    return this.fields
  }

  /**
   * 简易 SQL 解析 —— 支持 SELECT + GROUP BY + 聚合函数
   * 格式: SELECT field1, AGG(field2) FROM data [WHERE field IN (v1,v2)] [GROUP BY field1]
   *
   * 这不是完整 SQL 引擎，仅满足 BI 拖拽生成的查询模式
   */
  async query(sql: string): Promise<QueryResult> {
    const start = performance.now()

    // 解析 SELECT 子句
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+\w+/i)
    if (!selectMatch) throw new Error('无法解析 SQL: ' + sql)

    const selectPart = selectMatch[1].trim()
    const groupByMatch = sql.match(/GROUP BY\s+(.+?)(\s+(LIMIT|ORDER|HAVING)|$)/i)
    const whereMatch = sql.match(/WHERE\s+(.+?)\s+(GROUP BY|ORDER|LIMIT|$)/i)

    // 解析 SELECT 字段
    const selectFields = this.parseSelectFields(selectPart)
    const groupByFields = groupByMatch
      ? groupByMatch[1].split(',').map((s) => s.trim().replace(/^"|"$/g, ''))
      : []

    // 过滤
    let data = this.rows
    if (whereMatch) {
      data = this.applyFilter(data, whereMatch[1])
    }

    // 聚合
    let resultRows: QueryRow[]
    let columns: string[]

    if (groupByFields.length > 0 || selectFields.some((f) => f.aggregation)) {
      const { rows: aggRows, cols } = this.aggregate(data, selectFields, groupByFields)
      resultRows = aggRows
      columns = cols
    } else {
      // 无聚合，直接返回数据（支持十万行，不再硬性截断）
      columns = selectFields.map((f) => f.alias)
      resultRows = data.slice(0, MAX_RESULT_ROWS).map((row) => {
        const obj: QueryRow = {}
        selectFields.forEach((f) => {
          obj[f.alias] = row[f.field] ?? null
        })
        return obj
      })
    }

    const elapsed = Math.round(performance.now() - start)
    return { columns, rows: resultRows, elapsed }
  }

  private parseSelectFields(selectPart: string) {
    // 匹配 field 或 AGG(field) as alias，支持带双引号的字段名
    const fields: { field: string; aggregation?: string; alias: string }[] = []
    const parts = this.splitSelect(selectPart)

    for (const part of parts) {
      const trimmed = part.trim()
      // 匹配 AGG("field") 或 AGG(field)
      const aggMatch = trimmed.match(/(\w+)\s*\(\s*"?(\w+)"?\s*\)/i)
      if (aggMatch) {
        const aggregation = aggMatch[1].toLowerCase()
        const field = aggMatch[2]
        const aliasMatch = trimmed.match(/as\s+"?(\w+)"?/i)
        const alias = aliasMatch ? aliasMatch[1] : `${aggregation}_${field}`
        fields.push({ field, aggregation, alias })
      } else {
        const aliasMatch = trimmed.match(/as\s+"?(\w+)"?/i)
        const field = trimmed.replace(/\s+as\s+"?\w+"?/i, '').trim().replace(/^"|"$/g, '')
        const alias = aliasMatch ? aliasMatch[1] : field
        fields.push({ field, alias })
      }
    }
    return fields
  }

  private splitSelect(selectPart: string): string[] {
    const parts: string[] = []
    let depth = 0
    let current = ''
    for (const ch of selectPart) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (ch === ',' && depth === 0) {
        parts.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    if (current.trim()) parts.push(current)
    return parts
  }

  private applyFilter(data: Record<string, any>[], condition: string): Record<string, any>[] {
    // 简单解析: "field" IN ('v1', 'v2') 或 field IN ('v1', 'v2')
    const inMatch = condition.match(/"?(\w+)"?\s+IN\s*\(([^)]+)\)/i)
    if (inMatch) {
      const field = inMatch[1]
      const values = inMatch[2].split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
      return data.filter((row) => values.includes(String(row[field])))
    }
    return data
  }

  private aggregate(
    data: Record<string, any>[],
    selectFields: { field: string; aggregation?: string; alias: string }[],
    groupByFields: string[]
  ): { rows: QueryRow[]; cols: string[] } {
    const cols = selectFields.map((f) => f.alias)

    // 增量聚合累加器
    interface Acc {
      sum: number
      count: number
      min: number | null
      max: number | null
      distinct: Set<string>
      first: Record<string, any>
    }

    const makeAcc = (firstRow: Record<string, any>): Acc => ({
      sum: 0, count: 0, min: null, max: null, distinct: new Set(), first: firstRow,
    })

    const accumulate = (acc: Acc, row: Record<string, any>, field: string) => {
      const raw = row[field]
      if (raw == null || raw === '') return
      const num = Number(raw)
      if (!isNaN(num)) {
        acc.sum += num
        acc.count++
        if (acc.min === null || num < acc.min) acc.min = num
        if (acc.max === null || num > acc.max) acc.max = num
      }
      acc.distinct.add(String(raw))
    }

    const finalize = (acc: Acc, aggregation: string): number => {
      switch (aggregation.toLowerCase()) {
        case 'sum': return acc.sum
        case 'avg': return acc.count > 0 ? acc.sum / acc.count : 0
        case 'count': return acc.count
        case 'count_distinct': return acc.distinct.size
        case 'min': return acc.min ?? 0
        case 'max': return acc.max ?? 0
        default: return 0
      }
    }

    if (groupByFields.length === 0) {
      // 无 GROUP BY，全局增量聚合（单遍扫描）
      let acc = makeAcc(data[0] ?? {})
      if (data.length > 0) {
        for (const row of data) {
          for (const f of selectFields) {
            if (f.aggregation) accumulate(acc, row, f.field)
          }
        }
      }
      const row: QueryRow = {}
      for (const f of selectFields) {
        if (f.aggregation) {
          row[f.alias] = finalize(acc, f.aggregation)
        } else {
          row[f.alias] = data[0]?.[f.field] ?? null
        }
      }
      return { rows: [row], cols }
    }

    // 有 GROUP BY：单遍扫描增量聚合，不保存分组行
    const groups = new Map<string, Acc>()
    for (const row of data) {
      const key = groupByFields.map((f) => String(row[f] ?? '')).join('\u0001')
      let acc = groups.get(key)
      if (!acc) {
        acc = makeAcc(row)
        groups.set(key, acc)
      }
      for (const f of selectFields) {
        if (f.aggregation) accumulate(acc, row, f.field)
      }
    }

    const resultRows: QueryRow[] = []
    for (const [key, acc] of groups) {
      const keyParts = key.split('\u0001')
      const row: QueryRow = {}
      groupByFields.forEach((f, i) => {
        row[f] = keyParts[i]
      })
      selectFields.forEach((f) => {
        if (f.aggregation) {
          row[f.alias] = finalize(acc, f.aggregation)
        } else if (!groupByFields.includes(f.field)) {
          row[f.alias] = acc.first[f.field] ?? null
        }
      })
      resultRows.push(row)
    }

    return { rows: resultRows, cols }
  }

  getTableName(): string {
    return this.tableName
  }

  isLoaded(): boolean {
    return this.loaded
  }
}
