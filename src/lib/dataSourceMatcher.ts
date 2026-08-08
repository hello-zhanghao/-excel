/**
 * 数据源节点与目录文件的自动匹配模块
 *
 * 用于「一键替换数据源」：给定一批数据源节点和一批文件，
 * 根据名字（文件名/数据集名/节点标签）做模糊匹配，返回匹配结果供用户确认。
 */

/** 画布上的一个数据源节点信息 */
export interface DataSourceNodeInfo {
  nodeId: string
  /** 用于匹配的关键词（文件名基名 / 数据集名 / 节点标签） */
  matchKey: string
  /** 展示名（文件名 / 数据集名 / 节点标签） */
  displayName: string
}

/** 文件夹中的一个候选文件 */
export interface DataSourceFile {
  /** 文件名（含扩展名） */
  name: string
  /** 原始 File 对象，确认后用于解析 */
  file: File
}

/** 单个节点的匹配结果 */
export interface DataSourceMatch {
  nodeId: string
  nodeName: string
  /** 匹配到的文件在 files 中的下标；-1 表示未匹配（不替换） */
  fileIndex: number
}

/** 归一化：去扩展名、去分隔符、转小写 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[\s_\-（）()\[\]【】.:：]+/g, '')
    .trim()
}

/** Levenshtein 距离 */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
      prev = tmp
    }
  }
  return dp[n]
}

/** 相似度 0~1，1 表示完全相同 */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

/**
 * 为每个数据源节点在文件列表中匹配最佳文件。
 *
 * 匹配优先级：归一化完全相等 > 双向包含 > 编辑距离相似度。
 * 相似度低于阈值（默认 0.5）视为未匹配。
 */
export function matchDataSources(
  nodes: DataSourceNodeInfo[],
  files: DataSourceFile[],
  threshold = 0.5,
): DataSourceMatch[] {
  const normFiles = files.map((f) => normalize(f.name))

  return nodes.map((node) => {
    const nk = normalize(node.matchKey)
    if (!nk) {
      return { nodeId: node.nodeId, nodeName: node.displayName, fileIndex: -1 }
    }

    let bestIdx = -1
    let bestScore = -1

    normFiles.forEach((fk, i) => {
      if (!fk) return
      let score = -1
      if (fk === nk) {
        score = 1
      } else if (fk.includes(nk) || nk.includes(fk)) {
        // 包含关系：长度越接近分越高
        score = 0.9 - Math.abs(fk.length - nk.length) / 100
      } else {
        score = similarity(nk, fk)
      }
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    })

    return {
      nodeId: node.nodeId,
      nodeName: node.displayName,
      fileIndex: bestScore >= threshold ? bestIdx : -1,
    }
  })
}