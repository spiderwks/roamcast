import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Roamcast <hello@roamcast.app>'

function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function buildOtpEmail(code: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Roamcast sign-in code</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:32px 16px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px">

  <tr><td style="padding:0 0 28px">
    <span style="font-size:19px;font-weight:900;color:#fff;letter-spacing:-0.5px">roam<span style="color:#14b8a6">cast</span></span>
  </td></tr>

  <tr><td style="padding:0 0 28px">
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#fff;line-height:1.25">Your sign-in code</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.7">Use this code to sign in to Roamcast. It expires in 10 minutes.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:24px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px">
        <span style="font-size:40px;font-weight:900;color:#14b8a6;letter-spacing:12px">${code}</span>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 0 0;border-top:1px solid #1e1e1e;text-align:center">
    <p style="margin:0;font-size:11px;color:#444;line-height:1.6">If you didn't request this code, you can safely ignore this email.</p>
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let email: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const code = generate6DigitCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Invalidate any existing unused codes for this email
  await adminClient.from('follower_otp_codes')
    .update({ used: true })
    .eq('email', email)
    .eq('used', false)

  // Insert new code
  const { error: insertError } = await adminClient.from('follower_otp_codes').insert({
    email,
    code,
    expires_at: expiresAt,
  })

  if (insertError) {
    console.error('Failed to store OTP code:', insertError)
    return new Response(JSON.stringify({ error: 'Failed to generate code' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // Send via Resend
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: `${code} — your Roamcast sign-in code`,
      html: buildOtpEmail(code),
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('Resend error:', res.status, errText)
    return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 502, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
