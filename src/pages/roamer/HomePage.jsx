import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Mountain, Footprints, Bike, Waves, Ship, Car, Play, CheckCircle } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'
import Avatar from '../../components/Avatar'

const ADVENTURE_ICONS = { hiking: Mountain, walking: Footprints, cycling: Bike, water: Waves, cruise: Ship, driving: Car }

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
}

function StatCard({ value, unit, label }) {
  return (
    <div className="flex-1 bg-surface-deep border border-[#222] rounded-sm px-2 py-2 text-center">
      <div className="flex items-baseline justify-center gap-0.5">
        <span className="text-[14px] font-bold text-white">{value}</span>
        {unit && <span className="text-[9px] text-text-muted">{unit}</span>}
      </div>
      <div className="text-[9px] text-text-faint mt-0.5">{label}</div>
    </div>
  )
}

function ActiveTripCard({ trip, onStartSession }) {
  const AdventureIcon = ADVENTURE_ICONS[trip.adventure_type] || Mountain
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[9px] font-medium text-brand-teal uppercase tracking-[0.8px] mb-0.5">Active trip</p>
          <p className="text-[14px] font-bold text-white">{trip.name}</p>
          <p className="text-[10px] text-text-muted mt-0.5">Day {trip.day_count ?? 0} · {trip.follower_count ?? 0} follower{trip.follower_count !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-surface-elevated border border-border rounded-md p-2">
          <AdventureIcon size={18} className="text-brand-teal" />
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <StatCard value={trip.day_count ?? 0} label="Days logged" />
        <StatCard value={trip.moment_count ?? 0} label="Moments" />
        <StatCard value={trip.total_miles ?? '0.0'} unit="mi" label="Miles" />
      </div>
      <button onClick={() => onStartSession(trip.id)} className="w-full bg-brand-teal rounded-sm py-3 flex items-center gap-3 px-4">
        <div className="w-8 h-8 rounded-full bg-brand-teal-dark flex items-center justify-center flex-shrink-0">
          <Play size={14} className="text-white" fill="white" />
        </div>
        <span className="text-[15px] font-bold text-white">Start today's session</span>
      </button>
    </div>
  )
}

function PastTripCard({ trip }) {
  const AdventureIcon = ADVENTURE_ICONS[trip.adventure_type] || Mountain
  return (
    <div className="bg-surface border border-border rounded-lg p-3 flex items-center gap-3">
      <div className="bg-surface-elevated border border-border rounded-md p-2 flex-shrink-0">
        <AdventureIcon size={16} className="text-brand-teal" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-white truncate">{trip.name}</p>
        <p className="text-[10px] text-text-muted">{trip.day_count ?? 0} days · {trip.moment_count ?? 0} moments</p>
      </div>
      <div className="flex items-center gap-1 bg-surface-deep border border-border rounded-full px-2 py-0.5">
        <CheckCircle size={10} className="text-text-muted" />
        <span className="text-[9px] text-text-muted font-medium">Complete</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState({ active: null, past: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!user) return; loadTrips() }, [user])

  async function loadTrips() {
    setLoading(true)
    const { data, error } = await supabase.from('trips').select('*, days(count), followers(count)').eq('roamer_id', user.id).order('created_at', { ascending: false })
    if (!error && data) {
      const enriched = data.map(t => ({ ...t, day_count: t.days?.[0]?.count ?? 0, follower_count: t.followers?.[0]?.count ?? 0, moment_count: 0, total_miles: '0.0' }))
      setTrips({ active: enriched.find(t => t.status === 'active') ?? null, past: enriched.filter(t => t.status === 'complete') })
    }
    setLoading(false)
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Roamer'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <Logo /><Avatar name={displayName} size={32} />
      </div>
      <div className="px-4 mb-4">
        <p className="text-[10px] text-text-muted">{formatDate(new Date())}</p>
        <p className="text-[19px] font-bold text-white mt-0.5">Your adventures</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12"><p className="text-text-muted text-sm">Loading your trips…</p></div>
        ) : (
          <>
            {trips.active ? (
              <ActiveTripCard trip={trips.active} onStartSession={(id) => navigate(`/session/${id}`)} />
            ) : (
              <div className="bg-surface border border-border rounded-xl p-6 text-center">
                <p className="text-text-muted text-sm mb-1">No active trip</p>
                <p className="text-text-disabled text-xs">Create a trip to get started</p>
              </div>
            )}
            {trips.past.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-white uppercase tracking-wide">Past trips</p>
                  <button className="text-[10px] text-brand-teal">See all</button>
                </div>
                <div className="space-y-2">{trips.past.map(trip => <PastTripCard key={trip.id} trip={trip} />)}</div>
              </div>
            )}
            <button onClick={() => navigate('/trips/new')} className="w-full border border-dashed border-[#2e2e2e] rounded-xl py-4 flex items-center justify-center gap-2">
              <div className="w-5 h-5 rounded-full bg-brand-teal-deeper flex items-center justify-center"><Plus size={12} className="text-brand-teal" /></div>
              <span className="text-[13px] text-text-faint">New trip</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
