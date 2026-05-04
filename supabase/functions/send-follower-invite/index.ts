import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Roamcast <hello@roamcast.app>'
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://roamcast.vercel.app').replace(/\/$/, '')

function getFirstName(email: string): string {
  const local = email.split('@')[0].split(/[._+]/)[0]
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
}

function buildInviteEmail(p: { name: string; tripName: string; inviteUrl: string }): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're invited to follow ${p.tripName}</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">

  <tr><td style="padding:0 0 28px">
    <span style="font-size:19px;font-weight:900;color:#fff;letter-spacing:-0.5px">roam<span style="color:#14b8a6">cast</span></span>
  </td></tr>

  <tr><td style="padding:0 0 24px">
    <p style="margin:0 0 8px;font-size:14px;color:#777">Hi ${p.name},</p>
    <h1 style="margin:0 0 14px;font-size:24px;font-weight:800;color:#fff;line-height:1.25">You've been invited to follow<br><span style="color:#14b8a6">${p.tripName}</span></h1>
    <p style="margin:0;font-size:14px;color:#888;line-height:1.7">You'll get notified when each day begins and receive a full recap when it ends — photos, videos, the route, and every moment captured along the way.</p>
  </td></tr>

  <tr><td style="padding:0 0 28px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:24px">
      <tr><td>
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#555;text-transform:uppercase;letter-spacing:1px">What to expect</p>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%">
          <tr><td style="padding:10px 0;border-bottom:1px solid #222">
            <span style="font-size:13px;color:#aaa">📍</span>
            <span style="font-size:13px;color:#ccc;margin-left:10px">Live GPS route as each day unfolds</span>
          </td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #222">
            <span style="font-size:13px;color:#aaa">📸</span>
            <span style="font-size:13px;color:#ccc;margin-left:10px">Photos, videos and audio moments</span>
          </td></tr>
          <tr><td style="padding:10px 0">
            <span style="font-size:13px;color:#aaa">📬</span>
            <span style="font-size:13px;color:#ccc;margin-left:10px">Email recap at the end of every day</span>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:0 0 32px">
    <a href="${p.inviteUrl}" style="display:block;background:#14b8a6;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:12px;text-align:center">Start following ${p.tripName} →</a>
  </td></tr>

  <tr><td style="padding:20px 0 0;border-top:1px solid #1e1e1e;text-align:center">
    <p style="margin:0 0 8px;font-size:11px;color:#444;line-height:1.6">You received this because someone added you as a follower on Roamcast.</p>
    <p style="margin:0;font-size:11px;color:#444"><a href="#" style="color:#14b8a6;text-decoration:none">Unsubscribe</a></p>
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
      },
    })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const { tripId, tripName, email } = await req.json()
  if (!tripId || !tripName || !email) {
    return new Response(JSON.stringify({ error: 'tripId, tripName and email required' }), { status: 400 })
  }

  // Verify the roamer owns this trip
  const { data: trip } = await userClient.from('trips').select('id').eq('id', tripId).eq('roamer_id', user.id).single()
  if (!trip) return new Response('Forbidden', { status: 403 })

  const name = getFirstName(email)
  const inviteUrl = `${APP_URL}/follow/${tripId}?name=${encodeURIComponent(tripName)}`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: `You're invited to follow ${tripName} on Roamcast`,
      html: buildInviteEmail({ name, tripName, inviteUrl }),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', res.status, err)
    return new Response(JSON.stringify({ error: 'Failed to send invite email' }), { status: 502 })
  }

  return new Response(JSON.stringify({ sent: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
})
