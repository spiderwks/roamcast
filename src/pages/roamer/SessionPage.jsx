import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Camera, MapPin, Users, Square, Plus, X } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { useSessionCtx } from '../../lib/SessionContext'
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
  const { session, loading, elapsed, distanceMi, momentCount, loadSession, startSession, endSession, formatElapsed } = useSessionCtx()
  const [tripName, setTripName] = useState('')
  const [localMoments, setLocalMoments] = useState([])
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [thumbnails, setThumbnails] = useState({})
  const [selectedMoment, setSelectedMoment] = useState(null)
  const [selectedMediaURL, setSelectedMediaURL] = useState(null)

  useEffect(() => {
    loadSession(tripId, user?.id)
  }, [tripId, user?.id])

  useEffect(() => {
    if (!tripId) return
    supabase.from('trips').select('name').eq('id', tripId).single().then(({ data }) => {
      if (data) setTripName(data.name)
    })
  }, [tripId])

  useEffect(() => {
    if (!session) return
    loadMapData()
    const id = setInterval(loadMapData, 15_000)
    return () => clearInterval(id)
  }, [session])

  const loadMapData = useCallback(async () => {
    if (!session) return
    const moments = await db.moments.where('dayId').equals(session.dayId).toArray()
    setLocalMoments(moments)
  }, [session])

  const pathPoints = useMemo(() => {
    const pts = []
    if (session?.startLat != null) pts.push({ lat: session.startLat, lng: session.startLng })
    ;[...localMoments]
      .filter(m => m.lat && m.lng)
      .sort((a, b) => a.capturedAt - b.capturedAt)
      .forEach(m => pts.push({ lat: m.lat, lng: m.lng }))
    return pts
  }, [session, localMoments])

  useEffect(() => {
    if (!session) return
    loadMapData()
  }, [momentCount])

  useEffect(() => {
    const prev = thumbnails
    let cancelled = false
    ;(async () => {
      const thumbs = {}
      for (const m of localMoments) {
        if (m.type === 'photo') {
          const rec = await db.mediaBlobs.where('momentId').equals(m.id).first()
          if (rec && !cancelled) thumbs[m.id] = URL.createObjectURL(rec.blob)
        }
      }
      if (!cancelled) setThumbnails(thumbs)
    })()
    return () => {
      cancelled = true
      Object.values(prev).forEach(url => URL.revokeObjectURL(url))
    }
  }, [localMoments])

  async function handleMomentDotClick(momentId) {
    const moment = localMoments.find(m => m.id === momentId)
    if (!moment) return
    setSelectedMoment(moment)
    const rec = await db.mediaBlobs.where('momentId').equals(momentId).first()
    if (rec) setSelectedMediaURL(URL.createObjectURL(rec.blob))
    else setSelectedMediaURL(null)
  }

  function closeSelectedMoment() {
    if (selectedMediaURL) URL.revokeObjectURL(selectedMediaURL)
    setSelectedMoment(null)
    setSelectedMediaURL(null)
  }

  async function handleStart() {
    setStarting(true)
    try { await startSession(tripId) }
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
          <MiniMap points={pathPoints} moments={localMoments} className="h-[110px]" />
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
                const thumb = thumbnails[m.id]
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMomentDotClick(m.id)}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg border ${c.border} overflow-hidden`}
                  >
                    {thumb ? (
                      <img src={thumb} alt={m.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full ${c.bg} flex flex-col items-center justify-center gap-1`}>
                        <span className={`text-[9px] font-medium ${c.text}`}>{c.label}</span>
                      </div>
                    )}
                  </button>
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
              <button
                onClick={() => setMapOpen(true)}
                className="flex-1 bg-surface border border-border rounded-md py-3 flex items-center justify-center gap-2"
              >
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

            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
              <span className="text-[10px] text-text-muted">
                Started {new Date(session.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} · {formatElapsed(elapsed)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Fullscreen map overlay */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 bg-surface-deep flex flex-col">
          <div className="flex items-center gap-3 px-4 pt-5 pb-3 flex-shrink-0">
            <button onClick={() => setMapOpen(false)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
              <X size={16} className="text-text-secondary" />
            </button>
            <h2 className="text-[15px] font-bold text-white flex-1">GPS Track</h2>
            {session && (
              <div className="flex items-center gap-1.5 bg-brand-teal-bg border border-brand-teal rounded-full px-2 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-teal animate-pulse" />
                <span className="text-[9px] text-brand-teal font-medium">Live</span>
              </div>
            )}
          </div>
          <div className="flex-1 px-4 pb-6">
            <MiniMap points={pathPoints} moments={localMoments} className="h-full" interactive onMomentClick={handleMomentDotClick} />
          </div>
        </div>
      )}

      {/* Moment detail modal */}
      {selectedMoment && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col justify-end">
          <div className="bg-surface-deep rounded-t-2xl overflow-hidden">
            {selectedMoment.type === 'photo' && selectedMediaURL && (
              <img src={selectedMediaURL} alt={selectedMoment.title} className="w-full object-cover max-h-[60vh]" />
            )}
            {selectedMoment.type === 'video' && selectedMediaURL && (
              <video src={selectedMediaURL} controls className="w-full max-h-[60vh]" />
            )}
            {selectedMoment.type === 'audio' && selectedMediaURL && (
              <div className="p-4 bg-[#110d24]">
                <audio src={selectedMediaURL} controls className="w-full" />
              </div>
            )}
            <div className="px-4 pt-3 pb-8">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[15px] font-bold text-white">{selectedMoment.title}</p>
                <button onClick={closeSelectedMoment} className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0">
                  <X size={14} className="text-text-secondary" />
                </button>
              </div>
              {selectedMoment.note && (
                <p className="text-[12px] text-text-muted leading-relaxed">{selectedMoment.note}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
