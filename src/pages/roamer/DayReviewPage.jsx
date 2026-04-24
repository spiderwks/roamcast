import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, X, Camera, Video, Mic } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import MiniMap from '../../components/MiniMap'

const MOMENT_COLORS = {
  photo: { border: 'border-moment-photo', bg: 'bg-[#1f1200]', text: 'text-moment-photo', label: 'Photo' },
  video: { border: 'border-moment-video', bg: 'bg-[#001a10]', text: 'text-moment-video', label: 'Video' },
  audio: { border: 'border-moment-audio', bg: 'bg-[#110d24]', text: 'text-moment-audio', label: 'Audio' },
}
const TYPE_ICONS = { photo: Camera, video: Video, audio: Mic }

function formatDuration(secs) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(dateStr + 'T12:00:00'))
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

async function getSignedUrl(path) {
  if (!path) return null
  const { data } = await supabase.storage.from('media').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

async function fetchSnappedRoute(pts) {
  if (pts.length < 2) return null
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    const coords = pts.slice(0, 25).map(p => `${p.lng},${p.lat}`).join(';')
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=${token}`
    )
    const data = await res.json()
    return data.routes?.[0]?.geometry ?? null
  } catch {
    return null
  }
}

export default function DayReviewPage() {
  const { tripId, dayId } = useParams()
  const navigate = useNavigate()
  const [day, setDay] = useState(null)
  const [moments, setMoments] = useState([])
  const [pathPoints, setPathPoints] = useState([])
  const [snappedRoute, setSnappedRoute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedMoment, setSelectedMoment] = useState(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [signedUrls, setSignedUrls] = useState({})

  useEffect(() => { loadData() }, [dayId])

  useEffect(() => {
    if (!moments.length) return
    ;(async () => {
      const urls = {}
      await Promise.all(
        moments
          .filter(m => m.media_url)
          .map(async m => {
            const url = await getSignedUrl(m.media_url)
            if (url) urls[m.id] = url
          })
      )
      setSignedUrls(urls)
    })()
  }, [moments])

  async function loadData() {
    setLoading(true)
    const [{ data: dayData }, { data: momentsData }, { data: trackData }] = await Promise.all([
      supabase.from('days')
        .select('id, day_number, date, duration_seconds, distance_miles, session_start, session_end')
        .eq('id', dayId).single(),
      supabase.from('moments').select('*').eq('day_id', dayId).order('captured_at', { ascending: true }),
      supabase.from('gps_tracks').select('points').eq('day_id', dayId).maybeSingle(),
    ])

    if (dayData) setDay(dayData)
    const moms = momentsData ?? []
    setMoments(moms)

    const pts = trackData?.points?.length
      ? trackData.points
      : moms.filter(m => m.lat && m.lng).map(m => ({ lat: m.lat, lng: m.lng }))
    setPathPoints(pts)
    setLoading(false)

    // Fetch road-snapped route in background — falls back to straight lines on error
    const route = await fetchSnappedRoute(pts)
    if (route) setSnappedRoute(route)
  }

  function handleMomentDotClick(momentId) {
    const m = moments.find(m => m.id === momentId)
    if (m) setSelectedMoment(m)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-deep">
        <p className="text-text-muted text-sm">Loading day…</p>
      </div>
    )
  }

  const selectedMediaUrl = selectedMoment ? signedUrls[selectedMoment.id] ?? null : null

  return (
    <div className="flex flex-col h-full bg-surface-deep overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
          <ArrowLeft size={16} className="text-text-secondary" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-medium text-brand-teal uppercase tracking-widest">Day {day?.day_number}</p>
          <h1 className="text-[15px] font-bold text-white">{formatDate(day?.date)}</h1>
          {(day?.session_start) && (
            <p className="text-[10px] text-text-muted mt-0.5">
              {formatTime(day.session_start)}{day.session_end ? ` – ${formatTime(day.session_end)}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-2 px-4 mb-4">
        {[
          { value: formatDuration(day?.duration_seconds), label: 'Duration' },
          { value: day?.distance_miles ? parseFloat(day.distance_miles).toFixed(1) : '0.0', unit: 'mi', label: 'Distance' },
          { value: moments.length, label: 'Moments' },
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

      {/* Map — legend */}
      <div className="px-4 mb-1 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-brand-teal border-2 border-white" />
          <span className="text-[9px] text-text-muted">Start</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
          <span className="text-[9px] text-text-muted">End</span>
        </div>
        {!snappedRoute && pathPoints.length > 1 && (
          <span className="text-[9px] text-text-disabled ml-auto">Snapping to roads…</span>
        )}
      </div>

      {/* Map */}
      <div className="px-4 mb-4">
        <div className="relative">
          <MiniMap
            points={pathPoints}
            moments={moments}
            className="h-[160px]"
            onMomentClick={handleMomentDotClick}
            routeGeometry={snappedRoute}
            showStartStop
          />
          <button
            onClick={() => setMapOpen(true)}
            className="absolute bottom-2 right-2 bg-surface-deep/80 border border-border rounded-full px-2.5 py-1"
          >
            <span className="text-[9px] text-text-muted font-medium">Expand</span>
          </button>
        </div>
      </div>

      {/* Moments grid */}
      <div className="px-4 pb-10">
        <p className="text-[10px] font-medium uppercase tracking-widest text-text-muted mb-3">
          Moments · {moments.length}
        </p>
        {moments.length === 0 ? (
          <p className="text-[11px] text-text-disabled py-4">No moments captured this day</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {moments.map(m => {
              const c = MOMENT_COLORS[m.type] || MOMENT_COLORS.photo
              const Icon = TYPE_ICONS[m.type] || Camera
              const mediaUrl = m.type === 'photo' ? signedUrls[m.id] ?? null : null
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMoment(m)}
                  className={`aspect-square rounded-lg border ${c.border} overflow-hidden relative active:opacity-70 transition-opacity`}
                >
                  {mediaUrl ? (
                    <img src={mediaUrl} alt={m.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full ${c.bg} flex flex-col items-center justify-center gap-1`}>
                      <Icon size={18} className={c.text} />
                      <span className={`text-[8px] font-medium ${c.text}`}>{c.label}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
                    <p className="text-[8px] text-white truncate leading-tight">{m.title}</p>
                    <p className="text-[7px] text-white/60">{formatTime(m.captured_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Fullscreen map overlay */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 bg-surface-deep flex flex-col">
          <div className="flex items-center gap-3 px-4 pt-5 pb-2 flex-shrink-0">
            <button onClick={() => setMapOpen(false)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
              <X size={16} className="text-text-secondary" />
            </button>
            <h2 className="text-[15px] font-bold text-white flex-1">Day {day?.day_number} · GPS Track</h2>
          </div>
          <div className="flex items-center gap-3 px-4 pb-2 flex-shrink-0">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-brand-teal border-2 border-white" />
              <span className="text-[9px] text-text-muted">Start</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
              <span className="text-[9px] text-text-muted">End</span>
            </div>
          </div>
          <div className="flex-1 px-4 pb-6">
            <MiniMap
              points={pathPoints}
              moments={moments}
              className="h-full"
              interactive
              onMomentClick={handleMomentDotClick}
              routeGeometry={snappedRoute}
              showStartStop
            />
          </div>
        </div>
      )}

      {/* Moment detail modal */}
      {selectedMoment && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col justify-end">
          <div className="bg-surface-deep rounded-t-2xl overflow-hidden">
            {selectedMoment.type === 'photo' && selectedMediaUrl && (
              <img src={selectedMediaUrl} alt={selectedMoment.title} className="w-full object-cover max-h-[60vh]" />
            )}
            {selectedMoment.type === 'video' && selectedMediaUrl && (
              <video src={selectedMediaUrl} controls className="w-full max-h-[60vh]" />
            )}
            {selectedMoment.type === 'audio' && selectedMediaUrl && (
              <div className="p-4 bg-[#110d24]">
                <audio src={selectedMediaUrl} controls className="w-full" />
              </div>
            )}
            {!selectedMediaUrl && (
              <div className="h-20 flex items-center justify-center bg-surface">
                <p className="text-text-disabled text-xs">No media available</p>
              </div>
            )}
            <div className="px-4 pt-3 pb-8">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <p className="text-[15px] font-bold text-white">{selectedMoment.title}</p>
                  <p className="text-[10px] text-text-muted capitalize mt-0.5">
                    {selectedMoment.type} · {formatTime(selectedMoment.captured_at)}
                  </p>
                </div>
                <button onClick={() => setSelectedMoment(null)} className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0">
                  <X size={14} className="text-text-secondary" />
                </button>
              </div>
              {selectedMoment.note && (
                <p className="text-[12px] text-text-muted leading-relaxed mt-2">{selectedMoment.note}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
