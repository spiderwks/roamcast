import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Video, Mic, Square, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { getCurrentGPS } from '../../hooks/useGPS'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'

const TYPE_EXT = { photo: 'jpg', video: 'webm', audio: 'webm' }

async function tryBackgroundUpload(momentId, m, userId) {
  try {
    const blobRec = await db.mediaBlobs.where('momentId').equals(momentId).first()
    if (!blobRec) return
    const uploadBlob = blobRec.data
      ? new Blob([blobRec.data], { type: blobRec.mimeType })
      : blobRec.blob
    const ext = TYPE_EXT[m.type] || 'bin'
    const path = `${userId}/${m.dayId}/${momentId}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, uploadBlob, { upsert: true })
    if (error) return
    await supabase.from('moments').upsert({
      id: momentId,
      day_id: m.dayId,
      type: m.type,
      title: m.title,
      note: m.note || null,
      lat: m.lat,
      lng: m.lng,
      captured_at: new Date(m.capturedAt).toISOString(),
      duration_seconds: m.duration_seconds || null,
      media_url: path,
    })
    await db.moments.update(momentId, { uploaded: true })
  } catch {
    // end-of-day upload handles it
  }
}

const MAX_DURATION = 30
const MODES = ['photo', 'video', 'audio']

const MODE_CONFIG = {
  photo: { label: 'Photo', Icon: Camera, color: 'text-moment-photo', border: 'border-moment-photo', activeBg: 'bg-[#1f1200]' },
  video: { label: 'Video', Icon: Video, color: 'text-moment-video', border: 'border-moment-video', activeBg: 'bg-[#001a10]' },
  audio: { label: 'Audio', Icon: Mic, color: 'text-moment-audio', border: 'border-moment-audio', activeBg: 'bg-[#110d24]' },
}

export default function MomentCapturePage() {
  const { tripId, dayId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mode, setMode] = useState('photo')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaBlob, setMediaBlob] = useState(null)
  const [mediaURL, setMediaURL] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [gpsLocked, setGpsLocked] = useState(false)
  const [gpsCoords, setGpsCoords] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const photoInputRef = useRef(null)
  const streamRef = useRef(null)
  const previewVideoRef = useRef(null)

  // Pre-fetch GPS on mount
  useEffect(() => {
    getCurrentGPS().then(coords => {
      if (coords) { setGpsCoords(coords); setGpsLocked(true) }
    })
  }, [])

  // Start camera/mic stream as soon as the user switches to video or audio mode.
  // This requests permission ONCE and keeps the stream alive for the whole session
  // so subsequent recordings never trigger another permission prompt.
  useEffect(() => {
    if (mode === 'photo') { stopStream(); return }

    let cancelled = false
    const constraints = mode === 'video'
      ? { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      : { audio: true }

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        // For video, attach to the always-present preview element
        if (mode === 'video' && previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream
        }
      })
      .catch(err => {
        console.error('Media access denied:', err)
      })

    return () => {
      cancelled = true
      stopStream()
    }
  }, [mode])

  // Re-attach stream to preview after "Discard and retake" clears mediaURL
  useEffect(() => {
    if (mode === 'video' && !mediaURL && previewVideoRef.current && streamRef.current) {
      previewVideoRef.current.srcObject = streamRef.current
    }
  }, [mediaURL])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
      clearInterval(timerRef.current)
      if (mediaURL) URL.revokeObjectURL(mediaURL)
    }
  }, [])

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null
  }

  function resetCapture() {
    setMediaBlob(null)
    if (mediaURL) { URL.revokeObjectURL(mediaURL); setMediaURL(null) }
    setPhotoFile(null)
    setRecording(false)
    setRecordingTime(0)
    clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    // Don't stop the stream — keep the viewfinder/mic alive for retake
  }

  function handleModeChange(newMode) {
    // stopStream is handled by the mode useEffect cleanup
    setMediaBlob(null)
    if (mediaURL) { URL.revokeObjectURL(mediaURL); setMediaURL(null) }
    setPhotoFile(null)
    setRecording(false)
    setRecordingTime(0)
    clearInterval(timerRef.current)
    setMode(newMode)
  }

  // ─── Photo ────────────────────────────────
  function handlePhotoCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setMediaURL(URL.createObjectURL(file))
    setMediaBlob(file)
  }

  // ─── Video / Audio recording ──────────────
  async function startRecording() {
    try {
      // Reuse existing stream — no new permission prompt
      const stream = streamRef.current
      if (!stream) return

      const mimeType = mode === 'video'
        ? (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4')

      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setMediaBlob(blob)
        setMediaURL(URL.createObjectURL(blob))
        // Keep stream alive — don't call stopStream()
      }

      mediaRecorderRef.current = recorder
      recorder.start(100)
      setRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t + 1 >= MAX_DURATION) { stopRecording(); return MAX_DURATION }
          return t + 1
        })
      }, 1000)
    } catch (err) {
      console.error('Recording failed:', err)
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  // ─── Save moment ──────────────────────────
  async function saveMoment() {
    if (!title.trim() || !mediaBlob) return
    if (!dayId || dayId === 'undefined') {
      setSaveError("Session not found. Go back and start today's session first.")
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      let coords = gpsCoords
      if (!coords) { try { coords = await getCurrentGPS() } catch (_) {} }

      const momentId = crypto.randomUUID()
      const momentData = {
        id: momentId,
        dayId,
        type: mode,
        title: title.trim(),
        note: note.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        capturedAt: Date.now(),
        duration_seconds: mode !== 'photo' ? recordingTime : null,
        uploaded: false,
      }

      await db.moments.add(momentData)

      if (mediaBlob) {
        const data = await mediaBlob.arrayBuffer()
        await db.mediaBlobs.add({ momentId, data, mimeType: mediaBlob.type, type: mode })
      }

      navigate(-1)
      if (user) tryBackgroundUpload(momentId, momentData, user.id).catch(() => {})
    } catch (err) {
      console.error('Save failed:', err)
      setSaveError(err?.message || 'Failed to save moment. Please try again.')
      setSaving(false)
    }
  }

  const cfg = MODE_CONFIG[mode]
  const canSave = title.trim().length > 0 && mediaBlob !== null

  return (
    <div className="flex flex-col h-full bg-surface-deep">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-surface border border-border flex items-center justify-center">
          <ArrowLeft size={16} className="text-text-secondary" />
        </button>
        <h1 className="text-[16px] font-medium text-white flex-1">Capture moment</h1>
        {gpsLocked && (
          <div className="flex items-center gap-1 bg-brand-teal-bg border border-brand-teal rounded-full px-2 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
            <span className="text-[9px] text-brand-teal font-medium">GPS locked</span>
          </div>
        )}
      </div>

      {/* Mode tabs */}
      <div className="px-4 mb-4">
        <div className="flex bg-surface border border-border rounded-sm p-0.5 gap-0.5">
          {MODES.map(m => {
            const c = MODE_CONFIG[m]
            const active = mode === m
            return (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-sm transition-colors ${active ? c.activeBg : ''}`}
              >
                <c.Icon size={13} className={active ? c.color : 'text-text-muted'} />
                <span className={`text-[11px] font-medium ${active ? c.color : 'text-text-muted'}`}>{c.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-4">
        {/* Capture area */}
        <div className={`w-full rounded-lg border ${cfg.border} overflow-hidden`}>

          {/* PHOTO MODE */}
          {mode === 'photo' && (
            <>
              {mediaURL ? (
                <img src={mediaURL} alt="captured" className="w-full object-cover" style={{ maxHeight: 180 }} />
              ) : (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 py-10 bg-[#1f1200]"
                >
                  <div className="w-14 h-14 rounded-full bg-moment-photo/10 border border-moment-photo flex items-center justify-center">
                    <Camera size={24} className="text-moment-photo" />
                  </div>
                  <span className="text-[12px] text-moment-photo font-medium">Tap to take photo</span>
                </button>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handlePhotoCapture} />
            </>
          )}

          {/* VIDEO MODE — live viewfinder always visible, controls overlaid */}
          {mode === 'video' && (
            <div className="relative bg-black">
              {mediaURL ? (
                <video src={mediaURL} controls playsInline className="w-full" style={{ maxHeight: 180 }} />
              ) : (
                <div className="relative" style={{ height: 180 }}>
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ background: '#000' }}
                  />
                  {recording ? (
                    <>
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[12px] text-white font-medium tabular-nums">{recordingTime}s / {MAX_DURATION}s</span>
                      </div>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <button
                          onClick={stopRecording}
                          className="w-14 h-14 rounded-full border-2 border-red-500 bg-black/50 flex items-center justify-center"
                        >
                          <Square size={20} className="text-red-500" fill="currentColor" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
                      <button
                        onClick={startRecording}
                        className="w-14 h-14 rounded-full border-2 border-moment-video bg-black/50 flex items-center justify-center"
                      >
                        <Video size={22} className="text-moment-video" />
                      </button>
                      <span className="text-[10px] text-white/60">Tap to record · max {MAX_DURATION}s</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AUDIO MODE */}
          {mode === 'audio' && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 bg-[#110d24]">
              {mediaURL ? (
                <audio src={mediaURL} controls className="w-full px-4" />
              ) : (
                <>
                  {recording && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-moment-audio animate-pulse" />
                        <span className="text-[12px] text-moment-audio font-medium">{recordingTime}s / {MAX_DURATION}s</span>
                      </div>
                      <div className="flex items-center gap-0.5 h-8">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={i} className="w-1 bg-moment-audio rounded-full animate-pulse"
                            style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${i * 50}ms` }} />
                        ))}
                      </div>
                    </>
                  )}
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className="w-16 h-16 rounded-full border-2 border-moment-audio bg-moment-audio/10 flex items-center justify-center"
                  >
                    {recording
                      ? <Square size={20} className="text-moment-audio" fill="currentColor" />
                      : <Mic size={22} className="text-moment-audio" />
                    }
                  </button>
                  <span className="text-[11px] text-text-muted">{recording ? 'Recording… tap to stop' : 'Tap to record (max 30s)'}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Discard captured media */}
        {mediaBlob && (
          <button onClick={resetCapture} className="flex items-center gap-2 text-text-muted text-[12px]">
            <Trash2 size={13} />
            <span>Discard and retake</span>
          </button>
        )}

        {/* Title */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-white mb-1.5">
            Title <span className={cfg.color}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
            className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[13px] text-white placeholder-text-disabled focus:border-brand-teal transition-colors"
            placeholder="What's happening here?"
          />
        </div>

        {/* Note */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-widest text-white">Note</label>
            <span className="text-[9px] text-text-disabled">Optional</span>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full bg-surface border border-border rounded-sm px-3 py-3 text-[11px] font-light text-[#666] placeholder-text-disabled focus:border-brand-teal transition-colors resize-none leading-relaxed"
            placeholder="Any thoughts about this moment…"
          />
        </div>
      </div>

      {/* Save CTA */}
      <div className="px-4 pb-6 pt-4">
        {saveError && <p className="text-red-400 text-[11px] text-center mb-3">{saveError}</p>}
        {!mediaBlob && !saving && (
          <p className="text-text-disabled text-[11px] text-center mb-2">
            {mode === 'photo' ? 'Take a photo first' : `Record ${mode} first`}
          </p>
        )}
        {mediaBlob && !title.trim() && !saving && (
          <p className="text-text-disabled text-[11px] text-center mb-2">Enter a title to save</p>
        )}
        <button
          onClick={saveMoment}
          disabled={!canSave || saving}
          className="w-full bg-brand-teal text-white font-medium text-[13px] py-3.5 rounded-sm disabled:opacity-40 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save moment'}
        </button>
      </div>
    </div>
  )
}
