import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../types'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject } from '../lib/query'
import { requireCurrentMembership, requireMemberInHousehold } from '../lib/household'

const shiftTypes = ['morning', 'afternoon', 'closing', 'day_off', 'custom'] as const
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable()

const shiftCreateSchema = z.object({
  shift_date: dateSchema,
  shift_type: z.enum(shiftTypes),
  label: z.string().trim().min(1).max(80),
  start_time: timeSchema,
  end_time: timeSchema,
  color: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  is_day_off: z.boolean().default(false),
  assigned_to_member_id: z.string().uuid().optional().nullable(),
})

const shiftUpdateSchema = shiftCreateSchema.partial()

type ShiftPayload = z.infer<typeof shiftCreateSchema> | z.infer<typeof shiftUpdateSchema>

const monthBounds = (month: string) => {
  const [year, monthIndex] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthIndex - 1, 1))
  const end = new Date(Date.UTC(year, monthIndex, 1))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

const normalizeTime = (value: string | null | undefined) => value ? `${value}:00` : value

const normalizeShift = (payload: ShiftPayload) => {
  const isDayOff = payload.is_day_off === true || payload.shift_type === 'day_off'
  const startTime = isDayOff ? null : normalizeTime(payload.start_time)
  const endTime = isDayOff ? null : normalizeTime(payload.end_time)

  if (startTime && endTime && startTime >= endTime) {
    throw new HttpError(400, 'La hora de inicio debe ser anterior a la hora de término.')
  }

  return cleanObject({
    ...payload,
    shift_type: isDayOff ? 'day_off' : payload.shift_type,
    label: isDayOff ? 'DÍA LIBRE' : payload.label,
    start_time: startTime,
    end_time: endTime,
    is_day_off: payload.is_day_off === undefined && payload.shift_type === undefined ? undefined : isDayOff,
    notes: payload.notes === undefined ? undefined : payload.notes || null,
    color: payload.color === undefined ? undefined : payload.color || null,
  })
}

export const calendarRoutes = new Hono<AppEnv>()

calendarRoutes.get('/', async (c) => {
  const month = monthSchema.catch(new Date().toISOString().slice(0, 7)).parse(c.req.query('month'))
  const { start, end } = monthBounds(month)
  const { supabase, householdId } = await requireCurrentMembership(c)

  const { data, error } = await supabase
    .from('work_shifts')
    .select('*')
    .eq('household_id', householdId)
    .gte('shift_date', start)
    .lt('shift_date', end)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  assertNoDbError(error)
  return c.json({ data })
})

calendarRoutes.post('/', async (c) => {
  const body = shiftCreateSchema.parse(await c.req.json())
  const { supabase, householdId, memberId } = await requireCurrentMembership(c)
  const assignedMember = body.assigned_to_member_id
    ? await requireMemberInHousehold(supabase, householdId, body.assigned_to_member_id)
    : null

  const payload = normalizeShift({ ...body, assigned_to_member_id: assignedMember?.id || null })
  const { data, error } = await supabase
    .from('work_shifts')
    .insert({
      ...payload,
      household_id: householdId,
      created_by_member_id: memberId,
    })
    .select()
    .single()

  assertNoDbError(error)
  return c.json({ data }, 201)
})

calendarRoutes.patch('/:id', async (c) => {
  const body = cleanObject(shiftUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')

  const { supabase, householdId } = await requireCurrentMembership(c)
  let assignedToMemberId = body.assigned_to_member_id
  if (assignedToMemberId) {
    const assignedMember = await requireMemberInHousehold(supabase, householdId, assignedToMemberId)
    assignedToMemberId = assignedMember.id
  }

  const payload = normalizeShift({ ...body, assigned_to_member_id: assignedToMemberId })
  const { data, error } = await supabase
    .from('work_shifts')
    .update(payload)
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)
    .select()
    .single()

  assertNoDbError(error)
  return c.json({ data })
})

calendarRoutes.delete('/:id', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { error } = await supabase
    .from('work_shifts')
    .delete()
    .eq('id', c.req.param('id'))
    .eq('household_id', householdId)

  assertNoDbError(error)
  return c.body(null, 204)
})
