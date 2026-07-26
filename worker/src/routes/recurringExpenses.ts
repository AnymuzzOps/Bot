import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { recurringExpenseCreateSchema, recurringExpenseUpdateSchema } from '../lib/schemas'
import { assertNoDbError, HttpError } from '../lib/errors'
import { cleanObject } from '../lib/query'
import { requireCurrentMembership, requireMemberInHousehold } from '../lib/household'
import { billingDateForMonth, monthlyEquivalent, monthlyRecurringTotal, nextMonthlyBillingDate } from '../lib/recurring'

export const recurringExpensesRoutes = new Hono<AppEnv>()

recurringExpensesRoutes.get('/', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const active = c.req.query('active')
  const category = c.req.query('category')
  const month = c.req.query('month')
  let query = supabase.from('recurring_expenses').select('*').eq('household_id', householdId).order('next_billing_date', { ascending: true, nullsFirst: false }).order('name')
  if (active === 'true' || active === 'false') query = query.eq('is_active', active === 'true')
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  assertNoDbError(error)
  const items = (data || []).map((item) => ({
    ...item,
    projected_date: month && /^\d{4}-\d{2}$/.test(month) && item.frequency === 'monthly' && item.billing_day
      ? billingDateForMonth(month, item.billing_day) : item.next_billing_date,
    monthly_equivalent: monthlyEquivalent(item),
  }))
  return c.json({ data: items, meta: { monthly_estimate: monthlyRecurringTotal(items.filter((item) => item.is_active)) } })
})

recurringExpensesRoutes.post('/', async (c) => {
  const body = recurringExpenseCreateSchema.parse(await c.req.json())
  const { supabase, householdId, memberId } = await requireCurrentMembership(c)
  if (body.auto_create_transaction) throw new HttpError(400, 'La creación automática de gastos todavía no está disponible.')
  if (body.assigned_to_member_id) await requireMemberInHousehold(supabase, householdId, body.assigned_to_member_id)
  const { data, error } = await supabase.from('recurring_expenses').insert({
    ...body, household_id: householdId, created_by_member_id: memberId,
    next_billing_date: body.next_billing_date || (body.frequency === 'monthly' && body.billing_day ? nextMonthlyBillingDate(body.billing_day) : null),
  }).select().single()
  assertNoDbError(error)
  return c.json({ data }, 201)
})

recurringExpensesRoutes.patch('/:id', async (c) => {
  const body = cleanObject(recurringExpenseUpdateSchema.parse(await c.req.json()))
  if (!Object.keys(body).length) throw new HttpError(400, 'No hay cambios para guardar.')
  const { supabase, householdId } = await requireCurrentMembership(c)
  if (body.auto_create_transaction === true) throw new HttpError(400, 'La creación automática de gastos todavía no está disponible.')
  if (body.assigned_to_member_id) await requireMemberInHousehold(supabase, householdId, String(body.assigned_to_member_id))
  if (!body.next_billing_date && body.billing_day && (!body.frequency || body.frequency === 'monthly')) body.next_billing_date = nextMonthlyBillingDate(Number(body.billing_day))
  const { data, error } = await supabase.from('recurring_expenses').update(body).eq('id', c.req.param('id')).eq('household_id', householdId).select().single()
  assertNoDbError(error)
  return c.json({ data })
})

recurringExpensesRoutes.delete('/:id', async (c) => {
  const { supabase, householdId } = await requireCurrentMembership(c)
  const { error } = await supabase.from('recurring_expenses').delete().eq('id', c.req.param('id')).eq('household_id', householdId)
  assertNoDbError(error)
  return c.body(null, 204)
})
