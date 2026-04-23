import { useEffect, useRef, useCallback } from 'react'
import { db } from '../lib/db'

const SAMPLE_INTERVAL_MS = 60_000
const ACCURACY_THRESHOLD_M = 50
const LOW_BATTERY_INTERVAL_MS = 300_000

export function useGPS({ dayId, active }) {
  const watchIdRef = useRef(null)
  const lastSampleRef = useRef(0)
  const intervalRef = useRef(SAMPLE_INTERVAL_MS)

  const storePoint = useCallback(async (position) => {
    if (!dayId || !active) return
    const { latitude: lat, longitude: lng, accuracy } = position.coords
    if (accuracy > ACCURACY_THRESHOLD_M) return
    await db.gpsPoints.add({
      dayId,
      lat,
      lng,
      accuracy,
      timestamp: Date.now(),
      uploaded: false,
    })
  }, [dayId, active])

  const handlePosition = useCallback((position) => {
    const now = Date.now()
    if (now - lastSampleRef.current < intervalRef.current) return
    lastSampleRef.current = now
    storePoint(position)
  }, [storePoint])

  useEffect(() => {
    if (!active || !dayId) return
    if (!navigator.geolocation) return

    // Force capture first point immediately
    navigator.geolocation.getCurrentPosition(storePoint, () => {}, {
      enableHighAccuracy: true,
      timeout: 10_000,
    })

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => console.warn('GPS error:', err.message),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    )

    // Reduce sample rate on low battery
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        if (battery.level < 0.2) intervalRef.current = LOW_BATTERY_INTERVAL_MS
        battery.addEventListener('levelchange', () => {
          intervalRef.current = battery.level < 0.2 ? LOW_BATTERY_INTERVAL_MS : SAMPLE_INTERVAL_MS
        })
      })
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [active, dayId, handlePosition, storePoint])
}

// Haversine distance in miles between two {lat,lng} points
export function distanceMiles(a, b) {
  const R = 3958.8
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const c = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c))
}

export async function getSessionGPSPoints(dayId) {
  return db.gpsPoints.where('dayId').equals(dayId).sortBy('timestamp')
}

export function calcTotalDistance(points) {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distanceMiles(points[i - 1], points[i])
  return total
}
