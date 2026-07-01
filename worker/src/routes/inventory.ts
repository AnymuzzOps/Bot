import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { inventoryCreateSchema, inventoryUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject, escapeSearch, parseLimit } from '../lib/query'
import { daysFromNowISO } from '../lib/dates'

export const inventoryRoutes = new Hono<AppEnv>()

inventoryRoutes.get('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const location = c.req.query('location')
  const q = escapeSearch(c.req.query('q') || '')
  const expiringDays = Number(c.req.query('expiring_days'))
  const limit = parseLimit(c.req.query('limit'))

  let query = supabase
    .from('inventory')
    .select('*')
    .eq('user_id', user.id)
    .order('expiration_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (location) query = query.eq('location', location)
  if (q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%,notes.ilike.%${q}%`)
  if (Number.isFinite(expiringDays) && expiringDays >= 0) {
    query = query.not('expiration_date', 'is', null).lte('expiration_date', daysFromNowISO(expiringDays))
  }

  const { data, error } = await query
  assertNoDbError(error)
  return c.json({ data })
})

inventoryRoutes.post('/', async (c) => {
  const body = inventoryCreateSchema.parse(await c.req.json())
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { data, error } = await supabase
    .from('inventory')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

inventoryRoutes.patch('/:id', async (c) => {
  const body = cleanObject(inventoryUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { data, error } = await supabase
    .from('inventory')
    .update(body)
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})

inventoryRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
  assertNoDbError(error)
  return c.body(null, 204)
})
