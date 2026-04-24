import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Users, Trash2, Link } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function FollowersPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [followers, setFollowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState(null)

  const shareUrl = `${window.location.origin}/follow/${tripId}?name=${encodeURIComponent(tripName)}`

  useEffect(() => { loadData() }, [tripId])

  async function loadData() {
    const [{ data: trip }, { data: followersData }] = await Promise.all([
      supabase.from('trips').select('name').eq('id', tripId).single(),
      supabase.from('followers')
        .select('id, email, invited_at, last_viewed_at')
        .eq('trip_id', tripId)
        .order('invited_at', { ascending: false }),
    ])
    if (trip) setTripName(trip.name)
    setFollowers(followersData ?? [])
    setLoading(false)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      const el = document.createElement('textarea')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  async function removeFollower(id) {
    setRemoving(id)
    await supabase.from('followers').delete().eq('id', id)
    setFollowers(f => f.filter(x => x.id !== id))
    setRemoving(null)
  }

  return (
    <div className="flex flex-col h-full bg-surface-deep">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <ArrowLeft size={16} className="text-text-secondary" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-text-muted uppercase tracking-widest">Followers</p>
          <h1 className="text-[15px] font-bold text-white truncate">{tripName}</h1>
        </div>
      </div>

      {/* Share link card */}
      <div className="px-4 mb-5">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center">
              <Link size={13} className="text-brand-teal" />
            </div>
            <p className="text-[12px] font-bold text-white">Invite link</p>
          </div>
          <p className="text-[10px] text-text-muted break-all leading-relaxed mb-3">{shareUrl}</p>
          <button
            onClick={copyLink}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-[13px] transition-colors ${
              copied
                ? 'bg-brand-teal/20 border border-brand-teal text-brand-teal'
                : 'bg-brand-teal text-white'
            }`}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Link copied!' : 'Copy invite link'}
          </button>
          <p className="text-[10px] text-text-disabled mt-2 text-center">
            Anyone with this link can follow your trip
          </p>
        </div>
      </div>

      {/* Followers list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="text-[10px] font-medium uppercase tracking-widest text-text-muted mb-3">
          Following · {followers.length}
        </p>

        {loading ? (
          <p className="text-text-muted text-sm py-4">Loading…</p>
        ) : followers.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-text-muted" />
            </div>
            <p className="text-text-muted text-sm font-medium">No followers yet</p>
            <p className="text-text-disabled text-xs mt-1">Share the invite link to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {followers.map(f => (
              <div
                key={f.id}
                className="flex items-center gap-3 bg-surface border border-border rounded-xl px-3 py-3"
              >
                <div className="w-9 h-9 rounded-full bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[12px] font-bold text-brand-teal">
                    {f.email[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-white truncate">{f.email}</p>
                  <p className="text-[10px] text-text-muted">
                    {f.last_viewed_at
                      ? `Last viewed ${new Date(f.last_viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : `Joined ${new Date(f.invited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    }
                  </p>
                </div>
                <button
                  onClick={() => removeFollower(f.id)}
                  disabled={removing === f.id}
                  className="w-7 h-7 rounded-full bg-surface-elevated flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                >
                  <Trash2 size={12} className="text-text-muted" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
