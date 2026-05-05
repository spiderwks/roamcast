import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function callEdgeFn(path, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data: json }
}

export default function FollowerAuthPage() {
  const { tripId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const tripName = searchParams.get('name') || 'this adventure'

  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(true)
  const [resent, setResent] = useState(false)

  const otpRef = useRef(null)

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
    try {
      const { ok, status, data } = await callEdgeFn('send-follower-otp', { email: trimmed })
      if (!ok) {
        setError(`Error ${status}: ${data?.error || data?.message || JSON.stringify(data) || 'Failed to send code'}`)
        setLoading(false)
        return
      }
      setStep('otp')
      setOtp('')
      setLoading(false)
      setTimeout(() => otpRef.current?.focus(), 120)
    } catch (e) {
      setError(`Network error: ${e.message}`)
      setLoading(false)
    }
  }

  async function resendOTP() {
    setResent(false)
    const { ok } = await callEdgeFn('send-follower-otp', { email: email.trim() })
    if (ok) {
      setResent(true)
      setTimeout(() => setResent(false), 3000)
    }
  }

  function handleOtpChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setOtp(val)
    setError(null)
    if (val.length === 6) verifyOTPCode(val)
  }

  async function verifyOTP() {
    if (otp.length < 6) return
    verifyOTPCode(otp)
  }

  async function verifyOTPCode(code) {
    setVerifying(true)
    setError(null)
    const { ok, status, data: verifyData } = await callEdgeFn('verify-follower-otp', { email: email.trim(), code })
    if (!ok) {
      setError(verifyData?.error || `Error ${status}: verification failed`)
      setVerifying(false)
      return
    }
    // Exchange the hashed token for a real session via the Supabase auth client
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      token_hash: verifyData.token_hash,
      type: 'magiclink',
    })
    if (sessionError || !sessionData?.session) {
      setError(`Sign-in failed: ${sessionError?.message || 'No session returned'}`)
      setVerifying(false)
      return
    }
    await supabase.from('followers')
      .update({ accepted_at: new Date().toISOString() })
      .eq('trip_id', tripId)
      .eq('email', email.trim().toLowerCase())
    setStep('confirmed')
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a]">
        <p className="text-text-muted text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] px-6 pt-10 pb-8">
      <div className="mb-10 flex justify-center">
        <Logo />
      </div>

      <div className="flex-1 flex flex-col">
        {step === 'confirmed' ? (
          <div className="flex-1 flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 rounded-full bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 className="text-[24px] font-bold text-white mb-2">You're following</h1>
            <p className="text-[16px] text-brand-teal font-semibold mb-3">{tripName}</p>
            <p className="text-[13px] text-text-muted mb-10">You'll receive updates by email each day of the trip.</p>
            <button
              onClick={() => navigate(`/follow/${tripId}/view`, { replace: true })}
              className="w-full bg-brand-teal text-white font-bold text-[14px] py-4 rounded-xl"
            >
              View trip →
            </button>
          </div>
        ) : step === 'email' ? (
          <>
            <div className="mb-8">
              <p className="text-[10px] text-brand-teal uppercase tracking-widest mb-1">You're invited to follow</p>
              <h1 className="text-[24px] font-bold text-white leading-tight mb-2">{tripName}</h1>
              <p className="text-[13px] text-text-muted">
                Enter your email to get a sign-in code. No password needed.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white mb-2">Your email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendOTP()}
                  placeholder="you@example.com"
                  autoFocus
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3.5 text-[14px] text-white placeholder-[#444] focus:border-brand-teal outline-none transition-colors"
                />
              </div>
              {error && <p className="text-[11px] text-red-400">{error}</p>}
              <button
                onClick={sendOTP}
                disabled={loading || !email.trim()}
                className="w-full bg-brand-teal text-white font-bold text-[14px] py-4 rounded-xl disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Sending…' : 'Send sign-in code →'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[20px] font-bold text-white text-center leading-snug mb-0.5">
              Enter the code sent to
            </h1>
            <p className="text-[14px] text-white font-semibold text-center mb-8">{email}</p>

            <div className="mb-5">
              <label className="block text-[10px] uppercase tracking-widest text-white mb-3">
                6-digit code
              </label>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={handleOtpChange}
                onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                placeholder="Enter 6-digit code"
                maxLength={6}
                autoComplete="one-time-code"
                style={{ fontSize: '16px' }}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-4 text-center font-bold tracking-[0.5em] text-white placeholder-[#444] focus:border-brand-teal outline-none transition-colors placeholder:tracking-normal"
              />
            </div>

            {error && <p className="text-[11px] text-red-400 text-center mb-3">{error}</p>}

            <button
              onClick={verifyOTP}
              disabled={otp.length < 6 || verifying}
              className="w-full bg-brand-teal text-white font-bold text-[14px] py-4 rounded-xl mb-5 disabled:opacity-50 transition-opacity"
            >
              {verifying ? 'Verifying…' : 'Verify & sign in →'}
            </button>

            <div className="flex flex-col items-center gap-1.5">
              <button onClick={resendOTP} className="text-[12px] text-brand-teal">
                {resent ? 'Code sent!' : 'Resend code'}
              </button>
              <p className="text-[11px] text-text-disabled">Code expires in 10 minutes</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
