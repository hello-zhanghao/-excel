import { useEffect, useRef, useState } from 'react'

/** 下载入口 */
const DOWNLOAD_ITEMS = [
  {
    label: '国内下载（推荐）',
    desc: '阿里云服务器 · 国内直连快',
    href: 'http://8.160.160.145/downloads/',
    recommended: true,
  },
  {
    label: 'GitHub 下载',
    desc: '全球源 · 国内较慢',
    href: 'https://github.com/hello-zhanghao/-excel/releases/latest',
    recommended: false,
  },
]

interface DownloadMenuProps {
  /** 按钮文字，默认「⬇ 下载桌面版」 */
  label?: string
  /** 自定义样式类名 */
  className?: string
}

/**
 * 桌面版下载下拉菜单
 * 同时提供「阿里云国内直连」与「GitHub Releases」两个入口，
 * 点击外层容器展开，两次点击条目或点击外部区域自动收起。
 */
export default function DownloadMenu({ label = '⬇ 下载桌面版', className = '' }: DownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 点击外部区域时收起菜单
  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setOpen((v) => !v)
  }

  return (
    <div className={`download-menu ${className}`} ref={ref}>
      <button className="download-menu-trigger" onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
        {label}
        <span className="download-menu-caret">▾</span>
      </button>
      {open && (
        <div className="download-menu-panel" role="menu">
          {DOWNLOAD_ITEMS.map((item) => (
            <a
              key={item.href}
              className="download-menu-item"
              href={item.href}
              target="_blank"
              rel="noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className="download-menu-item-label">
                {item.label}
                {item.recommended && <em className="download-menu-tag">推荐</em>}
              </span>
              <span className="download-menu-item-desc">{item.desc}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}