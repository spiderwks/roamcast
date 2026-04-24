import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function FollowerAuthPage() {
  const { tripId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const tripName = searchParams.get('name') || 'this adventure'

  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(true)

  // If already authenticated, go straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(`/follow/${tripId}/view`, { replace: true })
      else setChecking(false)
    })
  }, [tripId])

  async function sendOTP() {
    const trimmed = email.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { shouldCreateUser: true },
    })
    if (error) setError(error.message)
    else setStep('otp')
    setLoading(false)
  }

  async function verifyOTP() {
    const trimmed = otp.trim()
    if (trimmed.length < 6) return
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmed,
      type: 'email',
    })
    if (error) {
      setError('Invalid or expired code — try again.')
      setLoading(false)
      return
    }
    // Auto-add as follower (idempotent)
    if (data.session) {
      await supabase.from('followers').upsert(
        { trip_id: tripId, email: email.trim() },
        { onConflict: 'trip_id,email', ignoreDuplicates: true }
      )
    }
    navigate(`/follow/${tripId}/view`, { replace: true })
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full bg-surface-deep">
        <p className="text-text-muted text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-deep px-6 pt-10 pb-8">
      <div className="mb-10">
        <Logo />
      </div>

      <div className="flex-1">
        {step === 'email' ? (
          <>
            <p className="text-[10px] text-brand-teal uppercase tracking-widest mb-1">You're invited to follow</p>
            <h1 className="text-[24px] font-bold text-white leading-tight mb-2">{tripName}</h1>
            <p className="text-[13px] text-text-muted mb-8">Enter your email to receive a sign-in code</p>

            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendOTP()}
                placeholder="you@example.com"
                autoFocus
                className="w-full bg-surface border border-border rounded-sm px-4 py-3.5 text-[14px] text-white placeholder-text-disabled focus:border-brand-teal outline-none"
              />
              {error && <p className="text-[11px] text-red-400">{error}</p>}
              <button
                onClick={sendOTP}
                disabled={loading || !email.trim()}
                className="w-full bg-brand-teal text-white font-bold text-[14px] py-4 rounded-xl disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Get sign-in code →'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[10px] text-brand-teal uppercase tracking-widest mb-1">Check your email</p>
            <h1 className="text-[24px] font-bold text-white leading-tight mb-2">Enter the code</h1>
            <p className="text-[13px] text-text-muted mb-8">
              We sent a 6-digit code to <span className="text-white">{email}</span>
            </p>

            <div className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                placeholder="000000"
                autoFocus
                className="w-full bg-surface border border-border rounded-sm px-4 py-3.5 text-[22px] text-white text-center tracking-[0.4em] placeholder-text-disabled focus:border-brand-teal outline-none"
              />
              {error && <p className="text-[11px] text-red-400">{error}</p>}
              <button
                onClick={verifyOTP}
                disabled={loading || otp.length < 6}
                className="w-full bg-brand-teal text-white font-bold text-[14px] py-4 rounded-xl disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'View trip →'}
              </button>
              <button
                onClick={() => { setStep('email'); setOtp(''); setError(null) }}
                className="w-full text-[12px] text-text-muted py-2"
              >
                ← Use a different email
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-[10px] text-text-disabled text-center">Powered by Roamcast</p>
    </div>
  )
}
