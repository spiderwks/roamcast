import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Logo from '../../components/Logo'

export default function FollowerAuthPage() {
  const { tripId } = useParams()
  const [searchParams] = useSearchParams()
  const tripName = searchParams.get('name') || 'this adventure'
  const email = searchParams.get('email') || ''

  useEffect(() => {
    if (email) {
      supabase.from('followers')
        .update({ accepted_at: new Date().toISOString() })
        .eq('trip_id', tripId)
        .eq('email', email.toLowerCase())
        .then(() => {})
    }
  }, [tripId, email])

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] px-6 pt-10 pb-8">
      <div className="mb-10 flex justify-center">
        <Logo />
      </div>

      <div className="flex-1 flex flex-col justify-center items-center text-center">
        <div className="w-16 h-16 rounded-full bg-brand-teal/10 border border-brand-teal/30 flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p className="text-[11px] text-brand-teal uppercase tracking-widest mb-2">You're following</p>
        <h1 className="text-[26px] font-bold text-white leading-tight mb-4">{tripName}</h1>
        <p className="text-[14px] text-text-muted leading-relaxed max-w-xs">
          You'll receive an email at the start and end of each day with the full recap.
        </p>
      </div>
    </div>
  )
}
