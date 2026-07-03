import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { assertNoDbError } from '../lib/errors'
import { parseLimit } from '../lib/query'
import { requireCurrentMembership } from '../lib/household'

export const conversationsRoutes = new Hono<AppEnv>()

conversationsRoutes.get('/', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const limit = parseLimit(c.req.query('limit'), 80, 200)
  const [{ data, error }, membersResult] = await Promise.all([
    supabase
      .from('conversations')
      .select('*')
      .eq('household_id', householdId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('household_members')
      .select('id,name,slug,role,avatar')
      .eq('household_id', householdId),
  ])
  assertNoDbError(error)
  assertNoDbError(membersResult.error)
  const memberById = new Map((membersResult.data || []).map((member) => [member.id, member]))
  return c.json({
    data: (data || []).reverse().map((item) => ({
      ...item,
      created_by_member: item.created_by_member_id ? memberById.get(item.created_by_member_id) || null : null,
    })),
  })
})

conversationsRoutes.delete('/', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { error } = await supabase.from('conversations').delete().eq('household_id', householdId)
  assertNoDbError(error)
  return c.body(null, 204)
})
