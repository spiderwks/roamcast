import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Roamcast <onboarding@resend.dev>'
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://roamcast.vercel.app').replace(/\/$/, '')

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify caller is authenticated
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return new Response('Unauthorized', { status: 401 })

  const { tripId, event, dayNumber, tripName } = await req.json()

  // Verify caller owns this trip
  const { data: trip } = await userClient
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()
  if (!trip) return new Response('Forbidden', { status: 403 })

  // Query followers with service role (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: followers } = await adminClient
    .from('followers')
    .select('email')
    .eq('trip_id', tripId)

  if (!followers?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const isStart = event === 'start'
  const subject = isStart
    ? `Day ${dayNumber} is live — ${tripName}`
    : `Day ${dayNumber} recap is ready — ${tripName}`

  const viewUrl = `${APP_URL}/follow/${tripId}/view`

  const html = isStart
    ? `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="font-size:11px;color:#888;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Roamcast</p>
        <h2 style="margin:0 0 12px;color:#111;font-size:20px">Day ${dayNumber} has started</h2>
        <p style="color:#555;line-height:1.6;margin:0 0 24px">
          <strong>${tripName}</strong> is live right now. Check back after the session ends to see photos, videos, and the route.
        </p>
        <a href="${viewUrl}" style="background:#14b8a6;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;display:inline-block">
          Follow along →
        </a>
      </div>`
    : `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="font-size:11px;color:#888;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px">Roamcast</p>
        <h2 style="margin:0 0 12px;color:#111;font-size:20px">Day ${dayNumber} recap is ready</h2>
        <p style="color:#555;line-height:1.6;margin:0 0 24px">
          The Day ${dayNumber} session for <strong>${tripName}</strong> has wrapped up.
          Photos, videos, and the route map are now available.
        </p>
        <a href="${viewUrl}" style="background:#14b8a6;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;display:inline-block">
          View the recap →
        </a>
      </div>`

  let sent = 0
  for (const f of followers) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: f.email, subject, html }),
    })
    if (res.ok) sent++
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
