import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { profileUpdateSchema } from '../lib/schemas'
import { assertNoDbError } from '../lib/errors'
import { cleanObject } from '../lib/query'

export const profileRoutes = new Hono<AppEnv>()

profileRoutes.get('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')

  const existing = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  assertNoDbError(existing.error)

  if (existing.data) return c.json({ data: existing.data })

  const created = await supabase
    .from('users')
    .insert({ id: user.id, email: user.email || '' })
    .select()
    .single()
  assertNoDbError(created.error)
  return c.json({ data: created.data })
})

profileRoutes.patch('/', async (c) => {
  const body = cleanObject(profileUpdateSchema.parse(await c.req.json()))
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { data, error } = await supabase
    .from('users')
    .update(body)
    .eq('id', user.id)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})
