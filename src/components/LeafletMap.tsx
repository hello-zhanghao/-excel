import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DashboardMapConfig } from '@/types'

interface LeafletMapProps {
  rows: Record<string, any>[]
  config: DashboardMapConfig
}

/** 分类着色调色板 */
const PALETTE = [
  '#f97316', '#3b82f6', '#22c55e', '#ef4444', '#a855f7',
  '#eab308', '#06b6d4', '#ec4899', '#84cc16', '#f59e0b',
  '#6366f1', '#14b8a6', '#f43f5e', '#8b5cf6', '#0ea5e9',
]

/**
 * OpenStreetMap 地图打点组件 —— 基于 Leaflet
 * 使用 OSM 在线瓦片，按经纬度字段绘制气泡，支持名称提示、尺寸缩放与按分类着色
 */
export function LeafletMap({ rows, config }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const legendElRef = useRef<HTMLDivElement | null>(null)

  // 初始化地图（仅一次）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [35, 105],
      zoom: 4,
      zoomControl: true,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      dragging: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    // 分类图例控件
    const LegendControl = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-color-legend') as HTMLDivElement
        legendElRef.current = div
        return div
      },
    })
    const legend = new LegendControl()
    legend.addTo(map)

    const layer = L.layerGroup().addTo(map)
    mapRef.current = map
    layerRef.current = layer

    // 容器尺寸可能尚未就绪，下一个帧再校正一次
    const raf = requestAnimationFrame(() => map.invalidateSize())

    return () => {
      cancelAnimationFrame(raf)
      map.remove()
      mapRef.current = null
      layerRef.current = null
      legendElRef.current = null
    }
  }, [])

  // 数据 / 配置变化时重绘打点
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    const { lonField, latField, nameField, sizeField, colorField } = config
    if (!lonField || !latField) return

    // 收集分类 → 颜色映射
    const categoryToColor = new Map<string, string>()
    if (colorField) {
      const seen: string[] = []
      for (const r of rows) {
        const c = String(r[colorField] ?? '').trim()
        if (c && !seen.includes(c)) seen.push(c)
      }
      seen.forEach((c, i) => categoryToColor.set(c, PALETTE[i % PALETTE.length]))
    }

    const points: L.LatLng[] = []
    const sizeValues: number[] = []

    for (const r of rows) {
      const lng = Number(r[lonField])
      const lat = Number(r[latField])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) continue
      ;(points as L.LatLng[]).push(L.latLng(lat, lng))
      if (sizeField) {
        const s = Number(r[sizeField] ?? 0)
        if (Number.isFinite(s)) sizeValues.push(s)
      }
    }

    const sizeMin = sizeValues.length ? Math.min(...sizeValues) : 0
    const sizeMax = sizeValues.length ? Math.max(...sizeValues) : 1
    const span = sizeMax - sizeMin || 1

    for (const r of rows) {
      const lng = Number(r[lonField])
      const lat = Number(r[latField])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) continue

      const raw = Number(sizeField ? r[sizeField] : 0)
      const radius = sizeField && Number.isFinite(raw) ? 6 + ((raw - sizeMin) / span) * 22 : 8
      const name = nameField ? String(r[nameField] ?? '') : `${lng}, ${lat}`
      const color = colorField
        ? (categoryToColor.get(String(r[colorField] ?? '').trim()) ?? '#f97316')
        : '#f97316'

      const marker = L.circleMarker([lat, lng], {
        radius,
        color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.85,
      })

      const lines = [`<b>${name}</b>`]
      if (lonField) lines.push(`${lonField}: ${r[lonField]}`)
      if (latField) lines.push(`${latField}: ${r[latField]}`)
      if (colorField) lines.push(`${colorField}: ${r[colorField]}`)
      if (sizeField) lines.push(`${sizeField}: ${r[sizeField]}`)
      marker.bindPopup(lines.join('<br/>'))

      layer.addLayer(marker)
    }

    // 更新分类图例
    if (legendElRef.current) {
      if (colorField && categoryToColor.size > 0) {
        const items = [...categoryToColor.entries()]
          .map(
            ([c, col]) =>
              `<div class="legend-item"><span class="legend-dot" style="background:${col}"></span>${escapeHtml(c)}</div>`
          )
          .join('')
        legendElRef.current.innerHTML = `<div class="legend-title">${escapeHtml(colorField)}</div>${items}`
        legendElRef.current.style.display = 'block'
      } else {
        legendElRef.current.style.display = 'none'
      }
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })
    }
  }, [rows, config])

  return <div ref={containerRef} className="leaflet-map" />
}

/** 简单 HTML 转义，防止字段值注入 */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default LeafletMap