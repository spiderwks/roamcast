import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Camera, MapPin, Users, Square, Plus } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../hooks/useSession'
import { useGPS, getSessionGPSPoints } from '../../hooks/useGPS'
import { db } from '../../lib/db'
import MiniMap from '../../components/MiniMap'

const MOMENT_COLORS = {
  photo: { border: 'border-moment-photo', bg: 'bg-[#1f1200]', text: 'text-moment-photo', label: 'Photo' },
  video: { border: 'border-moment-video', bg: 'bg-[#001a10]', text: 'text-moment-video', label: 'Video' },
  audio: { border: 'border-moment-audio', bg: 'bg-[#110d24]', text: 'text-moment-audio', label: 'Audio' },
}

export default function SessionPage() {
  const { tripId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { session, loading, elapsed, distanceMi, momentCount, startSession, endSession, formatElapsed } = useSession(tripId, user?.id)
  const [tripName, setTripName] = useState('')
  const [gpsPoints, setGpsPoints] = useState([])
  const [localMoments, setLocalMoments] = useState([])
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)

  useGPS({ dayId: session?.dayId, active: !!session })

  // Load trip name
  useEffect(() => {
    if (!tripId) return
    supabase.from('trips').select('name').eq('id', tripId).single().then(({ data }) => {
      if (data) setTripName(data.name)
    })
  }, [tripId])

  // Poll GPS points and moments every 15s
  useEffect(() => {
    if (!session) return
    loadMapData()
    const id = setInterval(loadMapData, 15_000)
    return () => clearInterval(id)
  }, [session])

  const loadMapData = useCallback(async () => {
    if (!session) return
    const points = await getSessionGPSPoints(session.dayId)
    setGpsPoints(points)
    const moments = await db.moments.where('dayId').equals(session.dayId).toArray()
    setLocalMoments(moments)
  }, [session])

  // Refresh moments when returning from capture
  useEffect(() => {
    if (!session) return
    loadMapData()
  }, [momentCount])

  async function handleStart() {
    setStarting(true)
    try { await startSession() }
    catch (e) { console.error(e) }
    finally { setStarting(false) }
  }

  async function handleEnd() {
    setEnding(true)
    try {
      await endSession()
      navigate(`/upload/${tripId}`)
    } catch (e) {
      console.error(e)
      setEnding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-deep">
        <p className="text-text-muted text-sm">Loading session…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-deep overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-medium text-brand-teal uppercase tracking-[0.8px]">
            {session ? 'Active session' : 'Ready to start'}
          </span>
          {session && (
            <span className="text-[10px] bg-brand-teal-deeper border border-brand-teal text-brand-teal px-2 py-0.5 rounded-full font-medium">
              Day {session.dayNumber}
            </span>
          )}
        </div>
        <p className="text-[14px] font-bold text-white truncate">{tripName}</p>
      </div>

      {/* Mini Map */}
      <div className="px-4 mb-4">
        <div className="relative">
          <MiniMap points={gpsPoints} moments={localMoments} className="h-[110px]" />
          {session && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-brand-teal-bg border border-brand-teal rounded-full px-2 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
              <span className="text-[9px] text-brand-teal font-medium">GPS tracking</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-4 mb-4">
        {[
          { value: distanceMi.toFixed(1), unit: 'mi', label: 'Distance' },
          { value: formatElapsed(elapsed), label: 'Duration' },
          { value: momentCount, label: 'Moments' },
        ].map(({ value, unit, label }) => (
          <div key={label} className="flex-1 bg-surface border border-border rounded-sm px-2 py-2 text-center">
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-[14px] font-bold text-white">{value}</span>
              {unit && <span className="text-[9px] text-text-muted">{unit}</span>}
            </div>
            <div className="text-[9px] text-text-faint mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Today's moments strip */}
      {session && (
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted">
              Today's moments
            </span>
            <div className="flex items-center gap-2">
              {Object.entries(MOMENT_COLORS).map(([type, c]) => (
                <div key={type} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${c.bg} border ${c.border}`} />
                  <span className="text-[9px] text-text-disabled">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {localMoments.length === 0 ? (
              <p className="text-[11px] text-text-disabled py-2">No moments yet — tap below to capture one</p>
            ) : (
              localMoments.map(m => {
                const c = MOMENT_COLORS[m.type] || MOMENT_COLORS.photo
                return (
                  <div key={m.id} className={`flex-shrink-0 w-14 h-14 rounded-lg border ${c.border} ${c.bg} flex flex-col items-center justify-center gap-1`}>
                    <span className={`text-[9px] font-medium ${c.text}`}>{c.label}</span>
                  </div>
                )
              })
            )}
            {localMoments.length > 0 && (
              <button
                onClick={() => session && navigate(`/capture/${tripId}/${session.dayId}`)}
                className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-brand-teal flex items-center justify-center"
              >
                <Plus size={16} className="text-brand-teal" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main CTA */}
      <div className="px-4 space-y-3 mt-auto pb-6">
        {!session ? (
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full bg-brand-teal rounded-xl py-4 flex items-center gap-3 px-5 disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full bg-brand-teal-dark flex items-center justify-center flex-shrink-0">
              <Camera size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-bold text-white">{starting ? 'Starting…' : "Start today's session"}</p>
              <p className="text-[10px] text-white/60">Photo · Video · Audio</p>
            </div>
          </button>
        ) : (
          <>
            <button
              onClick={() => navigate(`/capture/${tripId}/${session.dayId}`)}
              className="w-full bg-brand-teal rounded-xl py-4 flex items-center gap-3 px-5"
            >
              <div className="w-10 h-10 rounded-full bg-brand-teal-dark flex items-center justify-center flex-shrink-0">
                <Camera size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-bold text-white">Take a moment</p>
                <p className="text-[10px] text-white/60">Photo · Video · Audio</p>
              </div>
            </button>

            <div className="flex gap-2">
              <button className="flex-1 bg-surface border border-border rounded-md py-3 flex items-center justify-center gap-2">
                <MapPin size={14} className="text-text-muted" />
                <span className="text-[11px] font-bold text-[#888]">View map</span>
              </button>
              <button className="flex-1 bg-surface border border-border rounded-md py-3 flex items-center justify-center gap-2">
                <Users size={14} className="text-text-muted" />
                <span className="text-[11px] font-bold text-[#888]">Followers</span>
              </button>
            </div>

            <button
              onClick={handleEnd}
              disabled={ending}
              className="w-full bg-surface-elevated border border-[#2e2e2e] rounded-xl py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Square size={13} className="text-text-muted" />
              <span className="text-[12px] text-text-muted">{ending ? 'Ending session…' : 'End session & upload'}</span>
            </button>

            {/* Session timer */}
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
              <span className="text-[10px] text-text-muted">Session active · {formatElapsed(elapsed)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
