import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { memoryCreateSchema, memoryUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject, escapeSearch, parseLimit } from '../lib/query'
import { requireCurrentMembership } from '../lib/household'

export const memoriesRoutes = new Hono<AppEnv>()

memoriesRoutes.get('/', async (c) => {
  const { supabase, householdId, memberId } = await requireCurrentMembership(c)
  const q = escapeSearch(c.req.query('q') || '')
  const category = c.req.query('category')
  const limit = parseLimit(c.req.query('limit'))

  let query = supabase
    .from('memories')
    .select('*')
    .eq('household_id', householdId)
    .or(`scope.eq.shared,and(scope.eq.personal,member_id.eq.${memberId})`)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (category) query = query.eq('category', category)
  if (q) query = query.or(`key.ilike.%${q}%,value.ilike.%${q}%,category.ilike.%${q}%`)
  const { data, error } = await query
  assertNoDbError(error)
  return c.json({ data })
})

memoriesRoutes.post('/', async (c) => {
  const body = memoryCreateSchema.parse(await c.req.json())
  const { supabase, user, householdId, memberId } = await requireCurrentMembership(c)
  const payload = {
    ...body,
    household_id: householdId,
    user_id: user.id,
    created_by_member_id: memberId,
    member_id: body.scope === 'personal' ? memberId : null,
  }
  const { data, error } = await supabase
    .from('memories')
    .insert(payload)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

memoriesRoutes.patch('/:id', async (c) => {
  const body = cleanObject(memoryUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const { supabase, householdId, memberId } = await requireCurrentMembership(c)
  const payload = {
    ...body,
    ...(body.scope === 'shared' ? { member_id: null } : {}),
    ...(body.scope === 'personal' ? { member_id: memberId } : {}),
  }
  const { data, error } = await supabase
    .from('memories')
    .update(payload)
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})

memoriesRoutes.delete('/:id', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
  assertNoDbError(error)
  return c.body(null, 204)
})
