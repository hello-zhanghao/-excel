import type { DataSource, RuntimeEnv } from '@/types'
import { detectEnv } from '@/types'
import { ElectronDataSource } from './electronDataSource'
import { WebDataSource } from './webDataSource'

let instance: DataSource | null = null

/**
 * 根据运行环境创建对应的数据源
 * - Electron: 走 Node DuckDB（大数据高性能）
 * - Web: 走 SheetJS + JS 聚合（小数据，浏览器内）
 */
export function getDataSource(): DataSource {
  if (instance) return instance

  const env = detectEnv()
  if (env === 'electron') {
    instance = new ElectronDataSource()
  } else {
    instance = new WebDataSource()
  }
  return instance
}

export function getEnv(): RuntimeEnv {
  return detectEnv()
}
