import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, X, Mountain, Footprints, Bike, Waves, Ship, Car } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'

const ADVENTURE_TYPES = [
  { id: 'hiking', label: 'Hiking', Icon: Mountain },
  { id: 'walking', label: 'Walking', Icon: Footprints },
  { id: 'cycling', label: 'Cycling', Icon: Bike },
  { id: 'water', label: 'Water', Icon: Waves },
  { id: 'cruise', label: 'Cruise', Icon: Ship },
  { id: 'driving', label: 'Driving', Icon: Car },
]
const STEPS = ['Details', 'Followers', 'Settings']

function ProgressBar({ step }) {
  return (
    <div>
      <div className="h-[3px] bg-[#1e1e1e] rounded-full overflow-hidden">
        <div className="h-full bg-brand-teal rounded-full transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-brand-teal">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
        <span className="text-[9px] text-text-disabled">{STEPS.slice(step + 1).join(' · ')}</span>
      </div>
    </div>
  )
}

function StepDetails({ form, setForm }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">Trip name <span className="text-brand-teal">*</span></label>
        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100}
          className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors"
          placeholder="e.g. Camino de Santiago 2026" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-widest text-text-muted">Description</label>
          <span className="text-[9px] text-text-disabled">Optional</span>
        </div>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} maxLength={200} rows={3}
          className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[11px] font-light text-[#666] placeholder-text-disabled focus:border-brand-teal transition-colors resize-none leading-relaxed"
          placeholder="What's this adventure about?" />
        <div className="text-right text-[9px] text-text-disabled mt-1">{form.description.length} / 200</div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-2">Adventure type</label>
        <div className="grid grid-cols-2 gap-2">
          {ADVENTURE_TYPES.map(({ id, label, Icon }) => {
            const selected = form.adventure_type === id
            return (
              <button key={id} type="button" onClick={() => setForm(f => ({ ...f, adventure_type: id }))}
                className={`flex items-center gap-3 p-3 rounded-sm border transition-colors ${selected ? 'border-brand-teal bg-brand-teal-deeper' : 'border-border bg-surface'}`}>
                <div className={`p-1.5 rounded-md ${selected ? 'bg-[#0f2a1e]' : 'bg-surface-elevated'}`}>
                  <Icon size={16} className={selected ? 'text-brand-teal' : 'text-text-muted'} />
                </div>
                <span className={`text-[11px] font-medium ${selected ? 'text-white' : 'text-text-secondary'}`}>{label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-[10px] text-text-disabled mt-2">You can change this later in trip settings</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-text-muted mb-1.5">Start date</label>
          <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full bg-surface border border-border rounded-sm px-3 py-2.5 text-[12px] font-bold text-[#ccc] focus:border-brand-teal transition-colors" />
        </div>
        <div>
          <label className="block text-[9px] uppercase tracking-widest text-text-muted mb-1.5">End date</label>
          <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full bg-surface border border-border rounded-sm px-3 py-2.5 text-[12px] font-bold text-[#ccc] focus:border-brand-teal transition-colors" />
        </div>
      </div>
    </div>
  )
}

function StepFollowers({ form, setForm }) {
  const [emailInput, setEmailInput] = useState('')
  const [error, setError] = useState('')
  function addFollower() {
    const email = emailInput.trim().toLowerCase()
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { setError('Enter a valid email address'); return }
    if (form.followers.includes(email)) { setError('Already added'); return }
    setForm(f => ({ ...f, followers: [...f.followers, email] }))
    setEmailInput(''); setError('')
  }
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">Invite followers</label>
        <div className="flex gap-2">
          <input type="email" value={emailInput} onChange={e => { setEmailInput(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFollower())}
            className="flex-1 bg-surface border border-border rounded-sm px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors"
            placeholder="follower@email.com" />
          <button type="button" onClick={addFollower} className="bg-brand-teal-deeper border border-brand-teal rounded-sm px-3 flex items-center justify-center">
            <Plus size={16} className="text-brand-teal" />
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
      </div>
      {form.followers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {form.followers.map(email => (
            <div key={email} className="flex items-center gap-2 bg-surface border border-border rounded-full pl-1 pr-2 py-1">
              <div className="w-6 h-6 rounded-full bg-brand-teal-deeper border border-brand-teal flex items-center justify-center">
                <span className="text-[10px] font-medium text-brand-teal">{email[0].toUpperCase()}</span>
              </div>
              <span className="text-[10px] text-text-secondary">{email}</span>
              <button type="button" onClick={() => setForm(f => ({ ...f, followers: f.followers.filter(e => e !== email) }))}>
                <div className="w-4 h-4 rounded-full bg-surface-elevated flex items-center justify-center"><X size={9} className="text-text-muted" /></div>
              </button>
            </div>
          ))}
        </div>
      ) : <p className="text-[12px] text-text-disabled text-center py-4">No followers added yet. You can add them later too.</p>}
    </div>
  )
}

function StepSettings({ form }) {
  return (
    <div className="space-y-5">
      <div className="bg-surface border border-border rounded-lg p-4">
        <p className="text-[13px] font-medium text-white mb-3">Trip summary</p>
        <div className="space-y-2">
          {[['Name', form.name || '—'], ['Type', form.adventure_type || '—'], ['Start', form.start_date || '—'], ['End', form.end_date || '—'], ['Followers', form.followers.length > 0 ? `${form.followers.length} invited` : 'None']].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-[11px] text-text-muted">{label}</span>
              <span className="text-[11px] text-white capitalize">{value}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-text-disabled text-center leading-relaxed">You can update all settings after creating the trip.</p>
    </div>
  )
}

const emptyForm = { name: '', description: '', adventure_type: 'hiking', start_date: '', end_date: '', followers: [] }

export default function NewTripPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleNext() {
    if (step < STEPS.length - 1) { setStep(s => s + 1); return }
    setSaving(true); setError('')
    try {
      const { data: trip, error: tripErr } = await supabase.from('trips')
        .insert({ roamer_id: user.id, name: form.name.trim(), description: form.description.trim() || null, adventure_type: form.adventure_type, start_date: form.start_date || null, end_date: form.end_date || null, status: 'active' })
        .select().single()
      if (tripErr) throw tripErr
      if (form.followers.length > 0) await supabase.from('followers').insert(form.followers.map(email => ({ trip_id: trip.id, email })))
      navigate('/')
    } catch (err) {
      setError(err.message || 'Failed to create trip. Please try again.')
    } finally { setSaving(false) }
  }

  return (
    <div className="flex flex-col h-full bg-surface-deep">
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button onClick={() => step === 0 ? navigate(-1) : setStep(s => s - 1)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
          <ArrowLeft size={16} className="text-text-secondary" />
        </button>
        <h1 className="text-[16px] font-medium text-white">New trip</h1>
      </div>
      <div className="px-4 mb-6"><ProgressBar step={step} /></div>
      <div className="flex-1 overflow-y-auto px-4">
        {step === 0 && <StepDetails form={form} setForm={setForm} />}
        {step === 1 && <StepFollowers form={form} setForm={setForm} />}
        {step === 2 && <StepSettings form={form} />}
      </div>
      <div className="px-4 pb-6 pt-4">
        {error && <p className="text-red-400 text-xs mb-3 text-center">{error}</p>}
        <button onClick={handleNext} disabled={(step === 0 && !form.name.trim()) || saving}
          className="w-full bg-brand-teal text-white font-medium text-[13px] py-3.5 rounded-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity">
          {saving ? 'Creating trip…' : step < STEPS.length - 1 ? <><span>Continue</span><ArrowRight size={14} /></> : 'Create trip'}
        </button>
        {step === 0 && <p className="text-center text-[10px] text-text-disabled font-light mt-2">Followers receive an email invite when you start each day</p>}
      </div>
    </div>
  )
}
