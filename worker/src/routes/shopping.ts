import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { shoppingCreateSchema, shoppingUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject, escapeSearch, parseLimit } from '../lib/query'
import { requireCurrentMembership } from '../lib/household'

export const shoppingRoutes = new Hono<AppEnv>()

shoppingRoutes.get('/', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const purchased = c.req.query('purchased')
  const q = escapeSearch(c.req.query('q') || '')
  const limit = parseLimit(c.req.query('limit'))

  let query = supabase
    .from('shopping_items')
    .select('*')
    .eq('household_id', householdId)
    .order('purchased', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (purchased === 'true' || purchased === 'false') query = query.eq('purchased', purchased === 'true')
  if (q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`)
  const { data, error } = await query
  assertNoDbError(error)
  return c.json({ data })
})

shoppingRoutes.post('/', async (c) => {
  const body = shoppingCreateSchema.parse(await c.req.json())
  const { supabase, user, householdId, memberId } = await requireCurrentMembership(c)
  const { data, error } = await supabase
    .from('shopping_items')
    .insert({
      ...body,
      household_id: householdId,
      user_id: user.id,
      created_by_member_id: memberId,
      purchased_at: body.purchased ? new Date().toISOString() : null,
    })
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

shoppingRoutes.patch('/:id', async (c) => {
  const body = cleanObject(shoppingUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const { supabase, householdId } = await requireCurrentMembership(c)
  const payload = {
    ...body,
    ...(body.purchased === true ? { purchased_at: new Date().toISOString() } : {}),
    ...(body.purchased === false ? { purchased_at: null } : {}),
  }
  const { data, error } = await supabase
    .from('shopping_items')
    .update(payload)
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})

shoppingRoutes.delete('/:id', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
  assertNoDbError(error)
  return c.body(null, 204)
})
