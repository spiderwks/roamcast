import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Mountain, Footprints, Bike, Waves, Ship, Car, Play, CheckCircle } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

const ADVENTURE_ICONS = {
  hiking: Mountain, walking: Footprints, cycling: Bike,
  water: Waves, cruise: Ship, driving: Car,
}

export default function TripsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('trips')
      .select('*')
      .eq('roamer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTrips(data ?? [])
        setLoading(false)
      })
  }, [user])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <p className="text-[19px] font-bold text-white">Your trips</p>
        <button
          onClick={() => navigate('/trips/new')}
          className="flex items-center gap-1.5 bg-brand-teal text-white text-[11px] font-bold px-3 py-1.5 rounded-full"
        >
          <Plus size={12} />
          New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-text-muted text-sm">Loading…</p>
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-text-muted text-sm mb-1">No trips yet</p>
            <p className="text-text-disabled text-xs mb-6">Create your first adventure</p>
            <button
              onClick={() => navigate('/trips/new')}
              className="flex items-center gap-2 bg-brand-teal text-white text-[13px] font-bold px-4 py-2.5 rounded-xl"
            >
              <Plus size={14} />
              New trip
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {trips.map(trip => {
              const Icon = ADVENTURE_ICONS[trip.adventure_type] || Mountain
              const isActive = trip.status === 'active'
              return (
                <button
                  key={trip.id}
                  onClick={() => navigate(isActive ? `/session/${trip.id}` : `/trips/${trip.id}/history`)}
                  className="w-full bg-surface border border-border rounded-xl p-4 flex items-center gap-3 text-left active:opacity-70 transition-opacity"
                >
                  <div className="bg-surface-elevated border border-border rounded-lg p-2.5 flex-shrink-0">
                    <Icon size={18} className="text-brand-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{trip.name}</p>
                    {trip.start_date && (
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {new Date(trip.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 flex-shrink-0 ${
                    isActive
                      ? 'bg-brand-teal-bg border border-brand-teal'
                      : 'bg-surface-deep border border-border'
                  }`}>
                    {isActive
                      ? <Play size={9} className="text-brand-teal" fill="currentColor" />
                      : <CheckCircle size={9} className="text-text-muted" />
                    }
                    <span className={`text-[9px] font-medium ${isActive ? 'text-brand-teal' : 'text-text-muted'}`}>
                      {isActive ? 'Active' : 'Complete'}
                    </span>
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
