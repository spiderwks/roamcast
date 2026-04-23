import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const MOMENT_COLORS = { photo: '#BA7517', video: '#1D9E75', audio: '#7F77DD' }
const EMPTY_FC = { type: 'FeatureCollection', features: [] }

export default function MiniMap({
  points = [],
  moments = [],
  className = '',
  interactive = false,
  onMomentClick,
  routeGeometry = null,
  showStartStop = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const onMomentClickRef = useRef(onMomentClick)
  const latestPointsRef = useRef(points)
  const latestMomentsRef = useRef(moments)
  const latestRouteRef = useRef(routeGeometry)

  useEffect(() => { onMomentClickRef.current = onMomentClick }, [onMomentClick])
  useEffect(() => { latestPointsRef.current = points }, [points])
  useEffect(() => { latestMomentsRef.current = moments }, [moments])
  useEffect(() => { latestRouteRef.current = routeGeometry }, [routeGeometry])

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
      const route = latestRouteRef.current

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

      const pathData = route ? { type: 'Feature', geometry: route } : buildLineGeoJSON(pts)
      map.addSource('path', { type: 'geojson', data: pathData })
      map.addLayer({ id: 'path-line', type: 'line', source: 'path', paint: { 'line-color': '#1D9E75', 'line-width': 2.5 } })

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

      if (showStartStop) {
        map.addSource('start-pos', { type: 'geojson', data: pts.length > 0 ? ptFeature(pts[0]) : EMPTY_FC })
        map.addLayer({ id: 'start-outer', type: 'circle', source: 'start-pos', paint: { 'circle-radius': 9, 'circle-color': '#1D9E75', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
        map.addLayer({ id: 'start-inner', type: 'circle', source: 'start-pos', paint: { 'circle-radius': 3.5, 'circle-color': '#fff' } })
        map.addSource('end-pos', { type: 'geojson', data: pts.length > 1 ? ptFeature(pts[pts.length - 1]) : EMPTY_FC })
        map.addLayer({ id: 'end-outer', type: 'circle', source: 'end-pos', paint: { 'circle-radius': 9, 'circle-color': '#EF4444', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
        map.addLayer({ id: 'end-inner', type: 'circle', source: 'end-pos', paint: { 'circle-radius': 3.5, 'circle-color': '#fff' } })
      } else {
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
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const pathData = routeGeometry
      ? { type: 'Feature', geometry: routeGeometry }
      : buildLineGeoJSON(points)
    map.getSource('path')?.setData(pathData)
    if (showStartStop) {
      if (points.length > 0) map.getSource('start-pos')?.setData(ptFeature(points[0]))
      if (points.length > 1) map.getSource('end-pos')?.setData(ptFeature(points[points.length - 1]))
    } else if (points.length > 0) {
      const last = points[points.length - 1]
      map.getSource('position')?.setData(ptFeature(last))
      map.easeTo({ center: [last.lng, last.lat], duration: 800 })
    }
  }, [points, routeGeometry])

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

function buildLineGeoJSON(points) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: points.map(p => [p.lng, p.lat]) },
  }
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
