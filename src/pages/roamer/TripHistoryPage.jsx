import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

function formatDuration(secs) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(dateStr + 'T12:00:00'))
}

export default function TripHistoryPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [tripId])

  async function loadData() {
    setLoading(true)
    const [{ data: trip }, { data: daysData }] = await Promise.all([
      supabase.from('trips').select('name').eq('id', tripId).single(),
      supabase.from('days')
        .select('id, day_number, date, duration_seconds, distance_miles')
        .eq('trip_id', tripId)
        .eq('upload_status', 'complete')
        .order('day_number', { ascending: false }),
    ])

    if (trip) setTripName(trip.name)

    if (daysData?.length) {
      const dayIds = daysData.map(d => d.id)
      const { data: moments } = await supabase
        .from('moments')
        .select('day_id')
        .in('day_id', dayIds)
      const countMap = {}
      moments?.forEach(m => { countMap[m.day_id] = (countMap[m.day_id] || 0) + 1 })
      setDays(daysData.map(d => ({ ...d, moment_count: countMap[d.id] ?? 0 })))
    } else {
      setDays([])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full bg-surface-deep">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
          <ArrowLeft size={16} className="text-text-secondary" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-text-muted uppercase tracking-widest">Trip history</p>
          <h1 className="text-[15px] font-bold text-white truncate">{tripName}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-text-muted text-sm">Loading days…</p>
          </div>
        ) : days.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-text-muted text-sm">No completed days yet</p>
            <p className="text-text-disabled text-xs mt-1">Days appear here after upload</p>
          </div>
        ) : (
          <div className="space-y-2">
            {days.map(day => (
              <button
                key={day.id}
                onClick={() => navigate(`/trips/${tripId}/days/${day.id}`)}
                className="w-full bg-surface border border-border rounded-xl p-4 text-left active:opacity-70 transition-opacity"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[9px] font-medium text-brand-teal uppercase tracking-widest">Day {day.day_number}</span>
                    <p className="text-[13px] font-bold text-white mt-0.5">{formatDate(day.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center">
                      <Calendar size={14} className="text-brand-teal" />
                    </div>
                    <ChevronRight size={14} className="text-text-muted" />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[
                    { value: formatDuration(day.duration_seconds), label: 'Duration' },
                    { value: day.distance_miles ? `${parseFloat(day.distance_miles).toFixed(1)}` : '0.0', unit: 'mi', label: 'Distance' },
                    { value: day.moment_count, label: 'Moments' },
                  ].map(({ value, unit, label }) => (
                    <div key={label} className="flex-1 bg-surface-deep border border-[#222] rounded-sm px-2 py-1.5 text-center">
                      <div className="flex items-baseline justify-center gap-0.5">
                        <span className="text-[12px] font-bold text-white">{value}</span>
                        {unit && <span className="text-[9px] text-text-muted">{unit}</span>}
                      </div>
                      <p className="text-[9px] text-text-faint mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
