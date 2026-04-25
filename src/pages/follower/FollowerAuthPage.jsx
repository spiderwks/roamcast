import { useState, useRef, useEffect } from 'react'
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
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(true)
  const [pasted, setPasted] = useState(false)
  const [resent, setResent] = useState(false)

  const digitRefs = useRef(Array.from({ length: 6 }, () => null))
  const otp = digits.join('')

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
    if (error) {
      const msg = error.message?.toLowerCase() ?? ''
      if (msg.includes('rate limit') || msg.includes('sending') || msg.includes('email')) {
        setError('Having trouble sending the code right now. Please try again in a few minutes.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }
    setStep('otp')
    setDigits(Array(6).fill(''))
    setLoading(false)
    setTimeout(() => digitRefs.current[0]?.focus(), 120)
  }

  async function resendOTP() {
    setResent(false)
    await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setResent(true)
    setTimeout(() => setResent(false), 3000)
  }

  function handleDigitInput(i, value) {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i] = char
    setDigits(next)
    setError(null)
    if (char && i < 5) digitRefs.current[i + 1]?.focus()
  }

  function handleDigitKeyDown(i, e) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits]; next[i] = ''; setDigits(next)
      } else if (i > 0) {
        const next = [...digits]; next[i - 1] = ''; setDigits(next)
        digitRefs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      digitRefs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      digitRefs.current[i + 1]?.focus()
    }
  }

  function handleDigitPaste(e) {
    e.preventDefault()
    const code = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!code) return
    const next = Array(6).fill('')
    code.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    setPasted(true)
    setTimeout(() => setPasted(false), 2000)
    digitRefs.current[Math.min(code.length, 5)]?.focus()
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      const code = text.replace(/\D/g, '').slice(0, 6)
      if (!code) return
      const next = Array(6).fill('')
      code.split('').forEach((c, i) => { next[i] = c })
      setDigits(next)
      setPasted(true)
      setTimeout(() => setPasted(false), 2000)
      digitRefs.current[Math.min(code.length, 5)]?.focus()
    } catch {}
  }

  async function verifyOTP() {
    if (otp.length < 6) return
    setVerifying(true)
    setError(null)
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(), token: otp, type: 'email',
    })
    if (error) {
      setError('Invalid or expired code — try again.')
      setVerifying(false)
      return
    }
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

      <div className="flex-1">
        {step === 'email' ? (
          <>
            <p className="text-[10px] text-brand-teal uppercase tracking-widest mb-1">You're invited to follow</p>
            <h1 className="text-[24px] font-bold text-white leading-tight mb-2">{tripName}</h1>
            <p className="text-[13px] text-text-muted mb-8">
              Enter your email to get a sign-in code. No password needed.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-white mb-2">
                  Your email
                </label>
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
            <p className="text-[14px] text-white font-semibold text-center mb-7">{email}</p>

            {/* Digit boxes */}
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-widest text-white mb-3">6-digit code</p>
              <div className="flex gap-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { digitRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    value={d}
                    onChange={e => handleDigitInput(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    onPaste={handleDigitPaste}
                    maxLength={2}
                    className={`flex-1 h-14 text-center text-[22px] font-bold bg-[#111] border rounded-xl text-white outline-none transition-colors ${
                      d ? 'border-brand-teal' : 'border-[#2a2a2a]'
                    } focus:border-brand-teal`}
                  />
                ))}
              </div>
            </div>

            {/* Paste button */}
            <button
              onClick={pasteFromClipboard}
              className={`w-full border rounded-xl py-3.5 flex items-center justify-center gap-2 mb-3 text-[13px] transition-colors ${
                pasted
                  ? 'bg-brand-teal/10 border-brand-teal text-brand-teal'
                  : 'bg-[#111] border-[#2a2a2a] text-text-muted'
              }`}
            >
              {pasted ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Code pasted successfully
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Paste code from email
                </>
              )}
            </button>

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
