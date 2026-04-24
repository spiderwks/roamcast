import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Camera, Video, Mic, RefreshCw, Mountain, Footprints, Bike, Waves, Ship, Car } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import MiniMap from '../../components/MiniMap'
import Logo from '../../components/Logo'

const ADVENTURE_ICONS = {
  hiking: Mountain, walking: Footprints, cycling: Bike,
  water: Waves, cruise: Ship, driving: Car,
}

const MOMENT_COLORS = {
  photo: { border: 'border-moment-photo', bg: 'bg-[#1f1200]', text: 'text-moment-photo', label: 'Photo' },
  video: { border: 'border-moment-video', bg: 'bg-[#001a10]', text: 'text-moment-video', label: 'Video' },
  audio: { border: 'border-moment-audio', bg: 'bg-[#110d24]', text: 'text-moment-audio', label: 'Audio' },
}
const TYPE_ICONS = { photo: Camera, video: Video, audio: Mic }

async function getSignedUrl(path) {
  if (!path) return null
  const { data } = await supabase.storage.from('media').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date(dateStr + 'T12:00:00'))
}

function formatDuration(secs) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function FollowerDashboard() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [day, setDay] = useState(null)
  const [liveDay, setLiveDay] = useState(null)
  const [moments, setMoments] = useState([])
  const [pathPoints, setPathPoints] = useState([])
  const [signedUrls, setSignedUrls] = useState({})
  const [selectedMoment, setSelectedMoment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noAccess, setNoAccess] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate(`/follow/${tripId}`, { replace: true })
      else loadData()
    })
  }, [tripId])

  // Auto-refresh every 60s when there's a live session
  useEffect(() => {
    if (!liveDay) return
    const id = setInterval(loadData, 60_000)
    return () => clearInterval(id)
  }, [liveDay])

  // Generate signed URLs whenever moments change
  useEffect(() => {
    if (!moments.length) return
    ;(async () => {
      const urls = {}
      await Promise.all(
        moments.filter(m => m.media_url).map(async m => {
          const url = await getSignedUrl(m.media_url)
          if (url) urls[m.id] = url
        })
      )
      setSignedUrls(urls)
    })()
  }, [moments])

  async function loadData() {
    setRefreshing(true)
    const [{ data: tripData }, { data: liveDayData }, { data: completedDays }] = await Promise.all([
      supabase.from('trips').select('id, name, adventure_type').eq('id', tripId).single(),
      supabase.from('days')
        .select('id, day_number, date, session_start')
        .eq('trip_id', tripId)
        .not('session_start', 'is', null)
        .is('session_end', null)
        .maybeSingle(),
      supabase.from('days')
        .select('*')
        .eq('trip_id', tripId)
        .eq('upload_status', 'complete')
        .order('day_number', { ascending: false })
        .limit(1),
    ])

    if (!tripData) {
      setNoAccess(true)
      setLoading(false)
      setRefreshing(false)
      return
    }

    setTrip(tripData)
    setLiveDay(liveDayData)
    const viewDay = completedDays?.[0] ?? null
    setDay(viewDay)

    if (viewDay) {
      const [{ data: momentsData }, { data: trackData }] = await Promise.all([
        supabase.from('moments').select('*').eq('day_id', viewDay.id).order('captured_at', { ascending: true }),
        supabase.from('gps_tracks').select('points').eq('day_id', viewDay.id).maybeSingle(),
      ])
      const moms = momentsData ?? []
      setMoments(moms)
      const pts = trackData?.points?.length
        ? trackData.points
        : moms.filter(m => m.lat && m.lng).map(m => ({ lat: m.lat, lng: m.lng }))
      setPathPoints(pts)
    }

    setLastRefresh(new Date())
    setLoading(false)
    setRefreshing(false)
  }

  const selectedMediaUrl = selectedMoment ? signedUrls[selectedMoment.id] ?? null : null
  const AdventureIcon = ADVENTURE_ICONS[trip?.adventure_type] || Mountain

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-deep">
        <p className="text-text-muted text-sm">Loading…</p>
      </div>
    )
  }

  if (noAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-surface-deep px-6 text-center">
        <Logo />
        <p className="text-white font-bold text-[16px] mt-8 mb-2">Access required</p>
        <p className="text-text-muted text-[13px] mb-6">You need an invite link from the traveller to view this trip.</p>
        <button
          onClick={() => navigate(`/follow/${tripId}`, { replace: true })}
          className="text-[12px] text-brand-teal"
        >
          ← Back
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-deep overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <Logo />
        <button
          onClick={loadData}
          className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <RefreshCw size={13} className={`text-text-muted ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Trip title */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <AdventureIcon size={12} className="text-brand-teal" />
          {liveDay && (
            <span className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] text-red-400 font-medium uppercase tracking-wide">Live</span>
            </span>
          )}
        </div>
        <h1 className="text-[22px] font-bold text-white">{trip?.name}</h1>
      </div>

      {/* Live session banner */}
      {liveDay && (
        <div className="px-4 mb-4">
          <div className="bg-surface border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-[12px] font-bold text-white">Day {liveDay.day_number} in progress</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              Started {formatTime(liveDay.session_start)} · Moments appear after the session ends
            </p>
          </div>
        </div>
      )}

      {day ? (
        <>
          {/* Day label */}
          <div className="px-4 mb-3">
            <p className="text-[9px] font-medium text-brand-teal uppercase tracking-widest">
              {liveDay ? 'Last completed day' : `Day ${day.day_number}`}
            </p>
            <p className="text-[14px] font-bold text-white">{formatDate(day.date)}</p>
            {day.session_start && (
              <p className="text-[10px] text-text-muted mt-0.5">
                {formatTime(day.session_start)}{day.session_end ? ` – ${formatTime(day.session_end)}` : ''}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-2 px-4 mb-4">
            {[
              { value: formatDuration(day.duration_seconds), label: 'Duration' },
              { value: day.distance_miles ? parseFloat(day.distance_miles).toFixed(1) : '0.0', unit: 'mi', label: 'Distance' },
              { value: moments.length, label: 'Moments' },
            ].map(({ value, unit, label }) => (
              <div key={label} className="flex-1 bg-surface border border-border rounded-sm px-2 py-2 text-center">
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-[13px] font-bold text-white">{value}</span>
                  {unit && <span className="text-[9px] text-text-muted">{unit}</span>}
                </div>
                <div className="text-[9px] text-text-faint mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* Map */}
          {pathPoints.length > 0 && (
            <div className="px-4 mb-4">
              <MiniMap
                points={pathPoints}
                moments={moments}
                className="h-[160px]"
                showStartStop
              />
            </div>
          )}

          {/* Moments grid */}
          <div className="px-4 pb-10">
            <p className="text-[10px] font-medium uppercase tracking-widest text-text-muted mb-3">
              Moments · {moments.length}
            </p>
            {moments.length === 0 ? (
              <p className="text-[11px] text-text-disabled py-4">No moments for this day</p>
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
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-text-muted text-sm mb-1">No days uploaded yet</p>
          <p className="text-text-disabled text-xs">Check back after the first session ends</p>
        </div>
      )}

      {/* Last refresh timestamp */}
      {lastRefresh && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[9px] text-text-disabled bg-surface-deep/90 px-2.5 py-1 rounded-full border border-[#1e1e1e]">
            Updated {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
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
                <p className="text-text-disabled text-xs">No media</p>
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
                <button
                  onClick={() => setSelectedMoment(null)}
                  className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0"
                >
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
