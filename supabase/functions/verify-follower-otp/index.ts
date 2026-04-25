import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  let email: string, code: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
    code = (body.code ?? '').trim()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  if (!email || !code) {
    return new Response(JSON.stringify({ error: 'Email and code required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Find a valid, unused code for this email
  const { data: otpRow } = await adminClient
    .from('follower_otp_codes')
    .select('id, code, expires_at')
    .eq('email', email)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!otpRow || otpRow.code !== code) {
    return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Mark code as used
  await adminClient.from('follower_otp_codes').update({ used: true }).eq('id', otpRow.id)

  // Create or retrieve user and generate a session via magic link
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { shouldCreateUser: true },
  })

  if (linkError || !linkData?.properties) {
    console.error('generateLink error:', linkError)
    return new Response(JSON.stringify({ error: 'Could not create session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  const { access_token, refresh_token } = linkData.properties

  return new Response(JSON.stringify({ access_token, refresh_token }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
