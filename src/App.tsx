import { useRef, useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { FieldPanel } from '@/components/FieldPanel'
import { Dashboard } from '@/components/Dashboard'
import { PipelineCanvas } from '@/components/PipelineCanvas'
import { SAMPLE_DATASETS } from '@/data/sampleDatasets'

/** 运行时信息（桌面端通过 IPC 获取） */
interface RuntimeInfo {
  version?: string
  electron?: string
  chrome?: string
  node?: string
  platform?: string
}

/**
 * 主应用组件
 * 两种运行模式：浏览器运行（Web · SheetJS）| 桌面端运行（Desktop · DuckDB）
 * 两种工作模式：可视化模式（拖拽编码槽出图）| 流水线模式（节点画布数据处理）
 */
export default function App() {
  const {
    env, loaded, loading, error,
    loadFileWeb, loadFileElectron, loadSampleData,
    sidebarOpen, toggleSidebar, setSidebarOpen,
    selectedField, selectField,
    appMode, setAppMode,
  } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showRuntimeInfo, setShowRuntimeInfo] = useState(false)
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)

  // 桌面端：获取运行时版本信息
  useEffect(() => {
    if (env === 'electron') {
      const api = (window as any).electronAPI
      if (api?.getVersion) {
        api.getVersion().then((info: RuntimeInfo) => setRuntimeInfo(info))
      }
    }
  }, [env])

  const handleOpenFile = () => {
    if (env === 'electron') {
      loadFileElectron()
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      loadFileWeb(file)
    }
    e.target.value = '' // 允许重复选择同一文件
  }

  return (
    <div className="app">
      <header className="app-header">
        {/* 移动端菜单按钮 */}
        {loaded && appMode === 'visualize' && (
          <button className="menu-btn" onClick={toggleSidebar} aria-label="菜单">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {sidebarOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        )}
        <span className="logo">Excel BI Builder</span>

        {/* 运行环境徽章 — 点击查看详情 */}
        <span
          className={`env-badge ${env === 'electron' ? 'desktop' : 'web'}`}
          onClick={() => setShowRuntimeInfo(true)}
          title="点击查看运行时信息"
        >
          {env === 'electron' ? '桌面端 · DuckDB' : '浏览器 · SheetJS'}
        </span>

        {/* 模式切换 */}
        <div className="mode-switcher">
          <button
            className={`mode-btn ${appMode === 'visualize' ? 'active' : ''}`}
            onClick={() => setAppMode('visualize')}
          >
            可视化
          </button>
          <button
            className={`mode-btn ${appMode === 'pipeline' ? 'active' : ''}`}
            onClick={() => setAppMode('pipeline')}
          >
            数据流
          </button>
        </div>

        <div className="spacer" />
        {loaded && appMode === 'visualize' && (
          <button className="btn-open" onClick={handleOpenFile}>
            打开文件
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </header>

      {error && <div className="error-msg">{error}</div>}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      {appMode === 'pipeline' ? (
        <PipelineCanvas />
      ) : !loaded ? (
        <div className="empty-state">
          <div className="icon">📊</div>
          <div className="title">积木式 Excel 可视化工具</div>
          <div className="desc">
            加载 Excel/CSV 文件后，在仪表盘中添加图表卡片，
            每张卡片可独立选择数据源、配置 X/Y 轴绘制图表，或用经纬度在地图上打点。
            <br />
            也可进入"数据流"模式，用节点画布构建数据处理流水线。
          </div>

          {/* 运行模式指示卡片 */}
          <div className="mode-indicator-card">
            <div className={`mode-card ${env === 'web' ? 'active' : ''}`}>
              {env === 'web' && <span className="active-tag">当前</span>}
              <div className="mode-card-icon">🌐</div>
              <div className="mode-card-title">浏览器运行</div>
              <div className="mode-card-desc">
                SheetJS 解析 · JS 内存聚合<br />
                适合 10 万行以内数据<br />
                无需安装，开箱即用
              </div>
            </div>
            <div className={`mode-card ${env === 'electron' ? 'active' : ''}`}>
              {env === 'electron' && <span className="active-tag">当前</span>}
              <div className="mode-card-icon">🖥️</div>
              <div className="mode-card-title">桌面端运行</div>
              <div className="mode-card-desc">
                DuckDB 向量化引擎<br />
                支持百万级大数据<br />
                原生文件系统访问
              </div>
            </div>
          </div>

          {/* 示例数据快速入口 */}
          <div className="sample-section">
            <div className="sample-section-title">无需上传，直接体验示例数据</div>
            <div className="sample-grid">
              {SAMPLE_DATASETS.map((ds) => (
                <button
                  key={ds.id}
                  className="sample-card"
                  onClick={() => loadSampleData(ds.id)}
                >
                  <span className="sample-icon">{ds.icon}</span>
                  <span className="sample-name">{ds.name}</span>
                  <span className="sample-desc">{ds.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="upload-divider">
            <span>或上传自己的文件</span>
          </div>
          <button className="upload-btn" onClick={handleOpenFile}>
            {env === 'electron' ? '📂 选择本地文件' : '📤 上传 Excel/CSV'}
          </button>
        </div>
      ) : (
        <>
          {/* 移动端遮罩层 */}
          <div
            className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* 移动端选中字段提示条 */}
          {selectedField && (
            <div className="selected-field-bar">
              <span>已选: {selectedField.name}</span>
              <span style={{ opacity: 0.6, fontWeight: 400 }}>点击编码槽分配</span>
              <span className="cancel-select" onClick={() => selectField(null)}>×</span>
            </div>
          )}

          <div className="app-body">
            <FieldPanel />
            <div className="chart-area">
              <Dashboard />
            </div>
          </div>
        </>
      )}

      {/* 运行时信息弹窗 */}
      {showRuntimeInfo && (
        <RuntimeInfoModal
          env={env}
          runtimeInfo={runtimeInfo}
          onClose={() => setShowRuntimeInfo(false)}
        />
      )}
    </div>
  )
}

/** 运行时信息弹窗组件 */
function RuntimeInfoModal({
  env,
  runtimeInfo,
  onClose,
}: {
  env: string
  runtimeInfo: RuntimeInfo | null
  onClose: () => void
}) {
  return (
    <div className="runtime-modal-overlay" onClick={onClose}>
      <div className="runtime-modal" onClick={(e) => e.stopPropagation()}>
        <div className="runtime-modal-header">
          <span className="modal-icon">{env === 'electron' ? '🖥️' : '🌐'}</span>
          <span className="modal-title">运行时信息</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="runtime-modal-body">
          {/* 模式横幅 */}
          <div className={`runtime-mode-banner ${env === 'electron' ? 'desktop' : 'web'}`}>
            <span className="banner-icon">{env === 'electron' ? '🖥️' : '🌐'}</span>
            <span>
              {env === 'electron'
                ? '桌面端运行模式 — DuckDB 向量化引擎，支持大数据高效处理'
                : '浏览器运行模式 — SheetJS 解析，适合 10 万行以内数据'}
            </span>
          </div>

          {/* 信息行 */}
          <div className="runtime-info-row">
            <span className="label">运行模式</span>
            <span className="value">{env === 'electron' ? 'Desktop (Electron)' : 'Web (Browser)'}</span>
          </div>
          <div className="runtime-info-row">
            <span className="label">数据引擎</span>
            <span className="value">{env === 'electron' ? 'DuckDB' : 'SheetJS + JS'}</span>
          </div>
          <div className="runtime-info-row">
            <span className="label">建议数据量</span>
            <span className="value">{env === 'electron' ? '100 万行以上' : '10 万行以内'}</span>
          </div>

          {/* 桌面端额外信息 */}
          {env === 'electron' && runtimeInfo && (
            <>
              <div className="runtime-info-row">
                <span className="label">应用版本</span>
                <span className="value">v{runtimeInfo.version || '0.1.0'}</span>
              </div>
              <div className="runtime-info-row">
                <span className="label">Electron</span>
                <span className="value">{runtimeInfo.electron || '-'}</span>
              </div>
              <div className="runtime-info-row">
                <span className="label">Chromium</span>
                <span className="value">{runtimeInfo.chrome || '-'}</span>
              </div>
              <div className="runtime-info-row">
                <span className="label">Node.js</span>
                <span className="value">{runtimeInfo.node || '-'}</span>
              </div>
              <div className="runtime-info-row">
                <span className="label">操作系统</span>
                <span className="value">{runtimeInfo.platform || '-'}</span>
              </div>
            </>
          )}

          {/* Web 端额外信息 */}
          {env === 'web' && (
            <>
              <div className="runtime-info-row">
                <span className="label">浏览器</span>
                <span className="value">{navigator.userAgent.split(') ')[0].split('(').pop() || 'Unknown'}</span>
              </div>
              <div className="runtime-info-row">
                <span className="label">屏幕分辨率</span>
                <span className="value">{window.screen.width} × {window.screen.height}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
