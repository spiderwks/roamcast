import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Users, Trash2, Link, Plus, Mail } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function sendInviteEmail(tripId, tripName, email, authHeader) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-follower-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ tripId, tripName, email }),
  })
  return res.ok
}

export default function FollowersPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [tripName, setTripName] = useState('')
  const [followers, setFollowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [resending, setResending] = useState(null)
  const [resentId, setResentId] = useState(null)

  const shareUrl = `${window.location.origin}/follow/${tripId}?name=${encodeURIComponent(tripName)}`

  useEffect(() => { loadData() }, [tripId])

  async function loadData() {
    const [{ data: trip }, { data: followersData }] = await Promise.all([
      supabase.from('trips').select('name').eq('id', tripId).single(),
      supabase.from('followers')
        .select('id, email, invited_at, last_viewed_at, accepted_at')
        .eq('trip_id', tripId)
        .order('invited_at', { ascending: false }),
    ])
    if (trip) setTripName(trip.name)
    setFollowers(followersData ?? [])
    setLoading(false)
  }

  async function getAuthHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return `Bearer ${session?.access_token}`
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

  async function inviteFollower() {
    const email = inviteEmail.trim().toLowerCase()
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setInviteError('Enter a valid email address'); return
    }
    if (followers.some(f => f.email === email)) {
      setInviteError('This email is already following'); return
    }
    setInviting(true)
    setInviteError('')
    const { error } = await supabase.from('followers').insert({ trip_id: tripId, email })
    if (error) {
      setInviteError('Could not add follower. Please try again.')
      setInviting(false)
      return
    }
    const authHeader = await getAuthHeader()
    await sendInviteEmail(tripId, tripName, email, authHeader)
    setInviteEmail('')
    setInviteSent(true)
    setTimeout(() => setInviteSent(false), 2500)
    await loadData()
    setInviting(false)
  }

  async function resendInvite(follower) {
    setResending(follower.id)
    const authHeader = await getAuthHeader()
    await sendInviteEmail(tripId, tripName, follower.email, authHeader)
    setResending(null)
    setResentId(follower.id)
    setTimeout(() => setResentId(null), 3000)
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

      {/* Add by email */}
      <div className="px-4 mb-4">
        <p className="text-[10px] uppercase tracking-widest text-white mb-2">Add follower by email</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
            onKeyDown={e => e.key === 'Enter' && inviteFollower()}
            placeholder="follower@email.com"
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors"
          />
          <button
            onClick={inviteFollower}
            disabled={inviting || !inviteEmail.trim()}
            className={`px-4 rounded-lg font-bold text-[13px] transition-colors disabled:opacity-40 flex items-center gap-1.5 ${
              inviteSent ? 'bg-brand-teal/20 border border-brand-teal text-brand-teal' : 'bg-brand-teal text-white'
            }`}
          >
            {inviteSent ? <Check size={15} /> : <Plus size={15} />}
            {inviteSent ? 'Invited' : inviting ? '…' : 'Add'}
          </button>
        </div>
        {inviteError && <p className="text-red-400 text-[11px] mt-1.5">{inviteError}</p>}
        <p className="text-[10px] text-text-disabled mt-1.5">A welcome email will be sent automatically</p>
      </div>

      {/* Followers list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-white">
            Following · {followers.length}
          </p>
          {followers.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                <span className="text-[9px] text-text-disabled">Accepted</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[9px] text-text-disabled">Pending</span>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-text-muted text-sm py-4">Loading…</p>
        ) : followers.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-3">
              <Users size={22} className="text-text-muted" />
            </div>
            <p className="text-text-muted text-sm font-medium">No followers yet</p>
            <p className="text-text-disabled text-xs mt-1">Share the invite link or add by email</p>
          </div>
        ) : (
          <div className="space-y-2">
            {followers.map(f => {
              const accepted = !!f.accepted_at
              const isResent = resentId === f.id
              const isResending = resending === f.id
              return (
                <div key={f.id} className="bg-surface border border-border rounded-xl px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      accepted
                        ? 'bg-brand-teal/10 border border-brand-teal/30'
                        : 'bg-amber-500/10 border border-amber-500/30'
                    }`}>
                      <span className={`text-[12px] font-bold ${accepted ? 'text-brand-teal' : 'text-amber-500'}`}>
                        {f.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-medium text-white truncate">{f.email}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          accepted ? 'bg-brand-teal/10 text-brand-teal' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {accepted ? 'Accepted' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {accepted && f.last_viewed_at
                          ? `Last viewed ${new Date(f.last_viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : accepted
                          ? `Joined ${new Date(f.accepted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : `Invited ${new Date(f.invited_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        }
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!accepted && (
                        <button
                          onClick={() => resendInvite(f)}
                          disabled={isResending}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 ${
                            isResent
                              ? 'bg-brand-teal/10 text-brand-teal'
                              : 'bg-surface-elevated text-text-muted'
                          }`}
                        >
                          {isResent ? <Check size={10} /> : <Mail size={10} />}
                          {isResent ? 'Sent' : isResending ? '…' : 'Resend'}
                        </button>
                      )}
                      <button
                        onClick={() => removeFollower(f.id)}
                        disabled={removing === f.id}
                        className="w-7 h-7 rounded-full bg-surface-elevated flex items-center justify-center disabled:opacity-40"
                      >
                        <Trash2 size={12} className="text-text-muted" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
