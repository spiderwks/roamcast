import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  console.log(`[verify-otp] checking code for ${email}`)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const { data: otpRow, error: queryError } = await adminClient
    .from('follower_otp_codes')
    .select('id, code, expires_at')
    .eq('email', email)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (queryError) {
    console.error('[verify-otp] query error:', queryError)
    return new Response(JSON.stringify({ error: `DB error: ${queryError.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  console.log(`[verify-otp] found row:`, otpRow ? `code=${otpRow.code}` : 'none')

  if (!otpRow) {
    return new Response(JSON.stringify({ error: 'No valid code found — request a new one' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  if (otpRow.code !== code) {
    console.log(`[verify-otp] mismatch: expected=${otpRow.code} got=${code}`)
    return new Response(JSON.stringify({ error: 'Incorrect code — please check and try again' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Mark code as used before generating session
  await adminClient.from('follower_otp_codes').update({ used: true }).eq('id', otpRow.id)

  // Generate a magic link — the email_otp field is the raw token the client
  // can pass to supabase.auth.verifyOtp() to create a real session
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { shouldCreateUser: true },
  })

  if (linkError || !linkData?.properties?.email_otp) {
    console.error('[verify-otp] generateLink error:', linkError)
    return new Response(JSON.stringify({ error: `Session error: ${linkError?.message ?? 'no token returned'}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  console.log('[verify-otp] session token generated successfully')

  return new Response(JSON.stringify({ email_otp: linkData.properties.email_otp }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
