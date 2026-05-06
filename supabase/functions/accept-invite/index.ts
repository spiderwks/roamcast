import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Roamcast <hello@roamcast.app>'
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://roamcast.vercel.app').replace(/\/$/, '')

function formatDistance(miles: number): string {
  return miles > 0 ? `${miles.toFixed(1)} mi` : null
}

function formatDuration(secs: number): string {
  if (!secs) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h === 0 && m === 0) return null
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function buildCatchUpEmail(p: {
  name: string
  tripName: string
  days: { day_number: number; date: string; distance_miles: number; duration_seconds: number }[]
  viewUrl: string
}): string {
  const dayRows = p.days.map((d, i) => {
    const dist = formatDistance(d.distance_miles)
    const dur = formatDuration(d.duration_seconds)
    const meta = [dist, dur].filter(Boolean).join(' · ')
    const dateStr = d.date
      ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : ''
    const isLast = i === p.days.length - 1
    return `
      <tr>
        <td style="padding:12px 0;${isLast ? '' : 'border-bottom:1px solid #1e1e1e'}">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td>
              <span style="font-size:13px;font-weight:700;color:#fff">Day ${d.day_number}</span>
              ${dateStr ? `<span style="font-size:11px;color:#555;margin-left:8px">${dateStr}</span>` : ''}
              ${meta ? `<br><span style="font-size:11px;color:#666">${meta}</span>` : ''}
            </td>
            <td align="right">
              <a href="${p.viewUrl}" style="font-size:11px;font-weight:700;color:#1D9E75;text-decoration:none">Watch →</a>
            </td>
          </tr></table>
        </td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're following ${p.tripName} — catch up on what you missed</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">

  <tr><td style="padding:0 0 28px">
    <span style="font-size:19px;font-weight:900;color:#fff;letter-spacing:-0.5px">roam<span style="color:#1D9E75">cast</span></span>
  </td></tr>

  <tr><td style="padding:0 0 24px">
    <p style="margin:0 0 8px;font-size:14px;color:#777">Hi ${p.name},</p>
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#fff;line-height:1.25">You're following <span style="color:#1D9E75">${p.tripName}</span><br>— here's what you missed</h1>
    <p style="margin:0;font-size:14px;color:#888;line-height:1.7">${p.days.length} day${p.days.length !== 1 ? 's' : ''} of content is ready for you to watch. Jump in whenever you're ready.</p>
  </td></tr>

  <tr><td style="padding:0 0 28px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px">
      <tr><td style="padding:16px 20px 0">
        <p style="margin:0;font-size:11px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:1px">Days to catch up on</p>
      </td></tr>
      <tr><td style="padding:0 20px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${dayRows}
        </table>
      </td></tr>
      <tr><td style="padding:0 20px 20px"></td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 0 32px">
    <a href="${p.viewUrl}" style="display:block;background:#1D9E75;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;text-align:center">Watch ${p.tripName} on Roamcast</a>
  </td></tr>

  <tr><td style="padding:20px 0 0;border-top:1px solid #1e1e1e;text-align:center">
    <p style="margin:0 0 8px;font-size:11px;color:#444;line-height:1.6">You received this because you accepted a follower invite on Roamcast.</p>
    <p style="margin:0;font-size:11px;color:#444"><a href="#" style="color:#1D9E75;text-decoration:none">Unsubscribe</a></p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
      },
    })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { tripId, email } = await req.json()
  if (!tripId || !email) {
    return new Response(JSON.stringify({ error: 'tripId and email required' }), { status: 400 })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch follower name and check not already accepted
  const { data: follower } = await adminClient
    .from('followers')
    .select('name, accepted_at')
    .eq('trip_id', tripId)
    .eq('email', email.toLowerCase())
    .single()

  const alreadyAccepted = !!follower?.accepted_at

  const { error } = await adminClient
    .from('followers')
    .update({ accepted_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .eq('email', email.toLowerCase())
    .is('accepted_at', null)

  if (error) {
    console.error('accept-invite error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // Send catch-up email only on first acceptance and if completed days exist
  if (!alreadyAccepted && RESEND_KEY) {
    const [{ data: trip }, { data: completedDays }] = await Promise.all([
      adminClient.from('trips').select('name').eq('id', tripId).single(),
      adminClient.from('days')
        .select('day_number, date, distance_miles, duration_seconds')
        .eq('trip_id', tripId)
        .eq('upload_status', 'complete')
        .order('day_number', { ascending: true }),
    ])

    if (trip && completedDays?.length) {
      const name = follower?.name?.trim() || email.split('@')[0]
      const viewUrl = `${APP_URL}/follow/${tripId}/view`
      const html = buildCatchUpEmail({ name, tripName: trip.name, days: completedDays, viewUrl })

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: `You're following ${trip.name} — catch up on ${completedDays.length} day${completedDays.length !== 1 ? 's' : ''}`,
          html,
        }),
      })
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
})
