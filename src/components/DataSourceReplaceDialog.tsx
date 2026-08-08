import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  matchDataSources,
  type DataSourceNodeInfo,
  type DataSourceFile,
  type DataSourceMatch,
} from '@/lib/dataSourceMatcher'

/** 支持的文件类型 */
const ACCEPTED_EXT = ['.xlsx', '.xls', '.csv']

function isAcceptedFile(name: string): boolean {
  const n = name.toLowerCase()
  return ACCEPTED_EXT.some((ext) => n.endsWith(ext))
}

export interface ReplaceConfirmItem {
  nodeId: string
  file: File
}

export interface DataSourceReplaceDialogProps {
  /** 画布上的数据源节点信息 */
  dataSourceNodes: DataSourceNodeInfo[]
  /** 确认替换 */
  onConfirm: (items: ReplaceConfirmItem[]) => void
  onClose: () => void
}

/**
 * 一键替换数据源弹窗
 *
 * - 选择一个文件夹（网页端通过 webkitdirectory 读取）
 * - 自动按名字将目录中的文件匹配到各数据源节点
 * - 展示匹配结果，允许手动调整（下拉选择 / 不替换）
 * - 确认后统一替换
 */
export function DataSourceReplaceDialog({
  dataSourceNodes,
  onConfirm,
  onClose,
}: DataSourceReplaceDialogProps) {
  const [files, setFiles] = useState<DataSourceFile[]>([])
  const [folderName, setFolderName] = useState('')
  const [matches, setMatches] = useState<DataSourceMatch[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  /** 选择文件夹：读取所有受支持文件 */
  const handlePickFolder = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files
      if (!list || list.length === 0) return
      const picked: DataSourceFile[] = []
      for (const f of Array.from(list)) {
        if (isAcceptedFile(f.name)) picked.push({ name: f.name, file: f })
      }
      // 取第一个文件的 webkitRelativePath 作为文件夹名
      const first = Array.from(list)[0]
      const rel = (first as any).webkitRelativePath as string | undefined
      const folder = rel ? rel.split('/')[0] : '已选择文件夹'
      setFolderName(folder)
      setFiles(picked)
      setMatches(
        matchDataSources(dataSourceNodes, picked),
      )
      e.target.value = ''
    },
    [dataSourceNodes],
  )

  /** 用户手动调整某个节点的匹配文件 */
  const handleChangeMatch = useCallback(
    (nodeId: string, fileIndex: number) => {
      setMatches((prev) =>
        prev.map((m) => (m.nodeId === nodeId ? { ...m, fileIndex } : m)),
      )
    },
    [],
  )

  /** 确认替换 */
  const handleConfirm = useCallback(() => {
    const items: ReplaceConfirmItem[] = []
    for (const m of matches) {
      if (m.fileIndex >= 0 && files[m.fileIndex]) {
        items.push({ nodeId: m.nodeId, file: files[m.fileIndex].file })
      }
    }
    if (items.length === 0) {
      showToast('没有可替换的匹配项')
      return
    }
    setBusy(true)
    onConfirm(items)
    setBusy(false)
  }, [matches, files, onConfirm, showToast])

  const matchedCount = useMemo(
    () => matches.filter((m) => m.fileIndex >= 0).length,
    [matches],
  )

  return (
    <div className="tpl-overlay" onClick={onClose}>
      <div
        className="tpl-modal dsr-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="tpl-modal-header">
          <span className="tpl-modal-title">🔁 一键替换数据源</span>
          <button className="tpl-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="dsr-body">
          <div className="dsr-step">
            <div className="dsr-step-title">1. 选择文件夹</div>
            {files.length === 0 ? (
              <button
                className="tpl-btn tpl-btn-primary"
                onClick={() => dirInputRef.current?.click()}
              >
                📁 选择文件夹
              </button>
            ) : (
              <div className="dsr-folder">
                <span>📁 {folderName}</span>
                <span className="dsr-folder-count">{files.length} 个数据文件</span>
                <button
                  className="tpl-btn tpl-btn-sm tpl-btn-secondary"
                  onClick={() => dirInputRef.current?.click()}
                >
                  重新选择
                </button>
              </div>
            )}
            <input
              ref={dirInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              style={{ display: 'none' }}
              // webkitdirectory 让浏览器读取整个文件夹；TS 无此类型，用 any 断言
              {...({ webkitdirectory: '', directory: '' } as any)}
              onChange={handlePickFolder}
            />
          </div>

          <div className="dsr-step">
            <div className="dsr-step-title">
              2. 匹配结果
              {files.length > 0 && (
                <span className="dsr-match-count">
                  已自动匹配 {matchedCount}/{dataSourceNodes.length} 个数据源
                </span>
              )}
            </div>

            {files.length === 0 ? (
              <div className="dsr-empty">
                选择文件夹后，将按名字自动匹配到下方的数据源节点
              </div>
            ) : dataSourceNodes.length === 0 ? (
              <div className="dsr-empty">画布上没有数据源节点</div>
            ) : (
              <div className="dsr-table">
                <div className="dsr-row dsr-row-head">
                  <span>数据源节点</span>
                  <span>匹配文件</span>
                </div>
                {matches.map((m) => (
                  <div className="dsr-row" key={m.nodeId}>
                    <span className="dsr-node-name" title={m.nodeName}>
                      {m.nodeName}
                    </span>
                    <select
                      className="dsr-select"
                      value={m.fileIndex}
                      onChange={(e) =>
                        handleChangeMatch(m.nodeId, Number(e.target.value))
                      }
                    >
                      <option value={-1}>（不替换）</option>
                      {files.map((f, i) => (
                        <option key={i} value={i}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 底部操作 */}
        <div className="dsr-footer">
          <button className="tpl-btn tpl-btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            className="tpl-btn tpl-btn-primary"
            onClick={handleConfirm}
            disabled={busy || matchedCount === 0}
          >
            确认替换 {matchedCount} 个数据源
          </button>
        </div>

        {toast && <div className="tpl-toast">{toast}</div>}
      </div>
    </div>
  )
}

export default DataSourceReplaceDialog