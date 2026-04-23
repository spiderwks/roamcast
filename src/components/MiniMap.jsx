import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const MOMENT_COLORS = { photo: '#BA7517', video: '#1D9E75', audio: '#7F77DD' }

export default function MiniMap({ points = [], moments = [], className = '' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const center = points.length > 0
      ? [points[points.length - 1].lng, points[points.length - 1].lat]
      : [-98.5795, 39.8283]

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: points.length > 0 ? 14 : 3,
      interactive: false,
      attributionControl: false,
    })

    mapRef.current.on('load', () => {
      const map = mapRef.current

      // GPS path source
      map.addSource('path', {
        type: 'geojson',
        data: buildLineGeoJSON(points),
      })
      map.addLayer({
        id: 'path-line',
        type: 'line',
        source: 'path',
        paint: { 'line-color': '#1D9E75', 'line-width': 2 },
      })

      // Moment dots source
      map.addSource('moments', {
        type: 'geojson',
        data: buildMomentsGeoJSON(moments),
      })
      map.addLayer({
        id: 'moment-dots',
        type: 'circle',
        source: 'moments',
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#0f0f0f',
        },
      })

      // Current position dot
      if (points.length > 0) {
        const last = points[points.length - 1]
        map.addSource('position', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Point', coordinates: [last.lng, last.lat] } },
        })
        map.addLayer({
          id: 'position-dot',
          type: 'circle',
          source: 'position',
          paint: {
            'circle-radius': 6,
            'circle-color': '#1D9E75',
            'circle-opacity': 1,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        })
      }
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [])

  // Update path and position as new GPS points arrive
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || points.length === 0) return

    const pathSource = map.getSource('path')
    if (pathSource) pathSource.setData(buildLineGeoJSON(points))

    const last = points[points.length - 1]
    const posSource = map.getSource('position')
    if (posSource) {
      posSource.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [last.lng, last.lat] } })
    }
    map.easeTo({ center: [last.lng, last.lat], duration: 800 })
  }, [points])

  // Update moment dots
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource('moments')
    if (src) src.setData(buildMomentsGeoJSON(moments))
  }, [moments])

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-lg overflow-hidden border border-[#1e2e26] ${className}`}
      style={{ height: 110, background: '#141a17' }}
    />
  )
}

function buildLineGeoJSON(points) {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: points.map(p => [p.lng, p.lat]),
    },
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
        properties: { color: MOMENT_COLORS[m.type] || '#888' },
      })),
  }
}
