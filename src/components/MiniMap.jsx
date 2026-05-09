import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const MOMENT_COLORS = { photo: '#BA7517', video: '#1D9E75', audio: '#7F77DD' }
const EMPTY_FC = { type: 'FeatureCollection', features: [] }

function createCalloutMarker(label, color) {
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none'
  el.innerHTML = `
    <div style="background:${color};color:#fff;font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;letter-spacing:0.6px;white-space:nowrap">${label}</div>
    <div style="width:1.5px;height:10px;background:${color}"></div>
    <div style="width:7px;height:7px;border-radius:50%;background:${color};border:2px solid #fff;flex-shrink:0"></div>
  `
  return el
}

export default function MiniMap({
  points = [],
  moments = [],
  className = '',
  interactive = false,
  onMomentClick,
  showStartStop = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const onMomentClickRef = useRef(onMomentClick)
  const latestPointsRef = useRef(points)
  const latestMomentsRef = useRef(moments)
  useEffect(() => { onMomentClickRef.current = onMomentClick }, [onMomentClick])
  useEffect(() => { latestPointsRef.current = points }, [points])
  useEffect(() => { latestMomentsRef.current = moments }, [moments])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const container = containerRef.current

    const map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-98.5795, 39.8283],
      zoom: 3,
      interactive,
      attributionControl: false,
    })
    mapRef.current = map

    map.on('load', () => {
      const pts = latestPointsRef.current
      const moms = latestMomentsRef.current

      if (pts.length === 1) {
        map.setCenter([pts[0].lng, pts[0].lat])
        map.setZoom(14)
      } else if (pts.length > 1) {
        const bounds = pts.reduce(
          (b, p) => b.extend([p.lng, p.lat]),
          new mapboxgl.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat])
        )
        map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 0 })
      }

      // Moment dots
      map.addSource('moments', { type: 'geojson', data: buildMomentsGeoJSON(moms) })
      map.addLayer({
        id: 'moment-dots',
        type: 'circle',
        source: 'moments',
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0f0f0f',
        },
      })

      // Start/end HTML callout markers (render above GL canvas)
      if (showStartStop && pts.length > 0) {
        const singlePoint = pts.length === 1 || (pts[0].lng === pts[pts.length - 1].lng && pts[0].lat === pts[pts.length - 1].lat)

        if (singlePoint) {
          const marker = new mapboxgl.Marker({
            element: createCalloutMarker('START/END', '#F59E0B'),
            anchor: 'bottom',
            offset: [0, 7],
          })
            .setLngLat([pts[0].lng, pts[0].lat])
            .addTo(map)
          markersRef.current.push(marker)
        } else {
          const startMarker = new mapboxgl.Marker({
            element: createCalloutMarker('START', '#1D9E75'),
            anchor: 'bottom',
            offset: [0, 7],
          })
            .setLngLat([pts[0].lng, pts[0].lat])
            .addTo(map)
          markersRef.current.push(startMarker)

          const endPt = pts[pts.length - 1]
          const endMarker = new mapboxgl.Marker({
            element: createCalloutMarker('END', '#EF4444'),
            anchor: 'bottom',
            offset: [0, 7],
          })
            .setLngLat([endPt.lng, endPt.lat])
            .addTo(map)
          markersRef.current.push(endMarker)
        }
      }

      if (!showStartStop) {
        const last = pts.length > 0 ? pts[pts.length - 1] : null
        map.addSource('position', { type: 'geojson', data: last ? ptFeature(last) : EMPTY_FC })
        map.addLayer({
          id: 'position-dot',
          type: 'circle',
          source: 'position',
          paint: { 'circle-radius': 6, 'circle-color': '#1D9E75', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
        })
      }
    })

    const handleClick = (e) => {
      if (!onMomentClickRef.current || !map.isStyleLoaded()) return
      const rect = container.getBoundingClientRect()
      const pt = new mapboxgl.Point(e.clientX - rect.left, e.clientY - rect.top)
      const features = map.queryRenderedFeatures(pt, { layers: ['moment-dots'] })
      const momentId = features[0]?.properties?.momentId
      if (momentId) onMomentClickRef.current(momentId)
    }
    const handleMouseMove = (e) => {
      if (!map.isStyleLoaded()) return
      const rect = container.getBoundingClientRect()
      const pt = new mapboxgl.Point(e.clientX - rect.left, e.clientY - rect.top)
      const features = map.queryRenderedFeatures(pt, { layers: ['moment-dots'] })
      container.style.cursor = features.length > 0 ? 'pointer' : ''
    }
    container.addEventListener('click', handleClick)
    container.addEventListener('mousemove', handleMouseMove)

    return () => {
      container.removeEventListener('click', handleClick)
      container.removeEventListener('mousemove', handleMouseMove)
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (!showStartStop && points.length > 0) {
      const last = points[points.length - 1]
      map.getSource('position')?.setData(ptFeature(last))
      map.easeTo({ center: [last.lng, last.lat], duration: 800 })
    }
  }, [points])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    map.getSource('moments')?.setData(buildMomentsGeoJSON(moments))
  }, [moments])

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-lg overflow-hidden border border-[#1e2e26] ${className}`}
      style={{ minHeight: 110, background: '#141a17' }}
    />
  )
}

function ptFeature(p) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] } }
}

function buildMomentsGeoJSON(moments) {
  return {
    type: 'FeatureCollection',
    features: moments
      .filter(m => m.lat && m.lng)
      .map(m => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
        properties: { color: MOMENT_COLORS[m.type] || '#888', momentId: m.id },
      })),
  }
}
