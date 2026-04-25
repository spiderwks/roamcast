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

  // Look up the most recent unused, unexpired code for this email
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

  console.log(`[verify-otp] found row:`, otpRow ? `code=${otpRow.code} expires=${otpRow.expires_at}` : 'none')

  if (!otpRow) {
    return new Response(JSON.stringify({ error: 'No valid code found for this email — request a new one' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  if (otpRow.code !== code) {
    console.log(`[verify-otp] code mismatch: expected=${otpRow.code} got=${code}`)
    return new Response(JSON.stringify({ error: 'Incorrect code — please check and try again' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Mark code as used
  await adminClient.from('follower_otp_codes').update({ used: true }).eq('id', otpRow.id)

  // Generate a real Supabase session via magic link
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { shouldCreateUser: true },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[verify-otp] generateLink error:', linkError)
    return new Response(JSON.stringify({ error: `Session error: ${linkError?.message ?? 'no action_link'}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Extract tokens from the action link fragment
  const actionLink = linkData.properties.action_link
  console.log('[verify-otp] action_link obtained, extracting tokens')

  const hash = actionLink.includes('#') ? actionLink.split('#')[1] : ''
  const params = new URLSearchParams(hash)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')

  if (!access_token || !refresh_token) {
    console.error('[verify-otp] tokens missing from action_link. hash params:', hash.slice(0, 100))
    return new Response(JSON.stringify({ error: 'Could not extract session tokens from magic link' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  return new Response(JSON.stringify({ access_token, refresh_token }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
