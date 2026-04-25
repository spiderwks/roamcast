import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Roamcast <hello@roamcast.app>'
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://roamcast.vercel.app').replace(/\/$/, '')

function getFirstName(email: string): string {
  const local = email.split('@')[0].split(/[._+]/)[0]
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function generateRouteSVG(points: any[] | null): string {
  const fallback = `<svg width="100%" height="56" viewBox="0 0 460 56" xmlns="http://www.w3.org/2000/svg"><path d="M0,46 C80,36 160,18 230,22 C300,26 380,8 460,4" stroke="#14b8a6" stroke-width="2" fill="none" opacity="0.7" stroke-linecap="round"/><circle cx="58" cy="40" r="4" fill="#f59e0b"/><circle cx="230" cy="22" r="4" fill="#14b8a6"/><circle cx="390" cy="7" r="4" fill="#f59e0b"/></svg>`
  if (!points || points.length < 3) return fallback
  try {
    const lats = points.map((p: any) => p.lat)
    const lngs = points.map((p: any) => p.lng)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const W = 460, H = 56, PAD = 8
    const coords = points.map((p: any) => {
      const x = ((p.lng - minLng) / (maxLng - minLng || 0.001)) * (W - PAD * 2) + PAD
      const y = H - PAD - ((p.lat - minLat) / (maxLat - minLat || 0.001)) * (H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    const mid = Math.floor(points.length / 2)
    const [mx, my] = coords[mid].split(',')
    const [ex, ey] = coords[coords.length - 1].split(',')
    return `<svg width="100%" height="56" viewBox="0 0 460 56" xmlns="http://www.w3.org/2000/svg">
      <polyline points="${coords.join(' ')}" stroke="#14b8a6" stroke-width="2" fill="none" opacity="0.8" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${mx}" cy="${my}" r="4" fill="#f59e0b"/>
      <circle cx="${ex}" cy="${ey}" r="5" fill="#14b8a6"/>
    </svg>`
  } catch { return fallback }
}

const ADVENTURE_LABELS: Record<string, string> = {
  hiking: 'Hiking', walking: 'Walking', cycling: 'Cycling',
  water: 'Water sports', cruise: 'Cruise', driving: 'Driving',
}

const ADVENTURE_ICON: Record<string, string> = {
  hiking:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l4 8 5-5 5 15H2L8 3z"/></svg>`,
  walking: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M9 22l1-8-3-3 3-5h6l3 5-3 3 1 8"/></svg>`,
  cycling: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M12 17V7l-7 10h14L12 7"/></svg>`,
  water:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`,
  cruise:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15H6l-3 6h18l-3-6z"/><path d="M12 3v12M8 9l4-6 4 6"/></svg>`,
  driving: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="8" width="22" height="10" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v3"/><circle cx="7" cy="18" r="1"/><circle cx="17" cy="18" r="1"/></svg>`,
}

function buildEndEmail(p: { name: string; tripName: string; dayNumber: number; distanceKm: string; duration: string; momentCount: number; adventureType: string; svgChart: string; viewUrl: string }): string {
  const label = ADVENTURE_LABELS[p.adventureType] ?? 'Adventure'
  const icon = ADVENTURE_ICON[p.adventureType] ?? ADVENTURE_ICON.hiking
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Day ${p.dayNumber} recap — ${p.tripName}</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">

  <tr><td style="padding:0 0 28px">
    <span style="font-size:19px;font-weight:900;color:#fff;letter-spacing:-0.5px">roam<span style="color:#14b8a6">cast</span></span>
  </td></tr>

  <tr><td style="padding:0 0 24px">
    <p style="margin:0 0 8px;font-size:14px;color:#777">Hi ${p.name},</p>
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#fff;line-height:1.25">Day ${p.dayNumber} of ${p.tripName}<br>is ready to watch</h1>
    <p style="margin:0;font-size:14px;color:#888;line-height:1.7">${p.distanceKm}&nbsp;km walked, ${p.duration} on trail, and ${p.momentCount}&nbsp;moment${p.momentCount !== 1 ? 's' : ''} captured along the way.</p>
  </td></tr>

  <tr><td style="padding:0 0 28px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px">
      <tr>
        <td width="64" valign="middle" style="padding:20px 0 16px 20px">
          <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:44px;height:44px;background:#0a2218;border:1px solid #14b8a6;border-radius:10px;text-align:center;vertical-align:middle">${icon}</td></tr></table>
        </td>
        <td valign="middle" style="padding:20px 20px 16px 12px">
          <p style="margin:0;font-size:15px;font-weight:700;color:#fff">${p.tripName}</p>
          <p style="margin:3px 0 0;font-size:11px;color:#666">Day ${p.dayNumber} &middot; ${label}</p>
        </td>
      </tr>
      <tr><td colspan="2" style="padding:0 20px 18px">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:28px"><span style="font-size:14px;font-weight:700;color:#14b8a6">${p.distanceKm}km</span><br><span style="font-size:11px;color:#555">walked</span></td>
          <td style="padding-right:28px"><span style="font-size:14px;font-weight:700;color:#fff">${p.momentCount}</span><br><span style="font-size:11px;color:#555">moment${p.momentCount !== 1 ? 's' : ''}</span></td>
          <td><span style="font-size:14px;font-weight:700;color:#fff">${p.duration}</span><br><span style="font-size:11px;color:#555">on trail</span></td>
        </tr></table>
      </td></tr>
      <tr><td colspan="2" style="padding:0 16px 20px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border-radius:10px"><tr><td style="padding:10px 8px 6px">${p.svgChart}</td></tr></table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 0 32px">
    <a href="${p.viewUrl}" style="display:block;background:#14b8a6;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;text-align:center">Watch Day ${p.dayNumber} on Roamcast</a>
  </td></tr>

  <tr><td style="padding:20px 0 0;border-top:1px solid #1e1e1e;text-align:center">
    <p style="margin:0 0 8px;font-size:11px;color:#444;line-height:1.6">You're following this trip because you were added as a follower.</p>
    <p style="margin:0;font-size:11px;color:#444"><a href="#" style="color:#14b8a6;text-decoration:none">Unsubscribe</a></p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

function buildStartEmail(p: { name: string; tripName: string; dayNumber: number; viewUrl: string }): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Day ${p.dayNumber} is live — ${p.tripName}</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
  <tr><td style="padding:0 0 28px"><span style="font-size:19px;font-weight:900;color:#fff">roam<span style="color:#14b8a6">cast</span></span></td></tr>
  <tr><td style="padding:0 0 24px">
    <p style="margin:0 0 8px;font-size:14px;color:#777">Hi ${p.name},</p>
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#fff;line-height:1.25">Day ${p.dayNumber} of ${p.tripName} has started</h1>
    <p style="margin:0;font-size:14px;color:#888;line-height:1.7">Check back after the session ends to see photos, videos, and the route.</p>
  </td></tr>
  <tr><td style="padding:0 0 32px">
    <a href="${p.viewUrl}" style="display:block;background:#14b8a6;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;text-align:center">Follow along →</a>
  </td></tr>
  <tr><td style="padding:20px 0 0;border-top:1px solid #1e1e1e;text-align:center">
    <p style="margin:0;font-size:11px;color:#444"><a href="#" style="color:#14b8a6;text-decoration:none">Unsubscribe</a></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const { tripId, event, dayNumber, tripName } = await req.json()

  const { data: trip } = await userClient.from('trips').select('id, adventure_type').eq('id', tripId).eq('roamer_id', user.id).single()
  if (!trip) return new Response('Forbidden', { status: 403 })

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: followers } = await adminClient.from('followers').select('email').eq('trip_id', tripId)
  if (!followers?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const viewUrl = `${APP_URL}/follow/${tripId}/view`
  const isEnd = event === 'end'
  const subject = isEnd ? `Day ${dayNumber} recap is ready — ${tripName}` : `Day ${dayNumber} is live — ${tripName}`

  let distanceKm = '0.0', duration = '0m', momentCount = 0, svgChart = ''

  if (isEnd) {
    const { data: day } = await adminClient.from('days').select('id, distance_miles, duration_seconds').eq('trip_id', tripId).eq('day_number', dayNumber).single()
    if (day) {
      distanceKm = ((day.distance_miles ?? 0) * 1.60934).toFixed(1)
      duration = formatDuration(day.duration_seconds ?? 0)
      const { count } = await adminClient.from('moments').select('id', { count: 'exact', head: true }).eq('day_id', day.id)
      momentCount = count ?? 0
      const { data: track } = await adminClient.from('gps_tracks').select('points').eq('day_id', day.id).single()
      svgChart = generateRouteSVG(track?.points ?? null)
    }
  }

  let sent = 0
  for (const f of followers) {
    const name = getFirstName(f.email)
    const html = isEnd
      ? buildEndEmail({ name, tripName, dayNumber, distanceKm, duration, momentCount, adventureType: trip.adventure_type ?? 'hiking', svgChart, viewUrl })
      : buildStartEmail({ name, tripName, dayNumber, viewUrl })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: f.email, subject, html }),
    })
    if (res.ok) sent++
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
