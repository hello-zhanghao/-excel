import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { DashboardMapConfig } from '@/types'

interface LeafletMapProps {
  rows: Record<string, any>[]
  config: DashboardMapConfig
}

/**
 * OpenStreetMap 地图打点组件 —— 基于 Leaflet
 * 使用 OSM 在线瓦片，按经纬度字段绘制气泡，支持名称提示与尺寸缩放
 */
export function LeafletMap({ rows, config }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  // 初始化地图（仅一次）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [35, 105],
      zoom: 4,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

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
    }
  }, [])

  // 数据 / 配置变化时重绘打点
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    const { lonField, latField, nameField, sizeField } = config
    if (!lonField || !latField) return

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

      const marker = L.circleMarker([lat, lng], {
        radius,
        color: '#f97316',
        weight: 1,
        fillColor: '#f97316',
        fillOpacity: 0.85,
      })

      const lines = [`<b>${name}</b>`]
      if (lonField) lines.push(`${lonField}: ${r[lonField]}`)
      if (latField) lines.push(`${latField}: ${r[latField]}`)
      if (sizeField) lines.push(`${sizeField}: ${r[sizeField]}`)
      marker.bindPopup(lines.join('<br/>'))

      layer.addLayer(marker)
    }

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })
    }
  }, [rows, config])

  return <div ref={containerRef} className="leaflet-map" />
}

export default LeafletMap