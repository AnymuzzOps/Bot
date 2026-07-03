import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { taskCreateSchema, taskUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject, escapeSearch, parseLimit } from '../lib/query'
import { requireHouseholdMember } from '../lib/members'

export const tasksRoutes = new Hono<AppEnv>()

tasksRoutes.get('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const status = c.req.query('status')
  const priority = c.req.query('priority')
  const q = escapeSearch(c.req.query('q') || '')
  const limit = parseLimit(c.req.query('limit'))

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
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
  const supabase = c.get('supabase')
  const user = c.get('user')
  const member = await requireHouseholdMember(supabase, user.id, body.member_id)
  const { member_id: _memberId, ...task } = body
  const payload = {
    ...task,
    user_id: user.id,
    created_by_member_id: member.id,
    completed_at: body.status === 'completed' ? new Date().toISOString() : null,
  }
  const { data, error } = await supabase.from('tasks').insert(payload).select().single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

tasksRoutes.patch('/:id', async (c) => {
  const body = cleanObject(taskUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const supabase = c.get('supabase')
  const user = c.get('user')
  let createdByMemberId: string | undefined
  if (body.member_id) {
    const member = await requireHouseholdMember(supabase, user.id, body.member_id)
    createdByMemberId = member.id
  }
  const { member_id: _memberId, ...task } = body
  const payload = {
    ...task,
    ...(createdByMemberId ? { created_by_member_id: createdByMemberId } : {}),
    ...(body.status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    ...(body.status === 'pending' ? { completed_at: null } : {}),
  }
  const { data, error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})

tasksRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
  assertNoDbError(error)
  return c.body(null, 204)
})
