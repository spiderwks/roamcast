import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import Logo from '../../components/Logo'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await signUp(email, password, fullName)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 bg-surface-deep">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Logo size="lg" />
          <p className="text-text-muted text-sm mt-2">Start your first adventure</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoComplete="name"
              className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors"
              placeholder="Alex Rivera"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors"
              placeholder="Min. 8 characters"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-teal text-white font-medium text-[13px] py-3 rounded-sm mt-2 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-text-muted text-xs mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-teal">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
