import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { assertNoDbError } from '../lib/errors'
import { requireCurrentMembership } from '../lib/household'

export const membersRoutes = new Hono<AppEnv>()

membersRoutes.get('/', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { data, error } = await supabase
    .from('household_members')
    .select('id,household_id,auth_user_id,name,slug,role,avatar,created_at')
    .eq('household_id', householdId)
    .order('role', { ascending: false })
    .order('name', { ascending: true })

  assertNoDbError(error)
  return c.json({ data: data || [] })
})
