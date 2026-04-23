import { useAuth } from '../../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import Avatar from '../../components/Avatar'

export default function ProfilePage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Roamer'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col items-center px-6 pt-10 pb-6 h-full">
      <Avatar name={displayName} size={64} />
      <p className="text-white font-medium text-lg mt-3">{displayName}</p>
      <p className="text-text-muted text-sm">{user?.email}</p>

      <div className="mt-auto w-full">
        <button
          onClick={handleSignOut}
          className="w-full border border-border text-text-secondary text-sm font-medium py-3 rounded-sm"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
