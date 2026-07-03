import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { taskCreateSchema, taskUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject, escapeSearch, parseLimit } from '../lib/query'
import { requireCurrentMembership, requireMemberInHousehold } from '../lib/household'

export const tasksRoutes = new Hono<AppEnv>()

tasksRoutes.get('/', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const status = c.req.query('status')
  const priority = c.req.query('priority')
  const q = escapeSearch(c.req.query('q') || '')
  const limit = parseLimit(c.req.query('limit'))

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('household_id', householdId)
    .order('status', { ascending: false })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status && ['pending', 'completed'].includes(status)) query = query.eq('status', status)
  if (priority && ['low', 'medium', 'high'].includes(priority)) query = query.eq('priority', priority)
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`)

  const { data, error } = await query
  assertNoDbError(error)
  return c.json({ data })
})

tasksRoutes.post('/', async (c) => {
  const body = taskCreateSchema.parse(await c.req.json())
  const { supabase, user, householdId, memberId } = await requireCurrentMembership(c)
  const { assigned_to_member_id, ...task } = body
  const assignedMember = assigned_to_member_id
    ? await requireMemberInHousehold(supabase, householdId, assigned_to_member_id)
    : null
  const payload = {
    ...task,
    household_id: householdId,
    user_id: user.id,
    created_by_member_id: memberId,
    assigned_to_member_id: assignedMember?.id || null,
    completed_at: body.status === 'completed' ? new Date().toISOString() : null,
  }
  const { data, error } = await supabase.from('tasks').insert(payload).select().single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

tasksRoutes.patch('/:id', async (c) => {
  const body = cleanObject(taskUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { assigned_to_member_id, ...task } = body
  const assignedMember = assigned_to_member_id
    ? await requireMemberInHousehold(supabase, householdId, assigned_to_member_id)
    : null
  const payload = {
    ...task,
    ...(assigned_to_member_id !== undefined ? { assigned_to_member_id: assignedMember?.id || null } : {}),
    ...(body.status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    ...(body.status === 'pending' ? { completed_at: null } : {}),
  }
  const { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})

tasksRoutes.delete('/:id', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
  assertNoDbError(error)
  return c.body(null, 204)
})
