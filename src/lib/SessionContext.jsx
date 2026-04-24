import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { db } from './db'
import { getCurrentGPS, calcTotalDistance } from '../hooks/useGPS'

const Ctx = createContext(null)
const LS_KEY = 'roamcast_active_session'

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [distanceMi, setDistanceMi] = useState(0)
  const [momentCount, setMomentCount] = useState(0)

  // Session timer
  useEffect(() => {
    if (!session) return
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - session.startTime) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [session])

  // Distance recalculated from moment coordinates every 30s
  useEffect(() => {
    if (!session) return
    updateDistance()
    const id = setInterval(updateDistance, 30_000)
    return () => clearInterval(id)
  }, [session])

  async function updateDistance() {
    if (!session) return
    const moments = await db.moments.where('dayId').equals(session.dayId).sortBy('capturedAt')
    const pts = []
    if (session.startLat != null) pts.push({ lat: session.startLat, lng: session.startLng })
    moments.filter(m => m.lat && m.lng).forEach(m => pts.push({ lat: m.lat, lng: m.lng }))
    setDistanceMi(parseFloat(calcTotalDistance(pts).toFixed(2)))
  }

  async function loadSession(tripId, userId) {
    if (!tripId || !userId) return
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
      const s = { dayId: data.id, dayNumber: data.day_number, startTime: new Date(data.session_start).getTime(), tripId, startLat: data.start_lat ?? null, startLng: data.start_lng ?? null }
      persist(s)
      const count = await db.moments.where('dayId').equals(data.id).count()
      setMomentCount(count)
    } else {
      if (session?.tripId === tripId) clear()
    }
    setLoading(false)
  }

  async function startSession(tripId) {
    const { data: existing } = await supabase
      .from('days')
      .select('day_number')
      .eq('trip_id', tripId)
      .order('day_number', { ascending: false })
      .limit(1)
      .single()

    const dayNumber = (existing?.day_number ?? 0) + 1
    const now = new Date().toISOString()
    const coords = await getCurrentGPS()

    const { data: day, error } = await supabase
      .from('days')
      .insert({ trip_id: tripId, day_number: dayNumber, date: now.split('T')[0], session_start: now, upload_status: 'pending' })
      .select()
      .single()

    if (error) throw error

    persist({ dayId: day.id, dayNumber, startTime: Date.now(), tripId, startLat: coords?.lat ?? null, startLng: coords?.lng ?? null })
    setElapsed(0)
    setMomentCount(0)

    // Notify followers — fire and forget
    const { data: tripData } = await supabase.from('trips').select('name').eq('id', tripId).single()
    supabase.functions.invoke('notify-followers', {
      body: { tripId, event: 'start', dayNumber, tripName: tripData?.name ?? '' },
    }).catch(() => {})

    return day
  }

  async function endSession() {
    if (!session) return
    await supabase
      .from('days')
      .update({ session_end: new Date().toISOString(), duration_seconds: elapsed, distance_miles: distanceMi })
      .eq('id', session.dayId)

    // Notify followers — fire and forget
    const { data: tripData } = await supabase.from('trips').select('name').eq('id', session.tripId).single()
    supabase.functions.invoke('notify-followers', {
      body: { tripId: session.tripId, event: 'end', dayNumber: session.dayNumber, tripName: tripData?.name ?? '' },
    }).catch(() => {})

    clear()
  }

  function persist(s) {
    setSession(s)
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  }

  function clear() {
    setSession(null)
    localStorage.removeItem(LS_KEY)
    setElapsed(0)
    setDistanceMi(0)
    setMomentCount(0)
  }

  const incrementMomentCount = useCallback(() => setMomentCount(c => c + 1), [])

  function formatElapsed(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <Ctx.Provider value={{ session, loading, elapsed, distanceMi, momentCount, loadSession, startSession, endSession, incrementMomentCount, formatElapsed }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSessionCtx = () => useContext(Ctx)
