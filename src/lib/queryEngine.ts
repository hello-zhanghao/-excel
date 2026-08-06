import { getDataSource } from '@/lib/dataSourceFactory'
import { generateSQL } from '@/lib/encodingEngine'
import type { EncodingConfig, FieldMeta, QueryResult } from '@/types'

/**
 * 独立执行一次编码查询（供仪表盘卡片等场景复用）
 * 与 store.runQuery 逻辑一致，但不依赖组件状态
 */
export async function runQueryByEncoding(
  encoding: EncodingConfig,
  fields: FieldMeta[],
  tableName: string
): Promise<QueryResult> {
  const ds = getDataSource()
  const sql = generateSQL(encoding, tableName, fields)
  const result = await ds.query(sql)
  return result
}