import { useRef, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Pencil, Check, X, Camera } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Avatar from '../../components/Avatar'

export default function ProfilePage() {
  const { user, profile, signOut, loadProfile } = useAuth()
  const navigate = useNavigate()
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Roamer'
  const avatarUrl = profile?.avatar_url || null

  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef(null)

  function startEdit() {
    setNameInput(displayName)
    setSaveError('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setSaveError('')
  }

  async function saveProfile() {
    const name = nameInput.trim()
    if (!name) { setSaveError('Name cannot be empty'); return }
    setSaving(true)
    setSaveError('')
    const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id)
    if (error) {
      setSaveError('Could not save. Please try again.')
      setSaving(false)
      return
    }
    await supabase.auth.updateUser({ data: { full_name: name } })
    await loadProfile(user.id)
    setSaving(false)
    setEditing(false)
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) {
      console.error('Avatar upload error:', uploadError)
      setUploadingAvatar(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    await loadProfile(user.id)
    setUploadingAvatar(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full bg-surface-deep px-6 pt-10 pb-6">
      {/* Avatar + name */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative">
          <Avatar name={displayName} size={80} src={avatarUrl} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-teal flex items-center justify-center border-2 border-surface-deep disabled:opacity-50"
          >
            <Camera size={13} className="text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        {uploadingAvatar && <p className="text-[10px] text-text-muted mt-2">Uploading…</p>}

        {editing ? (
          <div className="mt-4 w-full max-w-xs">
            <input
              type="text"
              value={nameInput}
              onChange={e => { setNameInput(e.target.value); setSaveError('') }}
              onKeyDown={e => { if (e.key === 'Enter') saveProfile(); if (e.key === 'Escape') cancelEdit() }}
              autoFocus
              maxLength={60}
              className="w-full bg-surface border border-brand-teal rounded-sm px-3 py-2.5 text-[14px] text-white text-center focus:outline-none"
            />
            {saveError && <p className="text-red-400 text-xs mt-1 text-center">{saveError}</p>}
            <div className="flex gap-2 mt-3">
              <button
                onClick={cancelEdit}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-sm border border-border text-text-secondary text-[13px]"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-sm bg-brand-teal text-white text-[13px] font-medium disabled:opacity-50"
              >
                <Check size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-3">
            <p className="text-white font-semibold text-[18px]">{displayName}</p>
            <button onClick={startEdit} className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center">
              <Pencil size={12} className="text-text-muted" />
            </button>
          </div>
        )}

        <p className="text-text-muted text-[13px] mt-1">{user?.email}</p>
      </div>

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
