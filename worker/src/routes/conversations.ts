import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { assertNoDbError } from '../lib/errors'
import { parseLimit } from '../lib/query'

export const conversationsRoutes = new Hono<AppEnv>()

conversationsRoutes.get('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const limit = parseLimit(c.req.query('limit'), 80, 200)
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', user.id)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(limit)
  assertNoDbError(error)
  return c.json({ data: (data || []).reverse() })
})

conversationsRoutes.delete('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { error } = await supabase.from('conversations').delete().eq('user_id', user.id)
  assertNoDbError(error)
  return c.body(null, 204)
})
