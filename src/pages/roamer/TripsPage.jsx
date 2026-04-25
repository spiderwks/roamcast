import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Mountain, Footprints, Bike, Waves, Ship, Car, Play, CheckCircle, MoreVertical, X, Trash2, Pencil } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

const ADVENTURE_ICONS = {
  hiking: Mountain, walking: Footprints, cycling: Bike,
  water: Waves, cruise: Ship, driving: Car,
}

const ADVENTURE_TYPES = [
  { id: 'hiking', label: 'Hiking', Icon: Mountain },
  { id: 'walking', label: 'Walking', Icon: Footprints },
  { id: 'cycling', label: 'Cycling', Icon: Bike },
  { id: 'water', label: 'Water', Icon: Waves },
  { id: 'cruise', label: 'Cruise', Icon: Ship },
  { id: 'driving', label: 'Driving', Icon: Car },
]

export default function TripsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuTrip, setMenuTrip] = useState(null)       // trip whose action sheet is open
  const [editTrip, setEditTrip] = useState(null)       // trip being edited (form state)
  const [deleteTrip, setDeleteTrip] = useState(null)   // trip pending delete confirmation
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) return
    loadTrips()
  }, [user])

  async function loadTrips() {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('roamer_id', user.id)
      .order('created_at', { ascending: false })
    setTrips(data ?? [])
    setLoading(false)
  }

  function openMenu(e, trip) {
    e.stopPropagation()
    setMenuTrip(trip)
  }

  function openEdit(trip) {
    setMenuTrip(null)
    setEditTrip({
      id: trip.id,
      name: trip.name ?? '',
      description: trip.description ?? '',
      adventure_type: trip.adventure_type ?? 'hiking',
      start_date: trip.start_date ?? '',
      end_date: trip.end_date ?? '',
      status: trip.status ?? 'active',
    })
  }

  function openDelete(trip) {
    setMenuTrip(null)
    setDeleteTrip(trip)
  }

  async function handleSaveEdit() {
    if (!editTrip?.name?.trim()) return
    setSaving(true)
    const { error } = await supabase.from('trips').update({
      name: editTrip.name.trim(),
      description: editTrip.description.trim() || null,
      adventure_type: editTrip.adventure_type,
      start_date: editTrip.start_date || null,
      end_date: editTrip.end_date || null,
      status: editTrip.status,
    }).eq('id', editTrip.id)

    if (!error) {
      await loadTrips()
      setEditTrip(null)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteTrip) return
    setDeleting(true)
    await supabase.from('trips').delete().eq('id', deleteTrip.id)
    await loadTrips()
    setDeleteTrip(null)
    setDeleting(false)
  }

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
                <div key={trip.id} className="relative">
                  <button
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
                      isActive ? 'bg-brand-teal-bg border border-brand-teal' : 'bg-surface-deep border border-border'
                    }`}>
                      {isActive
                        ? <Play size={9} className="text-brand-teal" fill="currentColor" />
                        : <CheckCircle size={9} className="text-text-muted" />}
                      <span className={`text-[9px] font-medium ${isActive ? 'text-brand-teal' : 'text-text-muted'}`}>
                        {isActive ? 'Active' : 'Complete'}
                      </span>
                    </div>
                    {/* Spacer for three-dot button */}
                    <div className="w-7 flex-shrink-0" />
                  </button>
                  {/* Three-dot button overlaid on the right */}
                  <button
                    onClick={e => openMenu(e, trip)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-elevated transition-colors"
                  >
                    <MoreVertical size={15} className="text-text-muted" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Action sheet ─────────────────────────────────────────── */}
      {menuTrip && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" onClick={() => setMenuTrip(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-surface-deep rounded-t-2xl pb-10" onClick={e => e.stopPropagation()}>
            <div className="px-4 pt-5 pb-3 border-b border-border">
              <p className="text-[15px] font-bold text-white truncate">{menuTrip.name}</p>
              <p className="text-[11px] text-text-muted capitalize">{menuTrip.adventure_type}</p>
            </div>
            <div className="px-4 pt-3 space-y-1">
              <button
                onClick={() => openEdit(menuTrip)}
                className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl bg-surface border border-border text-left"
              >
                <Pencil size={16} className="text-brand-teal flex-shrink-0" />
                <span className="text-[13px] font-medium text-white">Edit trip</span>
              </button>
              <button
                onClick={() => openDelete(menuTrip)}
                className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl bg-surface border border-border text-left"
              >
                <Trash2 size={16} className="text-red-400 flex-shrink-0" />
                <span className="text-[13px] font-medium text-red-400">Delete trip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit bottom sheet ─────────────────────────────────────── */}
      {editTrip && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditTrip(null)} />
          <div className="relative bg-surface-deep rounded-t-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-border flex-shrink-0">
              <h2 className="text-[16px] font-bold text-white">Edit trip</h2>
              <button onClick={() => setEditTrip(null)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
                <X size={15} className="text-text-secondary" />
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white mb-1.5">Trip name <span className="text-brand-teal">*</span></label>
                <input
                  type="text"
                  value={editTrip.name}
                  onChange={e => setEditTrip(t => ({ ...t, name: e.target.value }))}
                  maxLength={100}
                  className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors"
                  placeholder="Trip name"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white mb-1.5">Description</label>
                <textarea
                  value={editTrip.description}
                  onChange={e => setEditTrip(t => ({ ...t, description: e.target.value }))}
                  maxLength={200}
                  rows={3}
                  className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors resize-none"
                  placeholder="What's this adventure about?"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white mb-2">Adventure type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ADVENTURE_TYPES.map(({ id, label, Icon }) => {
                    const selected = editTrip.adventure_type === id
                    return (
                      <button
                        key={id}
                        onClick={() => setEditTrip(t => ({ ...t, adventure_type: id }))}
                        className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg border transition-colors ${selected ? 'border-brand-teal bg-brand-teal-deeper' : 'border-border bg-surface'}`}
                      >
                        <Icon size={16} className={selected ? 'text-brand-teal' : 'text-text-muted'} />
                        <span className={`text-[10px] font-medium ${selected ? 'text-brand-teal' : 'text-text-muted'}`}>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white mb-1.5">Start date</label>
                  <input type="date" value={editTrip.start_date} onChange={e => setEditTrip(t => ({ ...t, start_date: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-sm px-3 py-2.5 text-[12px] text-white focus:border-brand-teal transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white mb-1.5">End date</label>
                  <input type="date" value={editTrip.end_date} onChange={e => setEditTrip(t => ({ ...t, end_date: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-sm px-3 py-2.5 text-[12px] text-white focus:border-brand-teal transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white mb-2">Status</label>
                <div className="flex gap-2">
                  {['active', 'complete'].map(s => (
                    <button
                      key={s}
                      onClick={() => setEditTrip(t => ({ ...t, status: s }))}
                      className={`flex-1 py-2.5 rounded-lg border text-[12px] font-medium capitalize transition-colors ${
                        editTrip.status === s ? 'border-brand-teal bg-brand-teal-deeper text-brand-teal' : 'border-border bg-surface text-text-muted'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Save button */}
            <div className="px-4 pb-10 pt-3 flex-shrink-0 border-t border-border">
              <button
                onClick={handleSaveEdit}
                disabled={!editTrip.name.trim() || saving}
                className="w-full bg-brand-teal text-white font-bold text-[14px] py-3.5 rounded-xl disabled:opacity-40 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ───────────────────────────────────── */}
      {deleteTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteTrip(null)} />
          <div className="relative bg-surface-deep border border-border rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h2 className="text-[17px] font-bold text-white text-center mb-1">Delete trip?</h2>
            <p className="text-[13px] text-text-muted text-center mb-6 leading-relaxed">
              <span className="text-white font-medium">{deleteTrip.name}</span> and all its days and moments will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTrip(null)}
                className="flex-1 bg-surface border border-border text-text-muted font-medium text-[13px] py-3 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white font-bold text-[13px] py-3 rounded-xl disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
