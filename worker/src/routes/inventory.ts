import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { inventoryCreateSchema, inventoryUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject, escapeSearch, parseLimit } from '../lib/query'
import { daysFromNowISO } from '../lib/dates'
import { requireCurrentMembership, requireMemberInHousehold } from '../lib/household'

export const inventoryRoutes = new Hono<AppEnv>()

inventoryRoutes.get('/', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const location = c.req.query('location')
  const q = escapeSearch(c.req.query('q') || '')
  const expiringDays = Number(c.req.query('expiring_days'))
  const limit = parseLimit(c.req.query('limit'))

  let query = supabase
    .from('inventory')
    .select('*')
    .eq('household_id', householdId)
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
  const { supabase, user, householdId, memberId } = await requireCurrentMembership(c)
  const { member_id, ...item } = body
  const selectedMember = member_id ? await requireMemberInHousehold(supabase, householdId, member_id) : null
  const { data, error } = await supabase
    .from('inventory')
    .insert({ ...item, household_id: householdId, user_id: user.id, created_by_member_id: selectedMember?.id || memberId })
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

inventoryRoutes.patch('/:id', async (c) => {
  const body = cleanObject(inventoryUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { member_id, ...item } = body
  const selectedMember = member_id ? await requireMemberInHousehold(supabase, householdId, member_id) : null
  const { data, error } = await supabase
    .from('inventory')
    .update(body)
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})

inventoryRoutes.delete('/:id', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
  assertNoDbError(error)
  return c.body(null, 204)
})
