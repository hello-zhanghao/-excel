import type { NodeOutput } from '@/types/pipeline'

/**
 * PPT 模板填充引擎 —— 双端通用适配器
 *
 * 把「pptExport 节点」的上游数据(区块) + PPT 模板，交给后端真正替换生成 .pptx。
 *
 * 双端实现：
 * - 桌面端：通过 Electron IPC 把区块数据发送到主进程，主进程调用本地 Python
 *   (excel2ppt 的 template_filler) 真正替换模板并生成 .pptx
 * - 网页端：不支持真正替换，返回错误提示（需桌面版）
 *
 * 数据契约：
 *   每个上游输入对应一个数据区块（sheet）。区块名 = 上游节点标签，
 *   恰好对应 excel2ppt 模板占位符中的「区块名 / sheet名」。
 */

/** 单个数据区块（对应模板中的一个区块/sheet） */
export interface PptDataBlock {
  /** 区块名（= 上游节点标签，对应模板占位符的 区块名/sheet名） */
  name: string
  /** 数据行 */
  rows: Record<string, any>[]
}

/** 生成 PPT 的请求参数 */
export interface PptGenerateRequest {
  /** 模板文件路径（桌面端） */
  templatePath?: string
  /** 模板文件名（网页端展示用） */
  templateName?: string
  /** 输出文件名（不含扩展名） */
  outputName?: string
  /** 是否追加时间戳 */
  addTimestamp?: boolean
  /** 是否标记缺失占位符 */
  markMissing?: boolean
  /** 要替换到模板的数据区块 */
  blocks: PptDataBlock[]
}

/** 生成 PPT 的结果 */
export interface PptGenerateResult {
  success: boolean
  /** 输出文件名（含扩展名） */
  name?: string
  /** 输出文件完整路径（桌面端） */
  path?: string
  /** 错误信息（success=false 时） */
  error?: string
  /** 统计信息（可选） */
  stats?: Record<string, number>
}

/** 是否为桌面端（存在 electronAPI） */
export function isElectronEnv(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI
}

/**
 * 判断一个 NodeOutput 是否携带多区块数据。
 * 返回每个上游输入的区块序列（优先 sheets，退化为单行数组）。
 */
export function toPptBlocks(output: NodeOutput): PptDataBlock[] {
  if (output.sheets && output.sheets.length > 0) {
    return output.sheets.map((s) => ({
      name: s.name,
      rows: s.rows,
    }))
  }
  return [{ name: '数据', rows: output.rows }]
}

/**
 * 生成 PPT（双端通用入口）。
 *
 * @param request 生成请求（含模板与区块数据）
 * @returns 生成结果
 */
export async function generatePpt(request: PptGenerateRequest): Promise<PptGenerateResult> {
  if (isElectronEnv()) {
    const api = (window as any).electronAPI
    if (api?.generatePpt) {
      return await api.generatePpt(request)
    }
    return { success: false, error: '桌面端 IPC 接口不可用' }
  }

  // 网页端：不支持真正替换
  return {
    success: false,
    error: '网页端不支持生成 PPT，请使用桌面版运行（内置 Python 模板填充引擎）',
  }
}

/**
 * 生成 PPT 的默认文件名（不含扩展名）。
 * 与 Excel 导出一致的命名规则。
 */
export function buildPptBaseName(
  outputName: string,
  addTimestamp: boolean,
  fallback = '导出PPT',
): string {
  const base = (outputName || fallback).slice(0, 25) || fallback
  if (!addTimestamp) return base
  const ts = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`
  return `${base}_${stamp}`
}