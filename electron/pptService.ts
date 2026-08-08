import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { promisify } from 'util'
import * as XLSX from 'xlsx'

const execFileAsync = promisify(execFile)

/**
 * PPT 模板填充服务 —— 运行在 Electron 主进程
 *
 * 接收渲染进程传来的数据区块(上游数据)与 PPT 模板路径，
 * 把区块写入临时 xlsx，再调用本地 Python(excel2ppt 的 template_filler)
 * 真正替换模板占位符并生成 .pptx。
 *
 * 引擎路径解析（优先级从高到低）：
 *   1. 环境变量 EXCEL2PPT_DIR（指向 template_filler 目录）
 *   2. 项目 vendor/ppt_filler 目录（若随应用打包）
 *   3. 默认 excel2ppt 开发目录
 */

/** 数据区块（对应模板中的一个区块/sheet） */
export interface PptDataBlock {
  name: string
  rows: Record<string, any>[]
}

/** 生成请求 */
export interface PptGenerateRequest {
  templatePath?: string
  outputName?: string
  addTimestamp?: boolean
  markMissing?: boolean
  imageDir?: string
  blocks: PptDataBlock[]
}

/** 生成结果 */
export interface PptGenerateResult {
  success: boolean
  name?: string
  path?: string
  error?: string
  stdout?: string
  stderr?: string
}

/** 解析模板填充引擎目录 */
export function resolveFillerDir(): string | null {
  const envDir = process.env.EXCEL2PPT_DIR
  if (envDir && fs.existsSync(path.join(envDir, 'template_filler.py'))) {
    return envDir
  }
  // 随应用打包的 vendor 目录
  const vendorDir = path.join(appRoot(), 'vendor', 'ppt_filler')
  if (fs.existsSync(path.join(vendorDir, 'template_filler.py'))) {
    return vendorDir
  }
  // 默认 excel2ppt 开发目录
  const devDir = 'F:\\【1】AI探索\\【3】excel2ppt\\template_filler'
  if (fs.existsSync(path.join(devDir, 'template_filler.py'))) {
    return devDir
  }
  return null
}

/** 应用根目录（dist-electron 的上一级） */
function appRoot(): string {
  try {
    return path.resolve(__dirname, '..', '..')
  } catch {
    return process.cwd()
  }
}

/** 安全文件名（只保留通用字符） */
function safeName(name: string): string {
  return (name || '区块').replace(/[\\/:*?"<>|]/g, '_').slice(0, 31) || '区块'
}

/**
 * 把数据区块写入一个临时 xlsx（每个区块一个 sheet，sheet 名=区块名）。
 * 返回临时文件路径。
 */
function writeBlocksToXlsx(blocks: PptDataBlock[]): string | null {
  if (!blocks || blocks.length === 0) return null
  const wb = XLSX.utils.book_new()
  const usedNames = new Set<string>()
  let written = 0

  for (const block of blocks) {
    if (!block.rows || block.rows.length === 0) continue
    const columns: string[] = block.rows.length > 0
      ? Object.keys(block.rows[0])
      : []
    if (columns.length === 0) continue

    const aoa: any[][] = [columns]
    for (const row of block.rows) {
      aoa.push(columns.map((col) => row[col] ?? ''))
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = columns.map((col) => ({ wch: Math.max(String(col).length * 2, 12) }))

    let sheetName = safeName(block.name)
    if (usedNames.has(sheetName)) {
      let i = 2
      while (usedNames.has(`${sheetName}_${i}`)) i++
      sheetName = `${sheetName}_${i}`
    }
    usedNames.add(sheetName)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    written++
  }

  if (written === 0) return null

  const tmpPath = path.join(os.tmpdir(), `ppt_fill_${Date.now()}.xlsx`)
  XLSX.writeFile(wb, tmpPath)
  return tmpPath
}

/** 生成默认输出文件名（含扩展名） */
function buildOutputName(request: PptGenerateRequest): string {
  const base = (request.outputName || '导出PPT').slice(0, 25) || '导出PPT'
  if (request.addTimestamp === false) return `${base}.pptx`
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${base}_${stamp}.pptx`
}

/** 定位 Python 可执行文件（优先 EXCEL2PPT_PYTHON 环境变量） */
function resolvePython(): string {
  return process.env.EXCEL2PPT_PYTHON || 'python'
}

/**
 * 生成 PPT —— 主入口
 *
 * 流程：
 * 1. 校验模板文件存在
 * 2. 把数据区块写入临时 xlsx
 * 3. 调用 python main.py <模板> --image-dir <临时目录> -o <输出> [--no-mark]
 *    （main.py 会自动合并临时目录下所有 xlsx，按 sheet 名区块区分）
 * 4. 输出保存在模板所在目录（imageDir 优先）
 */
export async function generatePpt(request: PptGenerateRequest): Promise<PptGenerateResult> {
  const templatePath = request.templatePath
  if (!templatePath) {
    return { success: false, error: '未指定 PPT 模板文件' }
  }
  if (!fs.existsSync(templatePath)) {
    return { success: false, error: `模板文件不存在: ${templatePath}` }
  }

  const fillerDir = resolveFillerDir()
  if (!fillerDir) {
    return {
      success: false,
      error: '未找到 PPT 模板填充引擎(excel2ppt template_filler)，请设置 EXCEL2PPT_DIR 环境变量',
    }
  }

  // 目标输出目录：优先模板所在目录
  const outDir = request.imageDir || path.dirname(templatePath)
  const outName = buildOutputName(request)
  const outPath = path.join(outDir, outName)

  // 写临时 xlsx
  const tmpXlsx = writeBlocksToXlsx(request.blocks)
  if (!tmpXlsx) {
    return { success: false, error: '没有可用的数据区块（上游数据为空）' }
  }

  try {
    const args: string[] = []
    // main.py 第一参数是模板路径
    args.push(path.join(fillerDir, 'main.py'))
    args.push(templatePath)
    args.push('--image-dir')
    args.push(path.dirname(tmpXlsx))
    args.push('-o')
    args.push(outPath)
    if (request.markMissing === false) {
      args.push('--no-mark')
    }

    const { stdout, stderr } = await execFileAsync(resolvePython(), args, {
      cwd: fillerDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 20,
      windowsHide: true,
      timeout: 120000,
    })

    if (!fs.existsSync(outPath)) {
      return {
        success: false,
        error: 'Python 执行完成但未生成输出文件',
        stdout,
        stderr,
      }
    }

    return {
      success: true,
      name: outName,
      path: outPath,
      stdout,
      stderr,
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Python 执行失败: ${err?.message || String(err)}`,
      stdout: err?.stdout,
      stderr: err?.stderr,
    }
  } finally {
    try { fs.unlinkSync(tmpXlsx) } catch { /* ignore */ }
  }
}