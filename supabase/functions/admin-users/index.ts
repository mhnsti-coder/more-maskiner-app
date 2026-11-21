import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl) throw new Error('SUPABASE_URL is required')
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const authorization = req.headers.get('Authorization')
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  if (!match) return jsonResponse({ error: 'Unauthorized' }, 401)

  const { data: authData, error: authError } = await adminClient.auth.getUser(match[1])
  const caller = authData.user
  if (authError || !caller) return jsonResponse({ error: 'Unauthorized' }, 401)

  const { data: callerProfile, error: profileLookupError } = await adminClient
    .from('profiles').select('role').eq('id', caller.id).maybeSingle()
  if (profileLookupError) {
    console.error('Admin profile lookup failed:', profileLookupError)
    return jsonResponse({ error: 'Unable to verify administrator access' }, 500)
  }
  if (callerProfile?.role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403)

  let payload: unknown
  try { payload = await req.json() } catch { return jsonResponse({ error: 'Request body must be valid JSON' }, 400) }
  if (!isObject(payload)) return jsonResponse({ error: 'Request body must be a JSON object' }, 400)

  const body = payload
  const action = body.action

  // List profiles together with Auth status. Auth emails and ban state are never
  // exposed through the public profiles table.
  if (action === 'list_users') {
    const { data: profileRows, error: profilesError } = await adminClient
      .from('profiles').select('id, full_name, role').order('full_name')
    if (profilesError) {
      console.error('Could not list profiles:', profilesError)
      return jsonResponse({ error: 'Kunde inte hämta användarprofiler.' }, 500)
    }

    const authUsers: Array<{ id: string; email?: string; banned_until?: string | null }> = []
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) {
        console.error('Could not list Auth users:', error)
        return jsonResponse({ error: 'Kunde inte hämta användarkonton.' }, 500)
      }
      authUsers.push(...data.users.map(user => ({
        id: user.id,
        email: user.email,
        banned_until: user.banned_until || null,
      })))
      if (data.users.length < 1000) break
    }

    const authById = new Map(authUsers.map(user => [user.id, user]))
    return jsonResponse({ users: (profileRows || []).map(profile => {
      const authUser = authById.get(profile.id)
      return {
        ...profile,
        email: authUser?.email || '',
        banned_until: authUser?.banned_until || null,
        is_active: !authUser?.banned_until || new Date(authUser.banned_until).getTime() <= Date.now(),
      }
    }) })
  }

  if (action === 'invite') {
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = body.role
    if (!fullName) return jsonResponse({ error: 'full_name is required' }, 400)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'A valid email is required' }, 400)
    if (role !== 'admin' && role !== 'seller') return jsonResponse({ error: 'role must be "admin" or "seller"' }, 400)

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role },
    })
    if (inviteError || !inviteData.user) {
      console.error('User invitation failed:', inviteError)
      return jsonResponse({ error: inviteError?.message || 'Unable to invite user' }, 400)
    }
    const invitedUser = inviteData.user
    const { error: saveProfileError } = await adminClient.from('profiles').upsert(
      { id: invitedUser.id, full_name: fullName, role }, { onConflict: 'id' },
    )
    if (saveProfileError) {
      console.error('Profile save failed after Auth invitation:', saveProfileError)
      return jsonResponse({ error: 'Användaren bjöds in, men profilen kunde inte sparas.', user_id: invitedUser.id }, 500)
    }
    return jsonResponse({ invited: true, user: { id: invitedUser.id, email: invitedUser.email }, profile: { id: invitedUser.id, full_name: fullName, role } }, 201)
  }

  if (action === 'recovery_link') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const redirectTo = typeof body.redirect_to === 'string' ? body.redirect_to : undefined
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: 'Ange en giltig e-postadress.' }, 400)
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: redirectTo ? { redirectTo } : undefined,
    })
    if (error || !data.properties?.action_link) {
      console.error('Recovery link generation failed:', error)
      return jsonResponse({ error: error?.message || 'Kunde inte skapa återställningslänk.' }, 400)
    }
    return jsonResponse({ action_link: data.properties.action_link })
  }

  if (action === 'deactivate' || action === 'reactivate') {
    const targetId = typeof body.user_id === 'string' ? body.user_id : ''
    if (!targetId) return jsonResponse({ error: 'user_id is required' }, 400)
    if (targetId === caller.id) return jsonResponse({ error: 'Du kan inte avaktivera eller ändra status på ditt eget konto.' }, 400)

    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles').select('id, role, full_name').eq('id', targetId).maybeSingle()
    if (targetError) return jsonResponse({ error: 'Kunde inte kontrollera användaren.' }, 500)
    if (!targetProfile) return jsonResponse({ error: 'Användaren hittades inte.' }, 404)

    const { data: targetAuth, error: targetAuthError } = await adminClient.auth.admin.getUserById(targetId)
    if (targetAuthError || !targetAuth.user) return jsonResponse({ error: 'Användarens Auth-konto hittades inte.' }, 404)

    const update = action === 'deactivate'
      ? await adminClient.auth.admin.updateUserById(targetId, { ban_duration: '876000h' })
      : await adminClient.auth.admin.updateUserById(targetId, { ban_duration: 'none' })
    if (update.error) {
      console.error('User status update failed:', update.error)
      return jsonResponse({ error: update.error.message || 'Kunde inte ändra användarstatus.' }, 400)
    }

    // Remove registered devices when an account is deactivated so it no longer
    // receives new Interninfo push notifications. The user can opt in again
    // after an administrator reactivates the account.
    let pushSubscriptionsRemoved = 0
    if (action === 'deactivate') {
      const { data: removedRows, error: pushDeleteError } = await adminClient
        .from('push_subscriptions').delete().eq('user_id', targetId).select('id')
      if (pushDeleteError) {
        console.error('Could not remove push subscriptions for deactivated user:', pushDeleteError)
      } else {
        pushSubscriptionsRemoved = removedRows?.length || 0
      }
    }
    return jsonResponse({ success: true, user_id: targetId, is_active: action === 'reactivate', push_subscriptions_removed: pushSubscriptionsRemoved })
  }

  if (action === 'change_role') {
    const targetId = typeof body.user_id === 'string' ? body.user_id : ''
    const role = body.role
    if (!targetId) return jsonResponse({ error: 'user_id is required' }, 400)
    if (targetId === caller.id) return jsonResponse({ error: 'Du kan inte ändra din egen behörighet.' }, 400)
    if (role !== 'admin' && role !== 'seller') return jsonResponse({ error: 'role must be "admin" or "seller"' }, 400)

    const { data: targetProfile, error: targetError } = await adminClient
      .from('profiles').select('id, role').eq('id', targetId).maybeSingle()
    if (targetError) return jsonResponse({ error: 'Kunde inte kontrollera användaren.' }, 500)
    if (!targetProfile) return jsonResponse({ error: 'Användaren hittades inte.' }, 404)
    if (targetProfile.role === role) return jsonResponse({ success: true, unchanged: true, role })

    if (targetProfile.role === 'admin' && role !== 'admin') {
      const { count, error: countError } = await adminClient.from('profiles')
        .select('id', { count: 'exact', head: true }).eq('role', 'admin')
      if (countError) return jsonResponse({ error: 'Kunde inte kontrollera antalet administratörer.' }, 500)
      if ((count || 0) <= 1) return jsonResponse({ error: 'Den sista administratören kan inte nedgraderas.' }, 400)
    }

    const { error: updateError } = await adminClient.from('profiles').update({ role }).eq('id', targetId)
    if (updateError) {
      console.error('Role update failed:', updateError)
      return jsonResponse({ error: 'Kunde inte uppdatera behörigheten.' }, 400)
    }
    return jsonResponse({ success: true, user_id: targetId, role })
  }

  return jsonResponse({ error: 'Unsupported action' }, 400)
})
