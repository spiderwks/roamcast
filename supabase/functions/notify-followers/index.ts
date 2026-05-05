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

// Returns null when there are no real GPS points — caller hides the chart section
function generateRouteSVG(points: any[] | null): string | null {
  if (!points || points.length < 3) return null
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
      <polyline points="${coords.join(' ')}" stroke="#1D9E75" stroke-width="2" fill="none" opacity="0.8" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${mx}" cy="${my}" r="4" fill="#f59e0b"/>
      <circle cx="${ex}" cy="${ey}" r="5" fill="#1D9E75"/>
    </svg>`
  } catch { return null }
}

const ADVENTURE_LABELS: Record<string, string> = {
  hiking: 'Hiking', walking: 'Walking', cycling: 'Cycling',
  water: 'Water sports', cruise: 'Cruise', driving: 'Driving',
}

// Short text abbreviations — SVGs are stripped by most email clients
const ADVENTURE_ABBR: Record<string, string> = {
  hiking: 'HIKE', walking: 'WALK', cycling: 'BIKE',
  water: 'SWIM', cruise: 'SAIL', driving: 'DRIVE',
}

function buildBodyCopy(distanceMi: number, momentCount: number): string {
  const momentsStr = `${momentCount}&nbsp;moment${momentCount !== 1 ? 's' : ''} captured along the way`
  if (distanceMi > 0) {
    return `${distanceMi.toFixed(1)}&nbsp;mi covered, with ${momentsStr}.`
  }
  return `${momentsStr.charAt(0).toUpperCase() + momentsStr.slice(1)}.`
}

function buildEndEmail(p: {
  name: string; tripName: string; dayNumber: number;
  distanceMi: number; durationSecs: number; momentCount: number;
  adventureType: string; svgChart: string | null; viewUrl: string
}): string {
  const label = ADVENTURE_LABELS[p.adventureType] ?? 'Adventure'
  const abbr = ADVENTURE_ABBR[p.adventureType] ?? 'GO'
  const bodyCopy = buildBodyCopy(p.distanceMi, p.momentCount)
  const hasDistance = p.distanceMi > 0

  const statsRow = `
    ${hasDistance ? `<td style="padding-right:28px"><span style="font-size:14px;font-weight:700;color:#1D9E75">${p.distanceMi.toFixed(1)}&nbsp;mi</span><br><span style="font-size:11px;color:#555">covered</span></td>` : ''}
    <td><span style="font-size:14px;font-weight:700;color:#fff">${p.momentCount}</span><br><span style="font-size:11px;color:#555">moment${p.momentCount !== 1 ? 's' : ''}</span></td>
  `

  // Only render the chart row when there is real GPS data
  const chartSection = p.svgChart ? `
      <tr><td colspan="2" style="padding:0 16px 20px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111;border-radius:10px"><tr><td style="padding:10px 8px 6px">${p.svgChart}</td></tr></table>
      </td></tr>` : ''

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Day ${p.dayNumber} recap — ${p.tripName}</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">

  <tr><td style="padding:0 0 28px">
    <span style="font-size:19px;font-weight:900;color:#fff;letter-spacing:-0.5px">roam<span style="color:#1D9E75">cast</span></span>
  </td></tr>

  <tr><td style="padding:0 0 24px">
    <p style="margin:0 0 8px;font-size:14px;color:#777">Hi ${p.name},</p>
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#fff;line-height:1.25">Day ${p.dayNumber} of ${p.tripName}<br>is ready to watch</h1>
    <p style="margin:0;font-size:14px;color:#888;line-height:1.7">${bodyCopy}</p>
  </td></tr>

  <tr><td style="padding:0 0 28px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px">
      <tr>
        <td width="64" valign="middle" style="padding:20px 0 16px 20px">
          <table cellpadding="0" cellspacing="0" border="0"><tr><td style="width:44px;height:44px;background:#0a2218;border:1px solid #1D9E75;border-radius:10px;text-align:center;vertical-align:middle;font-size:9px;font-weight:900;color:#1D9E75;letter-spacing:0.5px">${abbr}</td></tr></table>
        </td>
        <td valign="middle" style="padding:20px 20px 16px 12px">
          <p style="margin:0;font-size:15px;font-weight:700;color:#fff">${p.tripName}</p>
          <p style="margin:3px 0 0;font-size:11px;color:#666">Day ${p.dayNumber} &middot; ${label}</p>
        </td>
      </tr>
      <tr><td colspan="2" style="padding:0 20px 18px">
        <table cellpadding="0" cellspacing="0" border="0"><tr>${statsRow}</tr></table>
      </td></tr>
      ${chartSection}
    </table>
  </td></tr>

  <tr><td style="padding:0 0 32px">
    <a href="${p.viewUrl}" style="display:block;background:#1D9E75;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;text-align:center">Watch Day ${p.dayNumber} on Roamcast</a>
  </td></tr>

  <tr><td style="padding:20px 0 0;border-top:1px solid #1e1e1e;text-align:center">
    <p style="margin:0 0 8px;font-size:11px;color:#444;line-height:1.6">You're following this trip because you were added as a follower.</p>
    <p style="margin:0;font-size:11px;color:#444"><a href="#" style="color:#1D9E75;text-decoration:none">Unsubscribe</a></p>
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

  const { tripId, dayNumber, tripName } = await req.json()

  const { data: trip } = await userClient.from('trips').select('id, adventure_type').eq('id', tripId).eq('roamer_id', user.id).single()
  if (!trip) return new Response('Forbidden', { status: 403 })

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: followers } = await adminClient.from('followers').select('email, name').eq('trip_id', tripId).not('accepted_at', 'is', null)
  if (!followers?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const viewUrl = `${APP_URL}/follow/${tripId}/view`
  const subject = `Day ${dayNumber} recap is ready — ${tripName}`

  const { data: day } = await adminClient.from('days').select('id, distance_miles, duration_seconds').eq('trip_id', tripId).eq('day_number', dayNumber).single()
  let distanceMi = 0, durationSecs = 0, momentCount = 0, svgChart: string | null = null
  if (day) {
    distanceMi = day.distance_miles ?? 0
    durationSecs = day.duration_seconds ?? 0
    const { count } = await adminClient.from('moments').select('id', { count: 'exact', head: true }).eq('day_id', day.id)
    momentCount = count ?? 0
    const { data: track } = await adminClient.from('gps_tracks').select('points').eq('day_id', day.id).single()
    svgChart = generateRouteSVG(track?.points ?? null)
  }

  let sent = 0
  for (const f of followers) {
    const name = f.name?.trim() || getFirstName(f.email)
    const html = buildEndEmail({ name, tripName, dayNumber, distanceMi, durationSecs, momentCount, adventureType: trip.adventure_type ?? 'hiking', svgChart, viewUrl })
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: f.email, subject, html }),
    })
    if (res.ok) sent++
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
