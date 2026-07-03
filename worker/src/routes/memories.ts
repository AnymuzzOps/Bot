import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { memoryCreateSchema, memoryUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject, escapeSearch, parseLimit } from '../lib/query'
import { requireHouseholdMember } from '../lib/members'

export const memoriesRoutes = new Hono<AppEnv>()

memoriesRoutes.get('/', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const q = escapeSearch(c.req.query('q') || '')
  const category = c.req.query('category')
  const limit = parseLimit(c.req.query('limit'))

  let query = supabase
    .from('memories')
    .select('*')
    .eq('user_id', user.id)
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
  const supabase = c.get('supabase')
  const user = c.get('user')
  const member = await requireHouseholdMember(supabase, user.id, body.member_id)
  const { member_id: _memberId, ...memory } = body
  const payload = {
    ...memory,
    user_id: user.id,
    created_by_member_id: member.id,
    member_id: memory.scope === 'personal' ? member.id : null,
  }
  const { data, error } = await supabase
    .from('memories')
    .upsert(payload, { onConflict: 'user_id,key' })
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

memoriesRoutes.patch('/:id', async (c) => {
  const body = cleanObject(memoryUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const supabase = c.get('supabase')
  const user = c.get('user')
  let memberId: string | null | undefined
  let createdByMemberId: string | undefined
  if (body.member_id) {
    const member = await requireHouseholdMember(supabase, user.id, body.member_id)
    memberId = member.id
    createdByMemberId = member.id
  }
  const { member_id: _memberId, ...memory } = body
  const payload = {
    ...memory,
    ...(createdByMemberId ? { created_by_member_id: createdByMemberId } : {}),
    ...(memory.scope === 'shared' ? { member_id: null } : {}),
    ...(memory.scope === 'personal' && memberId ? { member_id: memberId } : {}),
  }
  if (memory.scope === 'personal' && !memberId) throw new HttpError(400, 'Debes seleccionar quién usará esta memoria personal.')
  const { data, error } = await supabase
    .from('memories')
    .update(payload)
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
    .select()
    .single()
  assertNoDbError(error)
  return c.json({ data })
})

memoriesRoutes.delete('/:id', async (c) => {
  const supabase = c.get('supabase')
  const user = c.get('user')
  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('user_id', user.id)
  assertNoDbError(error)
  return c.body(null, 204)
})
