import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { getSessionGPSPoints, calcTotalDistance } from './useGPS'

export function useSession(tripId, userId) {
  const [session, setSession] = useState(null)   // { dayId, dayNumber, startTime }
  const [loading, setLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)       // seconds
  const [distanceMi, setDistanceMi] = useState(0)
  const [momentCount, setMomentCount] = useState(0)

  // Restore active session on mount
  useEffect(() => {
    if (!tripId || !userId) return
    restoreSession()
  }, [tripId, userId])

  // Session timer
  useEffect(() => {
    if (!session) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [session])

  // Live distance update every 30s
  useEffect(() => {
    if (!session) return
    updateDistance()
    const id = setInterval(updateDistance, 30_000)
    return () => clearInterval(id)
  }, [session])

  async function restoreSession() {
    setLoading(true)
    const { data } = await supabase
      .from('days')
      .select('*')
      .eq('trip_id', tripId)
      .eq('upload_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data?.session_start && !data?.session_end) {
      setSession({ dayId: data.id, dayNumber: data.day_number, startTime: new Date(data.session_start).getTime() })
      const count = await db.moments.where('dayId').equals(data.id).count()
      setMomentCount(count)
    }
    setLoading(false)
  }

  async function startSession() {
    const { data: existing } = await supabase
      .from('days')
      .select('day_number')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: false })
      .limit(1)
      .single()

    const dayNumber = (existing?.day_number ?? 0) + 1
    const now = new Date().toISOString()

    const { data: day, error } = await supabase
      .from('days')
      .insert({ trip_id: tripId, day_number: dayNumber, date: now.split('T')[0], session_start: now, upload_status: 'pending' })
      .select()
      .single()

    if (error) throw error
    setSession({ dayId: day.id, dayNumber, startTime: Date.now() })
    setElapsed(0)
    setMomentCount(0)
    return day
  }

  async function endSession() {
    if (!session) return
    await supabase
      .from('days')
      .update({ session_end: new Date().toISOString(), duration_seconds: elapsed, distance_miles: distanceMi })
      .eq('id', session.dayId)
    setSession(null)
    setElapsed(0)
  }

  async function updateDistance() {
    if (!session) return
    const points = await getSessionGPSPoints(session.dayId)
    setDistanceMi(parseFloat(calcTotalDistance(points).toFixed(2)))
  }

  const incrementMomentCount = useCallback(() => {
    setMomentCount(c => c + 1)
  }, [])

  function formatElapsed(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return { session, loading, elapsed, distanceMi, momentCount, startSession, endSession, incrementMomentCount, formatElapsed }
}
