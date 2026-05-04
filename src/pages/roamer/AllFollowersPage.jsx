import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mountain, Footprints, Bike, Waves, Ship, Car, Users, ChevronRight } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

const ADVENTURE_ICONS = {
  hiking: Mountain, walking: Footprints, cycling: Bike,
  water: Waves, cruise: Ship, driving: Car,
}

export default function AllFollowersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data: tripsData } = await supabase
        .from('trips')
        .select('id, name, adventure_type, status')
        .eq('roamer_id', user.id)
        .order('created_at', { ascending: false })

      if (!tripsData?.length) { setLoading(false); return }

      const counts = await Promise.all(
        tripsData.map(t =>
          supabase.from('followers').select('id, accepted_at', { count: 'exact' }).eq('trip_id', t.id)
        )
      )

      setTrips(tripsData.map((t, i) => ({
        ...t,
        followerCount: counts[i].count ?? 0,
        acceptedCount: (counts[i].data ?? []).filter(f => f.accepted_at).length,
      })))
      setLoading(false)
    }
    load()
  }, [user])

  return (
    <div className="flex flex-col h-full bg-surface-deep">
      <div className="px-4 pt-5 pb-4">
        <Logo />
        <h1 className="text-[18px] font-bold text-white mt-4">Followers</h1>
        <p className="text-[12px] text-text-muted mt-0.5">Manage followers per trip</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading ? (
          <p className="text-text-muted text-sm py-6">Loading…</p>
        ) : trips.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-text-muted" />
            </div>
            <p className="text-text-muted text-sm font-medium">No trips yet</p>
            <p className="text-text-disabled text-xs mt-1">Create a trip to start inviting followers</p>
          </div>
        ) : (
          <div className="space-y-2">
            {trips.map(trip => {
              const Icon = ADVENTURE_ICONS[trip.adventure_type] || Mountain
              const pending = trip.followerCount - trip.acceptedCount
              return (
                <button
                  key={trip.id}
                  onClick={() => navigate(`/trips/${trip.id}/followers`)}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3.5 flex items-center gap-3 active:opacity-70 transition-opacity"
                >
                  <div className="w-9 h-9 rounded-full bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-brand-teal" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-bold text-white truncate">{trip.name}</p>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      {trip.followerCount === 0
                        ? 'No followers yet'
                        : `${trip.acceptedCount} accepted${pending > 0 ? ` · ${pending} pending` : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {trip.followerCount > 0 && (
                      <span className="text-[11px] font-bold text-brand-teal">{trip.followerCount}</span>
                    )}
                    <ChevronRight size={15} className="text-text-muted" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
