import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, Circle, CloudOff, Upload } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'

const S = { pending: 'pending', uploading: 'uploading', done: 'done', error: 'error' }

const TYPE_EXT = { photo: 'jpg', video: 'webm', audio: 'webm' }

export default function UploadPage() {
  const { tripId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState('preparing')
  const [items, setItems] = useState([])
  const [dayId, setDayId] = useState(null)

  useEffect(() => {
    if (tripId && user) runUpload()
  }, [tripId, user])

  function patchItem(idx, patch) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  async function runUpload() {
    setPhase('preparing')
    setItems([])

    const { data: day } = await supabase
      .from('days')
      .select('id, day_number')
      .eq('trip_id', tripId)
      .not('session_end', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!day) { setPhase('error'); return }
    setDayId(day.id)

    const moments = await db.moments.where('dayId').equals(day.id).toArray()
    const allItems = [
      { key: 'gps', label: 'GPS track', sub: 'Route data', status: S.pending },
      ...moments.map(m => ({ key: m.id, label: m.title, sub: m.type, moment: m, status: S.pending })),
    ]
    setItems(allItems)
    setPhase('uploading')

    // ── 1. GPS track ─────────────────────────────────────────────────
    patchItem(0, { status: S.uploading })
    try {
      const points = await db.gpsPoints.where('dayId').equals(day.id).sortBy('timestamp')
      if (points.length > 0) {
        await supabase.from('gps_tracks').upsert({
          day_id: day.id,
          points: points,
          point_count: points.length,
        }, { onConflict: 'day_id' })
      }
      patchItem(0, { status: S.done })
    } catch {
      patchItem(0, { status: S.error })
    }

    // ── 2. Moments ─────────────────────────────────────────────────
    for (let i = 0; i < moments.length; i++) {
      const itemIdx = i + 1
      const m = moments[i]
      patchItem(itemIdx, { status: S.uploading })

      try {
        let mediaUrl = null
        const blobRec = await db.mediaBlobs.where('momentId').equals(m.id).first()
        if (blobRec) {
          const ext = TYPE_EXT[m.type] || 'bin'
          const path = `${user.id}/${day.id}/${m.id}.${ext}`
          const { error: storageErr } = await supabase.storage
            .from('media')
            .upload(path, blobRec.blob, { upsert: true })
          if (!storageErr) {
            mediaUrl = path
            await db.mediaBlobs.where('momentId').equals(m.id).delete()
          }
        }

        await supabase.from('moments').upsert({
          id: m.id,
          day_id: m.dayId,
          type: m.type,
          title: m.title,
          note: m.note || null,
          lat: m.lat,
          lng: m.lng,
          captured_at: new Date(m.capturedAt).toISOString(),
          duration_seconds: m.duration_seconds || null,
          media_url: mediaUrl,
        })

        await db.moments.update(m.id, { uploaded: true })
        patchItem(itemIdx, { status: S.done })
      } catch {
        patchItem(itemIdx, { status: S.error })
      }
    }

    // ── 3. Mark day complete ──────────────────────────────────────────
    await supabase.from('days').update({
      upload_status: 'complete',
      uploaded_at: new Date().toISOString(),
    }).eq('id', day.id)

    setPhase('done')
  }

  const doneCount = items.filter(i => i.status === S.done).length
  const hasError = items.some(i => i.status === S.error)
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-surface-deep">
      {/* Icon + heading */}
      <div className="px-4 pt-12 pb-6 text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${
          phase === 'done' ? 'bg-brand-teal/10 border-brand-teal'
          : phase === 'error' ? 'bg-red-500/10 border-red-500'
          : 'bg-brand-teal/10 border-brand-teal'
        }`}>
          {phase === 'done'
            ? <CheckCircle size={28} className="text-brand-teal" />
            : phase === 'error'
            ? <CloudOff size={28} className="text-red-400" />
            : <Upload size={28} className="text-brand-teal animate-pulse" />
          }
        </div>

        <h1 className="text-[20px] font-bold text-white mb-1">
          {phase === 'done' ? 'Upload complete!' : phase === 'error' ? 'Upload failed' : phase === 'preparing' ? 'Preparing…' : 'Uploading your day'}
        </h1>
        <p className="text-[12px] text-text-muted">
          {phase === 'done'
            ? 'Your adventure is saved and ready to share.'
            : phase === 'error'
            ? 'Check your connection and try again.'
            : phase === 'uploading'
            ? `${doneCount} of ${items.length} items`
            : 'Getting things ready…'}
        </p>
      </div>

      {/* Progress bar */}
      {phase === 'uploading' && (
        <div className="px-4 mb-5">
          <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-teal rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-text-muted mt-1 text-right">{pct}%</p>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
            <div className="flex-shrink-0 w-5 flex items-center justify-center">
              {item.status === S.done && <CheckCircle size={16} className="text-brand-teal" />}
              {item.status === S.uploading && <div className="w-4 h-4 rounded-full border-2 border-brand-teal border-t-transparent animate-spin" />}
              {item.status === S.error && <div className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center"><span className="text-[8px] text-red-400 font-bold">!</span></div>}
              {item.status === S.pending && <Circle size={16} className="text-border" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-[13px] truncate font-medium ${item.status === S.pending ? 'text-text-muted' : 'text-white'}`}>
                {item.label}
              </p>
              <p className="text-[10px] text-text-disabled capitalize">{item.sub}</p>
            </div>

            {item.status === S.done && <span className="text-[9px] text-brand-teal font-medium flex-shrink-0">Saved</span>}
            {item.status === S.uploading && <span className="text-[9px] text-brand-teal font-medium flex-shrink-0 animate-pulse">Uploading…</span>}
            {item.status === S.error && <span className="text-[9px] text-red-400 font-medium flex-shrink-0">Failed</span>}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="px-4 pb-10 pt-4 space-y-3">
        {phase === 'done' && (
          <button
            onClick={() => navigate('/')}
            className="w-full bg-brand-teal text-white font-bold text-[14px] py-4 rounded-xl"
          >
            Back to home
          </button>
        )}
        {(phase === 'error' || (phase === 'done' && hasError)) && (
          <button
            onClick={runUpload}
            className="w-full bg-surface border border-border text-text-muted font-medium text-[13px] py-3.5 rounded-xl"
          >
            Retry failed items
          </button>
        )}
      </div>
    </div>
  )
}
