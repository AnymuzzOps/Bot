import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { assertNoDbError } from '../lib/errors'
import { parseLimit } from '../lib/query'
import { listHouseholdMembers } from '../lib/members'

export const conversationsRoutes = new Hono<AppEnv>()

conversationsRoutes.get('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const limit = parseLimit(c.req.query('limit'), 80, 200)
  const [{ data, error }, members] = await Promise.all([
    supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(limit),
    listHouseholdMembers(supabase, user.id),
  ])
  assertNoDbError(error)
  const memberById = new Map(members.map((member) => [member.id, member]))
  return c.json({
    data: (data || []).reverse().map((item) => ({
      ...item,
      created_by_member: item.created_by_member_id ? memberById.get(item.created_by_member_id) || null : null,
    })),
  })
})

conversationsRoutes.delete('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { error } = await supabase.from('conversations').delete().eq('user_id', user.id)
  assertNoDbError(error)
  return c.body(null, 204)
})
